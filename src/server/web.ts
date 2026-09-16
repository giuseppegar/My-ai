import 'server-only';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { ApiError, numberEnv } from './core';

// Solo sviluppo/test locale: consente di puntare i test a un server in ascolto su loopback.
const allowPrivate = () => process.env.WEB_FETCH_ALLOW_PRIVATE === 'true';
const fetchTimeoutMs = () => numberEnv('WEB_FETCH_TIMEOUT_SECONDS', 10, 3, 20) * 1000;
const fetchMaxBytes = () => numberEnv('WEB_FETCH_MAX_BYTES', 2_000_000, 100_000, 5_000_000);
const maxRedirects = 3;

// Nessun accesso alla rete locale del server: Supabase, container, servizi interni restano irraggiungibili.
export function blockedAddress(address: string): boolean {
  const ip = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (allowPrivate()) return ip === '0.0.0.0' || ip === '::';
  const version = isIP(ip);
  if (!version) return true;
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true; // Link-local e metadata cloud.
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT.
    return false;
  }
  if (ip === '::1' || ip === '::') return true;
  if (/^f[cd]/.test(ip)) return true; // Unique/local.
  if (/^fe[89ab]/.test(ip)) return true; // Link-local.
  if (ip.startsWith('2001:db8')) return true; // Documentation.
  return !ip.startsWith('2') && !ip.startsWith('3'); // Solo unicast globale 2000::/3.
}
export async function assertPublicHost(hostname: string): Promise<void> {
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => { throw new ApiError(502, 'Sito non raggiungibile o nome non risolto.'); });
  if (!addresses.length || addresses.some(a => blockedAddress(a.address))) throw new ApiError(403, 'Indirizzo non consentito: non apro risorse della rete locale o riservata.');
}
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[.,;:!?)\]}>]+$/, '')))].slice(0, 3);
}
function parseUrl(raw: string): URL {
  try { return new URL(raw); }
  catch { throw new ApiError(400, 'Link non valido.'); }
}
async function fetchWithBudget(url: URL, accept: RegExp, timeout: number, budget: number): Promise<{ redirect?: URL; bytes?: Buffer }> {
  const response = await fetch(url.toString(), { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'MyAiWebReader/0.1 (+assistente personale)', accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,image/*;q=0.1' } });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new ApiError(502, 'Reindirizzamento non valido.');
    return { redirect: new URL(location, url) };
  }
  if (!response.ok) throw new ApiError(502, `Il sito ha risposto ${response.status}.`);
  const type = response.headers.get('content-type') || '';
  if (!accept.test(type)) throw new ApiError(415, 'Il link non porta a un contenuto leggibile.');
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > budget) { await reader.cancel(); break; }
      chunks.push(value);
    }
  }
  return { bytes: Buffer.concat(chunks).subarray(0, budget) };
}
export async function safeFetchHtml(rawUrl: string): Promise<{ url: string; html: string }> {
  let current = parseUrl(rawUrl);
  for (let redirects = 0; ;) {
    if (!['http:', 'https:'].includes(current.protocol)) throw new ApiError(400, 'Solo link http o https.');
    if (current.username || current.password) throw new ApiError(400, 'Link con credenziali non consentito.');
    await assertPublicHost(current.hostname);
    const result = await fetchWithBudget(current, /^text\/html|^text\/plain|application\/xhtml\+xml/i, fetchTimeoutMs(), fetchMaxBytes());
    if (result.redirect) {
      current = result.redirect;
      redirects++;
      if (redirects > maxRedirects) throw new ApiError(502, 'Troppi reindirizzamenti.');
      continue;
    }
    return { url: current.toString(), html: result.bytes!.toString('utf8') };
  }
}
export async function safeFetchBinary(rawUrl: string, mimePattern: RegExp, budget = numberEnv('IMAGE_MAX_BYTES', 12_000_000, 1_000_000, 12_000_000)) {
  let current = parseUrl(rawUrl);
  for (let redirects = 0; ;) {
    if (!['http:', 'https:'].includes(current.protocol)) throw new ApiError(400, 'Solo link http o https.');
    if (current.username || current.password) throw new ApiError(400, 'Link con credenziali non consentito.');
    await assertPublicHost(current.hostname);
    const result = await fetchWithBudget(current, mimePattern, fetchTimeoutMs(), budget);
    if (result.redirect) {
      current = result.redirect;
      redirects++;
      if (redirects > maxRedirects) throw new ApiError(502, 'Troppi reindirizzamenti.');
      continue;
    }
    return result.bytes!;
  }
}
export function htmlToText(html: string): string {
  const without = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<template[\s\S]*?<\/template>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
  return without.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 40_000);
}
// Provider di ricerca: 'openrouter' usa il plugin web di OpenRouter (una chiave per immagini e ricerca),
// 'tavily' usa l'API Tavily. Senza configurazione la ricerca dichiara di non essere attiva.
export function webProvider(): 'openrouter' | 'tavily' {
  return process.env.WEB_SEARCH_PROVIDER === 'openrouter' ? 'openrouter' : 'tavily';
}
const openrouterKey = () => process.env.OPENROUTER_API_KEY || process.env.IMAGE_API_KEY || '';
export async function openrouterWebSearch(query: string) {
  if (!openrouterKey()) throw new ApiError(503, 'La ricerca web non è configurata (serve una chiave OpenRouter o Tavily).');
  const take = numberEnv('WEB_SEARCH_MAX_RESULTS', 3, 1, 5);
  const response = await fetch(`${(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${openrouterKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENROUTER_WEB_MODEL || 'google/gemini-3.8-flash', messages: [{ role: 'user', content: `${query.slice(0, 400)}\nCerca nel web e riassumi i risultati in italiano in al massimo 200 parole, citando le fonti.` }], plugins: [{ id: 'web', max_results: take }], max_tokens: 600, reasoning: { effort: 'low' } }),
  });
  if (!response.ok) throw new ApiError(response.status === 402 ? 402 : response.status === 401 ? 503 : 502, response.status === 402 ? 'Credito OpenRouter insufficiente. Controlla il tuo account.' : response.status === 401 ? 'La chiave OpenRouter non è valida.' : 'Ricerca web non disponibile. Riprova più tardi.');
  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const answer = typeof message?.content === 'string' ? message.content : '';
  const results: { title: string; url: string; content: string }[] = [];
  for (const annotation of Array.isArray(message?.annotations) ? message.annotations : []) {
    const citation = annotation?.url_citation;
    if (citation?.url && !results.some(r => r.url === citation.url)) results.push({ title: String(citation.title || ''), url: String(citation.url), content: '' });
  }
  if (!answer.trim()) throw new ApiError(502, 'La ricerca web non ha restituito una risposta utilizzabile.');
  return { answer: answer.slice(0, 6000), results: results.slice(0, take) };
}
export async function webSearch(query: string) {
  if (webProvider() === 'openrouter') return openrouterWebSearch(query);
  if (!process.env.TAVILY_API_KEY) throw new ApiError(503, 'La ricerca web non è configurata (serve una chiave OpenRouter o Tavily).');
  const take = numberEnv('WEB_SEARCH_MAX_RESULTS', 3, 1, 5);
  const response = await fetch(`${(process.env.TAVILY_BASE_URL || 'https://api.tavily.com').replace(/\/$/, '')}/search`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: query.slice(0, 400), search_depth: 'basic', max_results: take, include_answer: true, include_raw_content: false }),
  });
  if (!response.ok) throw new ApiError(response.status === 401 ? 503 : 502, response.status === 401 ? 'La chiave di ricerca web non è valida.' : 'Ricerca web non disponibile. Riprova più tardi.');
  const data = await response.json();
  return {
    answer: typeof data.answer === 'string' ? data.answer : '',
    results: (Array.isArray(data.results) ? data.results : []).map((r: Record<string, unknown>) => ({ title: String(r.title || ''), url: String(r.url || ''), content: String(r.content || '').slice(0, 4000) })),
  };
}
// I risultati web sono materiale non attendibile come i documenti: mai istruzioni da eseguire.
export async function gatherWeb(query: string, searchEnabled: boolean): Promise<string> {
  const parts: string[] = [];
  const notes: string[] = [];
  for (const link of extractUrls(query)) {
    try {
      const { url, html } = await safeFetchHtml(link);
      parts.push(`[web · pagina ${url}]\n${htmlToText(html)}`);
    } catch (error) {
      notes.push(`Pagina ${link}: ${error instanceof Error ? error.message : 'non aperta'}.`);
    }
  }
  if (searchEnabled) {
    try {
      const found = await webSearch(query);
      if (found.answer) parts.unshift(`[web · risposta di ricerca]\n${found.answer}`);
      for (const result of found.results) parts.push(`[web · ${result.title} · ${result.url}]\n${result.content}`);
    } catch (error) {
      notes.push(error instanceof Error ? error.message : 'Ricerca web non riuscita.');
    }
  }
  if (notes.length) parts.push(`[web · avvisi]\n${notes.join('\n')}`);
  return parts.join('\n\n').slice(0, 24_000);
}
