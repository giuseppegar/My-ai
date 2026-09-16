import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document } from '@/lib/domain';
import { ApiError } from './core';

export function byteRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (![start,end].every(Number.isSafeInteger) || start < 0 || start >= size || end < start) return null;
  return { start, end };
}
export async function videoFile(client: SupabaseClient, doc: Document, range: string | null, signal?: AbortSignal) {
  const size = Number((doc as Document & { size_bytes: number }).size_bytes);
  if (!Number.isSafeInteger(size) || size < 1 || size > 50 * 1024 * 1024) throw new ApiError(502, 'Dimensione video non valida.');
  const headers: Record<string, string> = { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store, private', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
  const part = range ? byteRange(range, size) : null;
  if (range && !part) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  // Firma breve usata SOLO dal server: nessun URL LAN o token storage consegnato al browser.
  const storageUrl = process.env.SUPABASE_URL;
  if (!storageUrl) throw new ApiError(503, 'Archivio non configurato.');
  const { data, error } = await client.storage.from('myai-private').createSignedUrl(doc.path, 60);
  if (error || !data?.signedUrl) throw new ApiError(502, 'Video originale non disponibile.');
  const source = new URL(data.signedUrl);
  const expected = new URL(storageUrl);
  if (source.origin !== expected.origin || !source.pathname.startsWith('/storage/v1/object/sign/myai-private/')) throw new ApiError(502, 'Collegamento storage video non valido.');
  const upstream = await fetch(source, { redirect: 'error', cache: 'no-store', headers: part ? { Range: `bytes=${part.start}-${part.end}` } : {}, signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]) });
  const wanted = part ? part.end - part.start + 1 : size;
  if (!upstream.ok || (part && (upstream.status !== 206 || upstream.headers.get('content-range') !== `bytes ${part.start}-${part.end}/${size}`))) {
    await upstream.body?.cancel();
    throw new ApiError(502, 'L’archivio non ha restituito il segmento video richiesto.');
  }
  const declared = upstream.headers.get('content-length');
  if (!part && declared && Number(declared) !== size) { await upstream.body?.cancel(); throw new ApiError(502, 'Dimensione video diversa da quella registrata: file non servito.'); }
  headers['Content-Length'] = String(wanted);
  if (part) headers['Content-Range'] = `bytes ${part.start}-${part.end}/${size}`;
  let sent = 0;
  const body = upstream.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      sent += chunk.length;
      if (sent > wanted) { controller.error(new Error('Video stream exceeds requested range')); return; }
      controller.enqueue(chunk);
    },
    flush(controller) { if (sent !== wanted) controller.error(new Error('Incomplete video stream')); },
  }));
  return new Response(body, { status: part ? 206 : 200, headers });
}
