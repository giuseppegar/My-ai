import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectMime, extractDocument, fileLink, imageForAI, originalFile, processDocument } from '@/server/files';
import { documentPassages } from '@/lib/document-context';
import type { Document } from '@/lib/domain';
import { textPdf } from './fixtures/documents';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
beforeEach(() => { vi.stubEnv('DOCUMENT_OCR_ENABLED', 'false'); vi.stubEnv('OLLAMA_BASE_URL', ''); });
afterEach(() => vi.unstubAllEnvs());

describe('formati e lettura documenti reali', () => {
  it('legge un PDF testuale con riferimenti alle pagine', async () => {
    const buffer = textPdf();
    expect(detectMime(buffer, 'allegato.PDF')).toBe('application/pdf');
    const extracted = await extractDocument(buffer, 'application/pdf');
    expect(extracted.pageCount).toBe(2);
    expect(extracted.pages[0]).toMatchObject({ page: 1, content: expect.stringContaining('ORCHIDEA42') });
    expect(extracted.pages[1].content).toContain('venerdi');
  });
  it('regressione: 206 pagine e oltre 200.000 caratteri non sono un errore', async () => {
    const buffer = textPdf(Array.from({ length: 206 }, (_, i) => `Pagina ${i + 1}: ${'Contenuto della pagina. '.repeat(60)}`));
    const extracted = await extractDocument(buffer, 'application/pdf');
    expect(extracted.pageCount).toBe(206);
    expect(extracted.pages).toHaveLength(206);
    expect(extracted.pages.reduce((n, p) => n + p.content.length, 0)).toBeGreaterThan(200_000);
    expect(extracted.pages[205].content).toContain('Pagina 206');
    expect(extracted.note).toBe('');
  });
  it('oltre i limiti conserva il testo parziale e lo dichiara, non scarta tutto', async () => {
    const pdf = await extractDocument(textPdf(Array.from({ length: 501 }, () => 'Testo della pagina con contenuto sufficiente.')), 'application/pdf');
    expect(pdf.pageCount).toBe(501);
    expect(pdf.pages).toHaveLength(500);
    expect(pdf.note).toContain('500 di 501');
    const text = await extractDocument(Buffer.from('x'.repeat(1_000_020)), 'text/plain');
    expect(text.pages[0].content).toHaveLength(1_000_000);
    expect(text.note).toContain('Testo parziale');
  });
  it('estrae DOCX vero e TXT UTF-8 senza perdere accenti', async () => {
    const docx = fixture('sample.docx');
    const extracted = await extractDocument(docx, detectMime(docx, 'sample.docx'));
    expect(extracted.pages[0].content).toContain('città, perché');
    const txt = Buffer.from('Città e curiosità\nSeconda riga.');
    expect((await extractDocument(txt, detectMime(txt, 'note.txt'))).pages[0].content).toBe(txt.toString());
  });
  it('rimuove NUL dal testo estratto prima dell’inserimento PostgreSQL', async () => {
    const extracted = await extractDocument(Buffer.from('Prima\0dopo'), 'text/plain');
    expect(extracted.pages[0].content).toBe('Primadopo');
  });
  it.each(['png', 'jpg', 'gif', 'webp'])('riconosce una vera immagine %s senza inventare testo se OCR è spento', async extension => {
    const buffer = fixture(`photo.${extension}`);
    const mime = detectMime(buffer, `foto.${extension}`);
    expect(mime).toMatch(/^image\//);
    const extracted = await extractDocument(buffer, mime);
    expect(extracted.pages).toEqual([]);
    expect(extracted.note).toContain('OCR locale non attivo');
  });
  it('riconosce un PDF solo scansione e segnala OCR mancante', async () => {
    const extracted = await extractDocument(fixture('scan.pdf'), 'application/pdf');
    expect(extracted.pages.every(p => !p.content.trim())).toBe(true);
    expect(extracted.note).toContain('OCR locale non attivo');
  });
  it('rifiuta MIME contraffatti, TXT non UTF-8, archivi non DOCX e PDF danneggiati', async () => {
    expect(() => detectMime(Buffer.from('<script>'), 'file.pdf')).toThrow();
    expect(() => detectMime(Buffer.from([0xff, 0xfe, 0]), 'file.txt')).toThrow();
    await expect(extractDocument(Buffer.from('PKinvalid'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).rejects.toThrow();
    await expect(extractDocument(Buffer.from('%PDF-1.4\ninvalid'), 'application/pdf')).rejects.toThrow();
  });
});

describe('passaggi di documenti lunghi nel contesto AI', () => {
  const chunks = Array.from({ length: 206 }, (_, i) => ({ page: i + 1, content: i === 205 ? 'Il codice segreto della prova è TULIPANO99.' : `Pagina ${i + 1}: contenuto introduttivo.` }));
  it('recupera il passaggio pertinente anche nell’ultima pagina', () => {
    const result = documentPassages(chunks, 'Cerca TULIPANO99', undefined, 3000);
    expect(result).toContain('[pagina 206]');
    expect(result).toContain('TULIPANO99');
    expect(result).toContain('non il documento integrale');
  });
  it('rispetta la pagina richiesta o scelta da un risultato della ricerca', () => {
    expect(documentPassages(chunks, 'Spiegami pagina 180', undefined, 3000)).toContain('[pagina 180]');
    expect(documentPassages(chunks, '', 170, 3000)).toContain('[pagina 170]');
  });
  it('per un riassunto campiona anche il fondo, non soltanto le prime 12 parti', () => {
    expect(documentPassages(chunks, 'Riassumi questo documento')).toContain('[pagina 206]');
    expect(documentPassages([], 'Test')).toBe('');
  });
});

function fileClient(doc: Document, buffer = fixture('photo.png')) {
  const chunks: unknown[] = [];
  const download = vi.fn(async () => ({ data: new Blob([new Uint8Array(buffer)]), error: null }));
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: doc, error: null }) }) }),
    update: (patch: Partial<Document>) => ({ eq: async () => { Object.assign(doc, patch); return { data: null, error: null }; } }),
    delete: () => ({ eq: async () => { if (table === 'myai_document_chunks') chunks.length = 0; return { data: null, error: null }; } }),
    insert: async (rows: unknown[]) => { chunks.push(...rows); return { data: null, error: null }; },
  });
  return { client: { from, storage: { from: () => ({ download }) } } as unknown as SupabaseClient, chunks, download };
}
const document = () => ({ id: 'document-test', path: 'uid/private.png', mime: 'image/png', filename: 'foto città.png', title: 'Foto', scope: 'chat', status: 'processing' }) as Document;

describe('persistenza, originali privati e visione', () => {
  it('indicizza il testo e segnala onestamente no_text quando OCR è spento', async () => {
    const doc = document();
    const mock = fileClient(doc);
    expect((await processDocument(mock.client, doc, fixture('photo.png'))).status).toBe('no_text');
    expect(mock.chunks).toHaveLength(0);
    doc.mime = 'text/plain';
    expect((await processDocument(mock.client, doc, Buffer.from('Un testo da leggere.'))).status).toBe('ready');
    expect(mock.chunks).toEqual([{ content: 'Un testo da leggere.', page: null, document_id: doc.id, embedding: null }]);
    expect(doc.error).toBeNull();
  });
  it('offre link same-origin e download autenticato, mai un URL LAN', async () => {
    const doc = document();
    const { client } = fileClient(doc);
    expect((await fileLink(client, doc.id)).url).toBe('/api/documents/document-test/file');
    const response = await originalFile(client, doc.id, true);
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('citt%C3%A0');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fixture('photo.png'));
  });
  it('prepara una foto realmente accessibile al provider, non un link privato', async () => {
    const { client } = fileClient(document());
    const image = await imageForAI(client, 'document-test');
    expect(image).toMatch(/^data:image\/jpeg;base64,/);
    expect(Buffer.from(image.split(',')[1], 'base64').subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });
});
