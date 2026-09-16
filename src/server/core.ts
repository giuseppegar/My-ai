import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import type { Capabilities } from '@/lib/domain';
import { hasExpectedInstance } from '@/server/instance';
import { videoConfig } from './video-config';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function capabilities(): Capabilities {
  const video = videoConfig();
  return { configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_INSTANCE_ID), ai: Boolean(process.env.DEEPSEEK_API_KEY), embeddings: Boolean(process.env.OLLAMA_BASE_URL), vision: Boolean(process.env.DEEPSEEK_API_KEY) && process.env.DEEPSEEK_VISION === 'true', ocr: process.env.DOCUMENT_OCR_ENABLED === 'true', web: Boolean(process.env.TAVILY_API_KEY || (process.env.WEB_SEARCH_PROVIDER === 'openrouter' && (process.env.OPENROUTER_API_KEY || process.env.IMAGE_API_KEY))), webProvider: process.env.WEB_SEARCH_PROVIDER === 'openrouter' ? 'openrouter' : 'tavily', images: Boolean(process.env.IMAGE_API_KEY), imageModel: process.env.IMAGE_MODEL || 'gpt-image-1', videos: video.enabled, videoModel: video.model, videoDuration: video.duration, videoResolution: video.resolution, accountDeletion: Boolean(process.env.SUPABASE_INSTANCE_ID && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ALLOW_AUTH_ACCOUNT_DELETION === 'true'), model: process.env.DEEPSEEK_MODEL || 'deepseek-flash' };
}
export function numberEnv(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
export function appOrigin() {
  return new URL(process.env.APP_URL || 'http://localhost:3000').origin;
}
export function appOrigins() {
  const raw = process.env.APP_ORIGINS || process.env.APP_URL || '';
  return [...new Set(raw.split(',').map(o => { try { return new URL(o.trim()).origin; } catch { return ''; } }).filter(Boolean))];
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !appOrigins().includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'Origine della richiesta non autorizzata. Controlla APP_URL/APP_ORIGINS.');
}
export async function db() {
  if (!capabilities().configured) throw new ApiError(503, 'Collega Supabase per usare il tuo spazio personale.');
  const isolated = await hasExpectedInstance({ url: process.env.SUPABASE_URL!, anonKey: process.env.SUPABASE_ANON_KEY!, instanceId: process.env.SUPABASE_INSTANCE_ID! });
  if (!isolated) throw new ApiError(503, 'Non riesco a verificare il Supabase dedicato a My ai. Accesso bloccato per proteggere le altre app: controlla la configurazione e la connessione.');
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookieOptions: { name: process.env.SUPABASE_AUTH_COOKIE_NAME || 'myai-auth-token', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: { getAll: () => jar.getAll(), setAll: list => list.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })) },
  });
}
export async function authenticated() {
  const client = await db();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new ApiError(401, 'Accedi per continuare.');
  return { client, user };
}
export function adminForAccountDeletion() {
  if (!capabilities().accountDeletion) throw new ApiError(503, 'Eliminazione account non configurata. Contatta l’amministratore.');
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function checked<T>(query: PromiseLike<{ data: T; error: { code?: string; message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error) {
    // JWT non valido, non cache schema: non ritentare automaticamente operazioni di scrittura.
    if (error.code === 'PGRST301' || error.code === 'PGRST303') throw new ApiError(401, 'Sessione non valida o scaduta. Accedi di nuovo.');
    if (error.code === 'PGRST116') throw new ApiError(404, 'Contenuto non trovato nel tuo spazio.');
    console.error('database_error', error.code || 'unknown'); // Mai contenuti, query, email o segreti.
    throw new ApiError(500, 'Operazione non riuscita. Controlla la configurazione del database e riprova.');
  }
  return data as NonNullable<T>;
}
export const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie' } });
export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message || 'Dati non validi.' }, 400);
  if (error instanceof SyntaxError) return json({ error: 'Formato della richiesta non valido.' }, 400);
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return json({ error: 'Richiesta interrotta o tempo disponibile esaurito.' }, 408);
  console.error('app_error', error instanceof Error ? error.name : 'unknown');
  return json({ error: 'Qualcosa non ha funzionato. Riprova tra poco.' }, 500);
}
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Invia JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Richiesta vuota.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 100_000) { await reader.cancel(); throw new ApiError(413, 'Richiesta troppo grande.'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export async function quota(client: SupabaseClient) {
  const allowed = await checked(client.rpc('myai_consume_call', { max_calls: numberEnv('AI_DAILY_CALL_LIMIT', 50, 1, 100) }));
  if (!allowed) throw new ApiError(429, 'Hai raggiunto il limite giornaliero di chiamate AI. Il tuo lavoro è conservato.');
}
