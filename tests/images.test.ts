import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateImage } from '@/server/images';
import type { Document } from '@/lib/domain';

const png = readFileSync(new URL('./fixtures/photo.png', import.meta.url));
function imageClient(documentRows: { size_bytes: number }[] = []) {
  const documents = documentRows as Array<{ size_bytes: number } & Partial<Document>>;
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const storage = { from: () => ({ upload, remove }) };
  const rpc = vi.fn(async (name: string) => name === 'myai_consume_image' ? { data: true, error: null } : { data: null, error: { code: 'unknown', message: 'Not implemented' } });
  const from = (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      limit: () => query,
      single: async () => ({ data: documents[0], error: null }),
      insert: (rows: unknown) => {
        documents.push(rows as { size_bytes: number } & Partial<Document>);
        return { select: () => ({ single: async () => ({ data: documents[documents.length - 1], error: null }) }) };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: documents.map(d => ({ size_bytes: d.size_bytes })), error: null }).then(resolve),
    };
    if (table === 'myai_documents') return query;
    return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
  };
  return { client: { from, rpc, storage } as unknown as SupabaseClient, storage: { from: () => ({ upload, remove }) }, rpc, documents };
}
beforeEach(() => { vi.stubEnv('IMAGE_API_KEY', 'chiave-di-prova'); vi.stubEnv('IMAGE_MODEL', 'modello-di-prova'); vi.stubEnv('IMAGE_BASE_URL', 'https://immagini.example/v1'); vi.stubEnv('OLLAMA_BASE_URL', ''); vi.stubEnv('DOCUMENT_OCR_ENABLED', 'false'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('generazione immagini tramite endpoint OpenAI-compatible', () => {
  it('salva l’immagine nella memoria; il trigger SQL preserva le chat riservate, senza chiamate AI', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://immagini.example/v1/images/generations');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer chiave-di-prova' });
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'modello-di-prova', n: 1, response_format: 'b64_json' });
      return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    const { client, storage, documents } = imageClient();
    const doc = await generateImage(client, 'utente', `Richiesta di prova ${'con parole '.repeat(40)}`, 'conversazione', 'capire');
    expect(doc.origin).toBe('generated');
    expect(doc.status).toBe('ready');
    expect(doc.mime).toBe('image/png');
    expect(doc.scope).toBe('memory');
    expect(doc.title).toHaveLength(150);
    expect(doc.filename).toBe('immagine-generata.png');
    expect(documents).toHaveLength(1);
    expect(storage.from().upload).toHaveBeenCalledWith(expect.stringMatching(/^utente\/.+\.png$/), expect.any(Buffer), { contentType: 'image/png', upsert: false, cacheControl: '0' });
  });
  it('senza chiave rifiuta onestamente prima di chiamare qualunque servizio', async () => {
    vi.stubEnv('IMAGE_API_KEY', '');
    const { client } = imageClient();
    await expect(generateImage(client, 'utente', 'Test', 'conversazione', 'capire')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('IMAGE_API_KEY') });
  });
  it('rispetta il limite giornaliero e i fallimenti del provider', async () => {
    const exhausted = imageClient();
    exhausted.rpc.mockResolvedValue({ data: false, error: null });
    await expect(generateImage(exhausted.client, 'utente', 'Test', 'conversazione', 'capire')).rejects.toMatchObject({ status: 429 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 402 })));
    await expect(generateImage(imageClient().client, 'utente', 'Test', 'conversazione', 'capire')).rejects.toMatchObject({ status: 402, message: expect.stringContaining('Credito') });
  });
  it('non salva nulla se il provider restituisce dati non validi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: 'abc' }] }), { status: 200 })));
    const { client, storage, documents } = imageClient();
    await expect(generateImage(client, 'utente', 'Test', 'conversazione', 'capire')).rejects.toMatchObject({ status: 502 });
    expect(documents).toHaveLength(0);
    expect(storage.from().upload).not.toHaveBeenCalled();
  });
});
