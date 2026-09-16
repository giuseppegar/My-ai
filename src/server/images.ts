import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { Category, Document } from '@/lib/domain';
import { ApiError, capabilities, checked, numberEnv } from './core';
import { imageOptions } from './ocr';
import { checkSpace } from './files';
import { safeFetchBinary } from './web';

// Solo testo → immagine, un'immagine per richiesta. Il provider riceve esclusivamente il prompt
// (che può contenere dati personali), senza cronologia o allegati, solo su richiesta esplicita.
export async function generateImage(client: SupabaseClient, userId: string, prompt: string, conversationId: string, category: Category): Promise<Document> {
  if (!capabilities().images) throw new ApiError(503, 'La generazione immagini non è configurata (serve IMAGE_API_KEY).');
  const allowed = await checked(client.rpc('myai_consume_image', { max_calls: numberEnv('IMAGE_DAILY_LIMIT', 5, 1, 20) }));
  if (!allowed) throw new ApiError(429, 'Hai raggiunto il limite giornaliero di immagini. Riprova domani.');
  const response = await fetch(`${(process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(90_000),
    headers: { Authorization: `Bearer ${process.env.IMAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: capabilities().imageModel, prompt: prompt.slice(0, 500), n: 1, size: process.env.IMAGE_SIZE || '1024x1024', response_format: 'b64_json' }),
  });
  if (!response.ok) throw new ApiError(response.status === 402 ? 402 : 502, response.status === 402 ? 'Credito insufficiente per le immagini. Controlla il tuo account del provider.' : 'Il servizio immagini non ha completato la richiesta. Riprova tra poco.');
  const data = await response.json();
  const first: { b64_json?: string; url?: string } | undefined = data?.data?.[0];
  let received: Buffer;
  if (typeof first?.b64_json === 'string' && first.b64_json.length > 100) received = Buffer.from(first.b64_json, 'base64');
  else if (typeof first?.url === 'string') received = await safeFetchBinary(first.url, /^image\//i).catch(() => { throw new ApiError(502, 'Il provider ha restituito un collegamento non raggiungibile.'); });
  else throw new ApiError(502, 'Il servizio immagini non ha restituito un’immagine valida.');
  let png: Buffer;
  try { png = await sharp(received, imageOptions).rotate().resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).png().toBuffer(); }
  catch { throw new ApiError(502, 'Immagine ricevuta danneggiata. Riprova con un altro prompt.'); }
  if (png.length > 10 * 1024 * 1024) throw new ApiError(413, 'Immagine generata troppo grande.');
  await checkSpace(client, png.length);
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.png`;
  const { error: storageError } = await client.storage.from('myai-private').upload(path, png, { contentType: 'image/png', upsert: false, cacheControl: '0' });
  if (storageError) throw new ApiError(502, 'Salvataggio dell’immagine non riuscito. Controlla il bucket privato Supabase.');
  try {
    return await checked(client.from('myai_documents').insert({ id, conversation_id: conversationId, scope: 'memory', category, title: prompt.slice(0, 150), filename: 'immagine-generata.png', mime: 'image/png', origin: 'generated', status: 'ready', path, size_bytes: png.length }).select('*').single()) as Document;
  } catch (error) { await client.storage.from('myai-private').remove([path]); throw error; }
}
