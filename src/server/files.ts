import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromBuffer } from 'yauzl';
import { extractRawText } from 'mammoth';
import { getDocumentProxy } from 'unpdf';
import sharp from 'sharp';
import { imageOptions, recognizeDocument } from './ocr';
import { ApiError, checked } from './core';
import { embeddings } from './ai';
import { categorySchema, uuid } from '@/lib/validation';
import type { Document } from '@/lib/domain';
import { videoFile } from './video-file';

const bucket = 'myai-private';
const maxSize = 10 * 1024 * 1024;
export async function checkSpace(client: SupabaseClient, extraBytes: number) {
  const owned = await checked(client.from('myai_documents').select('size_bytes').limit(501));
  if (owned.length >= 500 || owned.reduce((s, d) => s + Number(d.size_bytes), extraBytes) > 250 * 1024 * 1024) throw new ApiError(413, 'Spazio della prima versione esaurito (500 file / 250 MB). Elimina alcuni file.');
}
export function detectMime(buffer: Buffer, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' && buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (ext === 'docx' && buffer[0] === 0x50 && buffer[1] === 0x4b) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (['jpg', 'jpeg'].includes(ext || '') && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (ext === 'png' && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (ext === 'webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') return 'image/webp';
  if (ext === 'gif' && ['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString())) return 'image/gif';
  if (['txt', 'md'].includes(ext || '') && !buffer.includes(0)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); return 'text/plain'; } catch { /* Solo UTF-8. */ }
  }
  throw new ApiError(415, 'Formato non supportato o contenuto diverso dall’estensione. Usa PDF, DOCX, TXT/MD UTF-8, JPG, PNG, GIF o WebP.');
}
async function validateZip(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
    if (error || !zip) return reject(new Error('DOCX illeggibile.'));
    let size = 0, count = 0, hasDocument = false;
    zip.on('error', reject);
    zip.on('entry', entry => {
      size += entry.uncompressedSize; count++;
      if (entry.fileName === 'word/document.xml') hasDocument = true;
      if (size > 24 * 1024 * 1024 || count > 500 || entry.generalPurposeBitFlag & 1) { zip.close(); reject(new Error('Archivio troppo grande o cifrato.')); return; }
      zip.readEntry();
    });
    zip.on('end', () => hasDocument ? resolve() : reject(new Error('DOCX non valido.')));
    zip.readEntry();
  }));
}
const maxPages = 500;
const maxCharacters = 1_000_000;
type Extraction = { pages: { page: number | null; content: string }[]; pageCount: number | null; note: string };
function limitText(extracted: Extraction): Extraction {
  let remaining = maxCharacters;
  let partial = false;
  const pages = extracted.pages.map(page => {
    const text = page.content.replaceAll('\0', '').toWellFormed();
    if (text.length > remaining) partial = true;
    const content = text.slice(0, remaining);
    remaining -= content.length;
    return { ...page, content };
  });
  return { ...extracted, pages, note: [extracted.note, partial ? 'Testo parziale: indicizzato il primo milione di caratteri. Dividi il file per leggere anche il resto.' : ''].filter(Boolean).join(' ') };
}
export async function extractDocument(buffer: Buffer, mime: string): Promise<Extraction> {
  if (mime.startsWith('image/')) return limitText({ ...await recognizeDocument(buffer), pageCount: null });
  if (mime === 'text/plain') return limitText({ pages: [{ page: null, content: buffer.toString('utf8') }], pageCount: null, note: '' });
  if (mime.endsWith('wordprocessingml.document')) {
    await validateZip(buffer);
    // extractRawText non converte HTML né risolve immagini/risorse esterne.
    const { value } = await extractRawText({ buffer });
    return limitText({ pages: [{ page: null, content: value }], pageCount: null, note: '' });
  }
  if (mime !== 'application/pdf') throw new ApiError(415, 'Formato non supportato.');
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { useSystemFonts: false });
  try {
    const pages: Extraction['pages'] = [];
    const notes: string[] = [];
    let total = 0;
    for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
      const page = await pdf.getPage(i);
      try {
        const text = await page.getTextContent();
        const content = text.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
        total += content.length;
        pages.push({ page: i, content });
      } finally { page.cleanup(); }
      if (total > maxCharacters) break;
    }
    if (pages.length < pdf.numPages) notes.push(`Lettura parziale: elaborate ${pages.length} di ${pdf.numPages} pagine (massimo 500 pagine / 1.000.000 caratteri). Dividi il file per leggere il resto.`);
    const scans = pages.filter(p => p.content.trim().length < 30).map(p => p.page!);
    if (scans.length) {
      const ocr = await recognizeDocument(buffer, scans);
      for (const read of ocr.pages) {
        const page = pages.find(p => p.page === read.page)!;
        if (read.content.length > page.content.trim().length) page.content = read.content;
      }
      if (ocr.note) notes.push(ocr.note);
    }
    return limitText({ pages, pageCount: pdf.numPages, note: notes.join(' ') });
  } finally { await pdf.loadingTask.destroy(); }
}
export async function processDocument(client: SupabaseClient, doc: Document, buffer: Buffer) {
  let indexing = false;
  try {
    const extracted = await extractDocument(buffer, doc.mime);
    const chunks: { content: string; page: number | null }[] = [];
    for (const page of extracted.pages) {
      const text = page.content.trim();
      for (let i = 0; i < text.length; i += 2500) chunks.push({ content: text.slice(i, i + 2800), page: page.page });
    }
    indexing = true;
    await checked(client.from('myai_document_chunks').delete().eq('document_id', doc.id));
    // Solo embeddings locali opzionali; mai un completamento DeepSeek al caricamento.
    const vectors = doc.scope === 'memory' ? await embeddings(chunks.map(ch => ch.content)) : chunks.map(() => null);
    if (chunks.length) await checked(client.from('myai_document_chunks').insert(chunks.map((ch, i) => ({ ...ch, document_id: doc.id, embedding: vectors[i] ? JSON.stringify(vectors[i]) : null }))));
    await checked(client.from('myai_documents').update({ status: chunks.length ? 'ready' : 'no_text', page_count: extracted.pageCount, error: extracted.note || (!chunks.length ? 'Nessun testo riconosciuto. Il file originale è conservato; una foto senza scritte richiede un modello con visione per essere descritta.' : null) }).eq('id', doc.id));
  } catch (error) {
    const kind = indexing ? 'indexing' : error instanceof Error && error.name === 'PasswordException' ? 'password' : 'unreadable';
    console.error('document_processing', kind); // Solo un codice, mai testo o metadati personali.
    await checked(client.from('myai_document_chunks').delete().eq('document_id', doc.id));
    const reason = kind === 'indexing' ? 'Testo letto, ma indicizzazione non riuscita. Usa Reindicizza per riprovare.' : kind === 'password' ? 'PDF protetto da password. Carica una copia sbloccata per leggerne il testo.' : 'File illeggibile o danneggiato. Prova a esportarlo nuovamente come PDF, DOCX o TXT.';
    await checked(client.from('myai_documents').update({ status: 'error', error: `${reason} L’originale è conservato e può essere scaricato.` }).eq('id', doc.id));
  }
  return checked(client.from('myai_documents').select('*').eq('id', doc.id).single()) as Promise<Document>;
}
export async function upload(client: SupabaseClient, userId: string, request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'File mancante.');
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maxSize + 65536) { await reader.cancel(); throw new ApiError(413, 'Massimo 10 MB per file.'); }
    parts.push(value);
  }
  const form = await new Response(Buffer.concat(parts), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > maxSize) throw new ApiError(400, 'Scegli un file non vuoto, massimo 10 MB.');
  const scope = form.get('scope');
  if (scope !== 'chat' && scope !== 'memory') throw new ApiError(400, 'Scegli dove conservare il file.');
  const category = categorySchema.parse(form.get('category'));
  const conversationId = form.get('conversation_id') ? uuid.parse(form.get('conversation_id')) : null;
  if (scope === 'chat' && !conversationId) throw new ApiError(400, 'Scegli una conversazione.');
  if (conversationId) await checked(client.from('myai_conversations').select('id').eq('id', conversationId).single());
  await checkSpace(client, file.size);
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectMime(buffer, file.name);
  if (mime.startsWith('image/')) {
    try { await sharp(buffer, imageOptions).resize({ width: 1, height: 1 }).toBuffer(); }
    catch { throw new ApiError(415, 'Immagine danneggiata o troppo grande (massimo 40 megapixel). Esportala come JPG, PNG, GIF o WebP.'); }
  }
  const id = crypto.randomUUID();
  const extension = file.name.split('.').pop()!.toLowerCase();
  const path = `${userId}/${id}.${extension}`;
  const { error: storageError } = await client.storage.from(bucket).upload(path, buffer, { contentType: mime, upsert: false, cacheControl: '0' });
  if (storageError) throw new ApiError(502, 'Caricamento non riuscito. Controlla il bucket privato Supabase.');
  let doc: Document;
  try {
    doc = await checked(client.from('myai_documents').insert({ id, conversation_id: conversationId, scope, category, title: file.name.slice(0, 150), filename: file.name.slice(0, 250), mime, path, size_bytes: file.size }).select('*').single()) as Document;
  } catch (error) { await client.storage.from(bucket).remove([path]); throw error; }
  return processDocument(client, doc, buffer);
}
export async function fileLink(client: SupabaseClient, id: string, download = false) {
  const doc = await checked(client.from('myai_documents').select('*').eq('id', id).single()) as Document;
  // Storage è sulla LAN: il browser pubblico deve passare dal BFF autenticato.
  return { url: `/api/documents/${doc.id}/file${download ? '?download=1' : ''}`, document: doc };
}
export async function originalFile(client: SupabaseClient, id: string, download = false, range: string | null = null, signal?: AbortSignal) {
  const { document: doc } = await fileLink(client, id);
  if (doc.mime === 'video/mp4' && !download) return videoFile(client, doc, range, signal);
  const { data, error } = await client.storage.from(bucket).download(doc.path);
  if (error || !data) throw new ApiError(502, 'File originale non disponibile.');
  const inline = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(doc.mime) && !download;
  const filename = encodeURIComponent(doc.filename.toWellFormed()).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
  return new Response(data, { headers: { 'Content-Type': inline ? doc.mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="documento"; filename*=UTF-8''${filename}`, 'Cache-Control': 'no-store, private', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
}
export async function imageForAI(client: SupabaseClient, id: string) {
  const { document: doc } = await fileLink(client, id);
  if (!doc.mime.startsWith('image/')) throw new ApiError(415, 'Scegli un’immagine.');
  const { data, error } = await client.storage.from(bucket).download(doc.path);
  if (error || !data) throw new ApiError(502, 'Immagine non disponibile.');
  const image = await sharp(Buffer.from(await data.arrayBuffer()), imageOptions).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  // Solo su invio AI esplicito con visione configurata: nessun URL privato irraggiungibile dal provider.
  return `data:image/jpeg;base64,${image.toString('base64')}`;
}
export async function removeDocuments(client: SupabaseClient, docs: Pick<Document, 'id' | 'path'>[]) {
  for (let i = 0; i < docs.length; i += 100) {
    const group = docs.slice(i, i + 100);
    const { error } = await client.storage.from(bucket).remove(group.map(d => d.path));
    if (error) throw new ApiError(502, 'Eliminazione dei file non riuscita; i riferimenti sono conservati per riprovare.');
    await checked(client.from('myai_wishes').update({ image_document_id: null }).in('image_document_id', group.map(d => d.id)));
    await checked(client.from('myai_documents').delete().in('id', group.map(d => d.id)));
  }
}
export async function purgeStorage(client: SupabaseClient, userId: string) {
  // Include anche orfani di upload interrotti. Il prefisso deriva solo da auth.getUser().
  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(userId, { limit: 100 });
    if (error) throw new ApiError(502, 'Pulizia archivio non riuscita. Riprova.');
    if (!data?.length) break;
    const { error: removeError } = await client.storage.from(bucket).remove(data.map(f => `${userId}/${f.name}`));
    if (removeError) throw new ApiError(502, 'Pulizia archivio non riuscita. Riprova.');
  }
}
