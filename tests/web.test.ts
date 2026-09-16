import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { blockedAddress, extractUrls, gatherWeb, htmlToText, safeFetchHtml, webSearch } from '@/server/web';

let serverA: Server; let serverB: Server; let baseA = ''; let baseB = '';
beforeAll(async () => {
  serverA = createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: `${baseB}/fine`, 'Content-Type': 'text/plain' }); res.end(); return; }
    if (req.url === '/loop') { res.writeHead(302, { Location: `${baseA}/loop` }); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><head><script>malware()</script><style>.x{}</style></head><body><h1>Titolo</h1><p>Contenuto &amp; cit&agrave; &#8212; fine.</p></body></html>');
  });
  serverB = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Pagina raggiunta via redirect.'); });
  await new Promise<void>(resolve => serverA.listen(0, '127.0.0.1', () => resolve()));
  await new Promise<void>(resolve => serverB.listen(0, '127.0.0.1', () => resolve()));
  const port = (server: Server) => (server.address() as { port: number }).port;
  baseA = `http://127.0.0.1:${port(serverA)}`; baseB = `http://127.0.0.1:${port(serverB)}`;
});
afterAll(async () => { await new Promise<void>(resolve => serverA.close(() => resolve())); await new Promise<void>(resolve => serverB.close(() => resolve())); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('protezione della rete interna (SSRF)', () => {
  it('blocca indirizzi privati, link-local, metadata e IPv6 riservati', () => {
    for (const address of ['127.0.0.1', '10.0.0.5', '172.16.3.4', '172.31.255.255', '192.168.1.17', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:10.0.0.1', '2001:db8::1']) expect(blockedAddress(address)).toBe(true);
    expect(blockedAddress('93.184.216.34')).toBe(false);
    expect(blockedAddress('2606:4700::1111')).toBe(false);
  });
  it('rifiuta host che risolvono su indirizzi privati, come Supabase sulla LAN', async () => {
    await expect(safeFetchHtml(`${baseA}/pagina`)).rejects.toMatchObject({ status: 403 });
  });
  it('apre pagine locali solo con il flag esplicito di sviluppo e segue un solo reindirizzamento', async () => {
    vi.stubEnv('WEB_FETCH_ALLOW_PRIVATE', 'true');
    const page = await safeFetchHtml(`${baseA}/redirect`);
    expect(page.html).toContain('Pagina raggiunta via redirect');
    await expect(safeFetchHtml(`${baseA}/loop`)).rejects.toMatchObject({ status: 502 });
    expect(blockedAddress('10.0.0.1')).toBe(false);
  });
});

describe('estrazione e pulizia dei contenuti web', () => {
  it('estrae al massimo tre URL, senza duplicati e senza punteggiatura finale', () => {
    expect(extractUrls('Guarda https://example.com/a, poi https://example.com/a e https://example.org/b (vedi).')).toEqual(['https://example.com/a', 'https://example.org/b']);
    expect(extractUrls('Nessun link qui.')).toEqual([]);
  });
  it('converte HTML in testo senza script, stili e marcatori', () => {
    const text = htmlToText('<script>alert(1)</script><style>p{}</style><p>Ciao&nbsp;mondo</p><br/>Riga 2 &amp; 3 &#64;');
    expect(text).toContain('Ciao mondo');
    expect(text).toContain('Riga 2 & 3 @');
    expect(text).not.toContain('alert');
  });
  it('rifiuta contenuti non testuali', async () => {
    vi.stubEnv('WEB_FETCH_ALLOW_PRIVATE', 'true');
    const binary = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end('bytes'); });
    await new Promise<void>(resolve => binary.listen(0, '127.0.0.1', () => resolve()));
    try {
      const port = (binary.address() as { port: number }).port;
      await expect(safeFetchHtml(`http://127.0.0.1:${port}/foto.png`)).rejects.toMatchObject({ status: 415 });
    } finally { await new Promise<void>(resolve => binary.close(() => resolve())); }
  });
});

describe('ricerca web opzionale', () => {
  it('senza chiave la ricerca dichiara di non essere configurata', async () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    await expect(webSearch('Test')).rejects.toMatchObject({ status: 503 });
    const gathered = await gatherWeb('Una domanda senza link', true);
    expect(gathered).toContain('non è configurata');
  });
  it('con chiave valorizza risposta e risultati, con limiti e senza link', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'chiave-di-prova');
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('https://api.tavily.com/search');
      return new Response(JSON.stringify({ answer: 'Una risposta sintetica.', results: [{ title: 'Primo', url: 'https://example.org/1', content: 'Contenuto primo.' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const gathered = await gatherWeb('Domanda per la ricerca', true);
    expect(gathered).toContain('Una risposta sintetica');
    expect(gathered).toContain('[web · Primo · https://example.org/1]');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('con provider OpenRouter usa il plugin web, estrae risposta e fonti, senza chiave dichiara onestamente', async () => {
    vi.stubEnv('WEB_SEARCH_PROVIDER', 'openrouter');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    await expect(webSearch('Test')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('OpenRouter') });
    vi.stubEnv('OPENROUTER_API_KEY', 'chiave-openrouter');
    vi.stubEnv('OPENROUTER_WEB_MODEL', 'google/gemini-3.8-flash');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(String(init?.body));
      expect(body.plugins).toEqual([{ id: 'web', max_results: 3 }]);
      expect(body.reasoning).toEqual({ effort: 'low' });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Bitcoin vale circa 66.500 euro. [1]', annotations: [{ type: 'url_citation', url_citation: { url: 'https://coingecko.com/btc/eur', title: 'CoinGecko' } }, { type: 'url_citation', url_citation: { url: 'https://coingecko.com/btc/eur', title: 'Duplicato' } }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const found = await webSearch('Quanto vale un bitcoin?');
    expect(found.answer).toContain('66.500');
    expect(found.results).toEqual([{ title: 'CoinGecko', url: 'https://coingecko.com/btc/eur', content: '' }]);
    const gathered = await gatherWeb('Quanto vale un bitcoin?', true);
    expect(gathered).toContain('[web · risposta di ricerca]');
    expect(gathered).toContain('CoinGecko · https://coingecko.com/btc/eur');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
