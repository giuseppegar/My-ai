import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document } from '@/lib/domain';
import { byteRange, videoFile } from '@/server/video-file';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('riproduzione MP4 privata, streaming e Range per Safari', () => {
  it('gestisce range normali, aperti e suffix; rifiuta range multipli o impossibili', () => {
    expect(byteRange('bytes=0-1',100)).toEqual({ start:0,end:1 });
    expect(byteRange('bytes=10-',100)).toEqual({ start:10,end:99 });
    expect(byteRange('bytes=-20',100)).toEqual({ start:80,end:99 });
    expect(byteRange('bytes=90-200',100)).toEqual({ start:90,end:99 });
    for (const value of ['bytes=200-','bytes=10-9','bytes=0-1,5-6','bytes=-0','bytes=-','bytes=Infinity-']) expect(byteRange(value,100)).toBeNull();
  });
  const doc = { id:'video',mime:'video/mp4',path:'user/video.mp4',size_bytes:100 } as unknown as Document;
  const clientFor = (url = 'http://storage.internal:8000/storage/v1/object/sign/myai-private/user/video.mp4?token=private-token') => ({ storage: { from: () => ({ createSignedUrl: vi.fn(async () => ({ data:{ signedUrl:url },error:null })) }) } }) as unknown as SupabaseClient;
  it('inoltra solo il range, non espone URL firmati e non carica l’intero file in RAM', async () => {
    vi.stubEnv('SUPABASE_URL','http://storage.internal:8000');
    vi.stubGlobal('fetch',vi.fn(async (url: URL, init: RequestInit) => {
      expect(url.origin).toBe('http://storage.internal:8000');
      expect(init.headers).toEqual({ Range:'bytes=0-1' }); expect(init.redirect).toBe('error');
      return new Response(new Uint8Array([0,0]),{ status:206,headers:{ 'Content-Range':'bytes 0-1/100' } });
    }));
    const response = await videoFile(clientFor(),doc,'bytes=0-1');
    expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 0-1/100');
    expect(response.headers.get('content-type')).toBe('video/mp4'); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('vary')).toBe('Cookie'); expect(JSON.stringify([...response.headers])).not.toContain('private-token');
    expect((await response.arrayBuffer()).byteLength).toBe(2);
  });
  it('range invalido non apre lo storage e URL firmati su host inattesi sono bloccati', async () => {
    vi.stubEnv('SUPABASE_URL','http://storage.internal:8000');
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    const response = await videoFile(clientFor(),doc,'bytes=1000-');
    expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */100');
    await expect(videoFile(clientFor('http://attacker.invalid/secret'),doc,null)).rejects.toMatchObject({ status:502 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('non restituisce un falso 206 se lo storage ignora il range', async () => {
    vi.stubEnv('SUPABASE_URL','http://storage.internal:8000');
    vi.stubGlobal('fetch',vi.fn(async () => new Response(new Uint8Array(100))));
    await expect(videoFile(clientFor(),doc,'bytes=0-1')).rejects.toMatchObject({ status:502 });
  });
});
