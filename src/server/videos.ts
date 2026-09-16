import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Document, VideoJob } from '@/lib/domain';
import { videoSchema } from '@/lib/validation';
import { ApiError, checked, numberEnv } from './core';
import { checkSpace } from './files';
import { openrouterVideoKey, videoConfig } from './video-config';

const base = 'https://openrouter.ai/api/v1';
export const maxVideoBytes = 50 * 1024 * 1024;
export const videoColumns = 'id,conversation_id,prompt,category,model,duration,resolution,aspect_ratio,status,document_id,cost,error,created_at';
type StoredJob = VideoJob & { user_id: string; provider_id: string | null; provider_signature: string | null; lease: string | null };
const providerJobSchema = z.object({ id: z.string().min(1).max(500).regex(/^[a-zA-Z0-9_-]+$/), status: z.enum(['pending','in_progress','completed','failed','cancelled','expired']), usage: z.object({ cost: z.number().finite().nonnegative().optional() }).optional() });

export function publicVideo(job: StoredJob): VideoJob {
  return Object.fromEntries(videoColumns.split(',').map(key => [key, job[key as keyof StoredJob]])) as VideoJob;
}
export function videoProof(userId: string, id: string, providerId: string) {
  const key = openrouterVideoKey();
  if (!key) throw new ApiError(503, 'La chiave OpenRouter per i video non è configurata.');
  return createHmac('sha256', key).update(JSON.stringify([userId, id, providerId])).digest('hex');
}
export function verifyVideoProof(job: Pick<StoredJob, 'user_id' | 'id' | 'provider_id' | 'provider_signature'>) {
  if (!job.provider_id || !job.provider_signature) throw new ApiError(409, 'Invio video non confermato. Non ripetere la generazione: verifica prima il portale OpenRouter.');
  const expected = Buffer.from(videoProof(job.user_id, job.id, job.provider_id));
  const actual = Buffer.from(job.provider_signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(403, 'Job video non verificabile. Controlla la chiave OpenRouter con l’amministratore.');
}
export async function readVideoBody(response: Response, maxBytes = maxVideoBytes): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, 'Contenuto del provider assente.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(response.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'Video troppo grande per l’archivio (massimo 50 MB).');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new ApiError(413, 'Contenuto del provider troppo grande. Nessun file parziale salvato.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function providerRequest(path: string, body?: object, timeout = 30_000) {
  const key = openrouterVideoKey();
  if (!key) throw new ApiError(503, 'La chiave OpenRouter per i video non è configurata.');
  // Host fisso; mai seguire polling_url/unsigned_urls o redirect con la nostra chiave.
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeout),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ApiError(response.status, response.status === 402 ? 'Credito OpenRouter insufficiente per i video.' : response.status === 401 ? 'Chiave OpenRouter non valida per i video.' : response.status === 400 || response.status === 403 ? 'OpenRouter ha rifiutato il video. Controlla modello, parametri, policy e impostazioni ZDR sul portale.' : 'Servizio video OpenRouter temporaneamente non disponibile.');
  }
  return response;
}
async function providerJob(response: Response) { return providerJobSchema.parse(JSON.parse((await readVideoBody(response, 1_000_000)).toString('utf8'))); }
export async function validateVideoModel(config: ReturnType<typeof videoConfig>) {
  const response = await providerRequest('/videos/models');
  const catalog = z.object({ data: z.array(z.object({ id: z.string(), supported_durations: z.array(z.number()).nullable(), supported_resolutions: z.array(z.string()).nullable(), supported_aspect_ratios: z.array(z.string()).nullable() })) }).parse(JSON.parse((await readVideoBody(response, 2_000_000)).toString('utf8')));
  const model = catalog.data.find(m => m.id === config.model);
  if (!model?.supported_durations?.includes(config.duration) || !model.supported_resolutions?.includes(config.resolution) || !model.supported_aspect_ratios?.includes(config.aspectRatio)) throw new ApiError(503, 'Modello o parametri video non presenti nel catalogo OpenRouter. L’amministratore deve aggiornare la configurazione. Nessuna generazione avviata.');
}
async function getJob(client: SupabaseClient, id: string) {
  return await checked(client.from('myai_video_jobs').select('*').eq('id', id).single()) as StoredJob;
}
export async function startVideo(client: SupabaseClient, userId: string, raw: unknown): Promise<VideoJob> {
  const input = videoSchema.parse(raw);
  const existing = await checked(client.from('myai_video_jobs').select('*').eq('id', input.request_id).maybeSingle()) as StoredJob | null;
  if (existing) {
    if (existing.conversation_id !== input.conversation_id || existing.prompt !== input.prompt || existing.category !== input.category) throw new ApiError(409, 'Questa richiesta video esiste già con un altro contenuto.');
    return publicVideo(existing);
  }
  const config = videoConfig();
  if (!config.enabled) throw new ApiError(503, 'La generazione video non è configurata: servono OpenRouter e VIDEO_ENABLED.');
  await checked(client.from('myai_conversations').select('id').eq('id', input.conversation_id).single());
  await checkSpace(client, maxVideoBytes); // Prima di una chiamata a pagamento.
  await validateVideoModel(config);
  const lease = crypto.randomUUID();
  const result = await client.rpc('myai_start_video', { job_id: input.request_id, conversation: input.conversation_id, request_prompt: input.prompt, request_category: input.category, request_model: config.model, seconds: config.duration, pixels: config.resolution, ratio: config.aspectRatio, submit_lease: lease, max_calls: Math.floor(numberEnv('VIDEO_DAILY_LIMIT', 2, 1, 10)) });
  if (result.error?.message.includes('video_daily_limit')) throw new ApiError(429, 'Hai raggiunto il limite giornaliero di video. Riprova domani.');
  const rows = await checked(Promise.resolve(result)) as StoredJob[];
  const job = rows[0];
  if (!job) throw new ApiError(404, 'Richiesta video non disponibile nel tuo spazio.');
  if (job.lease !== lease) return publicVideo(job); // Un altro invio HTTP ha già acquisito questo job.
  let provider;
  try {
    provider = await providerJob(await providerRequest('/videos', { model: config.model, prompt: input.prompt, duration: config.duration, resolution: config.resolution, aspect_ratio: config.aspectRatio, generate_audio: false }));
  } catch (error) {
    const rejected = error instanceof ApiError && [400,401,402,403,404,413,429].includes(error.status);
    const message = rejected ? error.message : 'Esito dell’invio non certo: OpenRouter potrebbe aver addebitato la richiesta. Nessun reinvio automatico; verifica il portale prima di generarne un’altra.';
    return publicVideo(await checked(client.from('myai_video_jobs').update({ status: rejected ? 'failed' : 'uncertain', error: message, lease: null }).eq('id', job.id).eq('lease', lease).select('*').single()) as StoredJob);
  }
  // Se questa scrittura fallisce, NON inviare nuovamente al provider. La lease resta in "submitting".
  return publicVideo(await checked(client.from('myai_video_jobs').update({ provider_id: provider.id, provider_signature: videoProof(userId, job.id, provider.id), status: ['failed','cancelled','expired'].includes(provider.status) ? 'failed' : 'pending', error: ['failed','cancelled','expired'].includes(provider.status) ? 'Il provider non ha completato il video.' : null, lease: null }).eq('id', job.id).eq('lease', lease).select('*').single()) as StoredJob);
}

async function saveVideoFile(client: SupabaseClient, job: StoredJob): Promise<Document> {
  // Ripresa dopo crash tra inserimento del documento e completamento del job.
  const existing = await checked(client.from('myai_documents').select('*').eq('id', job.id).maybeSingle()) as Document | null;
  if (existing) return existing;
  const response = await providerRequest(`/videos/${encodeURIComponent(job.provider_id!)}/content?index=0`, undefined, 60_000);
  if (!/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new ApiError(415, 'OpenRouter non ha restituito un video MP4.'); }
  const bytes = await readVideoBody(response);
  if (bytes.length < 12 || bytes.subarray(4,8).toString() !== 'ftyp') throw new ApiError(502, 'Video MP4 ricevuto non valido.');
  await checkSpace(client, bytes.length);
  const path = `${job.user_id}/${job.id}.mp4`;
  const { error } = await client.storage.from('myai-private').upload(path, bytes, { contentType: 'video/mp4', upsert: false, cacheControl: '0' });
  // Percorso deterministico: un upload completato prima di un crash non richiede overwrite.
  if (error && String((error as { statusCode?: string }).statusCode) !== '409') throw new ApiError(502, 'Salvataggio video non riuscito. Il job è conservato: riprova il controllo stato, non la generazione.');
  return await checked(client.from('myai_documents').insert({ id: job.id, conversation_id: job.conversation_id, scope: 'memory', category: job.category, title: job.prompt.slice(0,150), filename: 'video-generato.mp4', mime: 'video/mp4', origin: 'generated', status: 'ready', path, size_bytes: bytes.length }).select('*').single()) as Document;
}
export async function refreshVideo(client: SupabaseClient, id: string): Promise<VideoJob> {
  const initial = await getJob(client, id);
  if (initial.status === 'submitting' && Date.now() - Date.parse(initial.created_at) > 5 * 60_000) {
    const changed = await checked(client.from('myai_video_jobs').update({ status: 'uncertain', lease: null, error: 'Conferma dell’invio non recuperata. OpenRouter potrebbe aver addebitato il video: verifica il portale prima di riprovare.' }).eq('id', id).eq('status', 'submitting').select('*').maybeSingle()) as StoredJob | null;
    return publicVideo(changed || await getJob(client, id));
  }
  if (!['pending','in_progress'].includes(initial.status)) return publicVideo(initial);
  verifyVideoProof(initial); // Rifiuta provider_id manomessi anche da chi può scrivere le proprie righe via RLS.
  const claimed = await checked(client.rpc('myai_claim_video', { job_id: id })) as StoredJob[];
  const job = claimed[0];
  if (!job) return publicVideo(await getJob(client, id));
  const update = async (patch: object) => publicVideo(await checked(client.from('myai_video_jobs').update({ ...patch, lease: null, poll_after: new Date(Date.now() + 30_000).toISOString() }).eq('id', id).eq('lease', job.lease!).select('*').single()) as StoredJob);
  try {
    verifyVideoProof(job);
    const state = await providerJob(await providerRequest(`/videos/${encodeURIComponent(job.provider_id!)}`));
    if (state.id !== job.provider_id) throw new ApiError(502, 'Risposta video non corrispondente al job richiesto.');
    if (['failed','cancelled','expired'].includes(state.status)) return await update({ status: 'failed', error: 'Il provider ha terminato il job senza un video disponibile. Controlla il portale OpenRouter prima di riprovare.' });
    if (state.status !== 'completed') return await update({ status: state.status, error: null });
    const doc = await saveVideoFile(client, job);
    return await update({ status: 'completed', document_id: doc.id, cost: state.usage?.cost ?? null, error: null });
  } catch (error) {
    // Errori di rete/storage non avviano mai una seconda generazione e non perdono l'ID upstream.
    return await update({ error: error instanceof ApiError ? error.message : 'Controllo o salvataggio video non riuscito. Il job è conservato; riproveremo senza generare un altro video.' });
  }
}
