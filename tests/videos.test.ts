import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { maxVideoBytes, publicVideo, readVideoBody, refreshVideo, startVideo, videoProof, verifyVideoProof } from '@/server/videos';
import { openrouterVideoKey } from '@/server/video-config';

const user = '11111111-1111-4111-8111-111111111111';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const input = { request_id: id, conversation_id: conversation, category: 'capire', prompt: 'Un faro sul mare', confirmed: true };
const catalog = { data: [{ id: 'google/veo-3.1-lite', supported_durations: [4,6,8], supported_resolutions: ['720p'], supported_aspect_ratios: ['16:9'] }] };
const mp4 = Buffer.from('000000186674797069736f6d0000000069736f6d6d703432', 'hex');
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Row = Record<string, unknown>;
function clientFixture() {
  const rows: Record<string, Row[]> = { myai_conversations: [{ id: conversation }], myai_documents: [], myai_video_jobs: [] };
  const upload = vi.fn(async () => ({ error: null as { statusCode: string } | null }));
  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let action = 'select'; let values: Row = {};
    const execute = () => {
      const tableRows = rows[table] || [];
      let selected = tableRows.filter(row => filters.every(f => f(row)));
      if (action === 'insert') { tableRows.push(values); selected = [values]; }
      if (action === 'update') selected.forEach(row => Object.assign(row, values));
      return selected.map(row => ({ ...row }));
    };
    const q = {
      select: () => q, limit: () => q,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q; },
      insert: (data: Row) => { values = data; action = 'insert'; return q; },
      update: (data: Row) => { values = data; action = 'update'; return q; },
      maybeSingle: async () => ({ data: execute()[0] || null, error: null }),
      single: async () => { const data = execute()[0]; return { data: data || null, error: data ? null : { code: 'PGRST116', message: 'not found' } }; },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: execute(), error: null }).then(resolve),
    };
    return q;
  };
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === 'myai_start_video') {
      let job = rows.myai_video_jobs.find(j => j.id === args.job_id);
      if (!job) {
        job = { id: args.job_id, user_id: user, conversation_id: args.conversation, prompt: args.request_prompt, category: args.request_category, model: args.request_model, duration: args.seconds, resolution: args.pixels, aspect_ratio: args.ratio, status: 'submitting', lease: args.submit_lease, provider_id: null, provider_signature: null, document_id: null, error: null, cost: null, created_at: new Date().toISOString() };
        rows.myai_video_jobs.push(job);
      }
      return { data: [{ ...job }], error: null };
    }
    const job = rows.myai_video_jobs.find(j => j.id === args.job_id);
    if (!job || job.lease) return { data: [], error: null };
    job.lease = 'poll-lease';
    return { data: [{ ...job }], error: null };
  });
  return { client: { from, rpc, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient, rows, rpc, upload };
}
function pending(fixture: ReturnType<typeof clientFixture>) {
  fixture.rows.myai_video_jobs.push({ id, user_id: user, conversation_id: conversation, prompt: input.prompt, category: 'capire', model: 'google/veo-3.1-lite', duration: 4, resolution: '720p', aspect_ratio: '16:9', status: 'pending', provider_id: 'provider-1', provider_signature: videoProof(user,id,'provider-1'), lease: null, document_id: null, error: null, cost: null, created_at: new Date().toISOString() });
}
beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-only-openrouter-secret'); vi.stubEnv('VIDEO_ENABLED','true'); vi.stubEnv('VIDEO_MODEL','google/veo-3.1-lite'); vi.stubEnv('VIDEO_DURATION_SECONDS','4'); vi.stubEnv('VIDEO_RESOLUTION','720p'); vi.stubEnv('VIDEO_ASPECT_RATIO','16:9'); vi.stubEnv('IMAGE_API_KEY','');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('OpenRouter video: contratto verificato, nessuna chiamata reale a pagamento', () => {
  it('invia solo il prompt confermato e rende i retry idempotenti, senza esporre ID/provider proof', async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url.startsWith('https://openrouter.ai/api/v1/videos')).toBe(true);
      expect(init.redirect).toBe('error');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer test-only-openrouter-secret' });
      if (url.endsWith('/models')) return reply(catalog);
      expect(JSON.parse(String(init.body))).toEqual({ model: 'google/veo-3.1-lite', prompt: input.prompt, duration: 4, resolution: '720p', aspect_ratio: '16:9', generate_audio: false });
      return reply({ id: 'provider-1', status: 'pending', polling_url: 'https://attacker.invalid/steal' }, 202);
    });
    vi.stubGlobal('fetch', fetcher);
    const f = clientFixture();
    const first = await startVideo(f.client, user, input);
    expect(first.status).toBe('pending');
    expect(first).not.toHaveProperty('provider_id'); expect(first).not.toHaveProperty('provider_signature'); expect(first).not.toHaveProperty('user_id');
    expect(await startVideo(f.client, user, input)).toEqual(first);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(startVideo(f.client, user, { ...input, prompt: 'Un altro prompt' })).rejects.toMatchObject({ status: 409 });
  });
  it('rifiuta assenza di conferma, configurazione, proprietà altrui e modello inesistente prima della generazione', async () => {
    const fetcher = vi.fn(async () => reply(catalog)); vi.stubGlobal('fetch', fetcher);
    const f = clientFixture();
    await expect(startVideo(f.client,user,{ ...input, confirmed: false })).rejects.toThrow();
    await expect(startVideo(f.client,user,{ ...input, provider_id: 'forged' })).rejects.toThrow();
    vi.stubEnv('VIDEO_ENABLED','false');
    await expect(startVideo(f.client,user,input)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv('VIDEO_ENABLED','true');
    await expect(startVideo(f.client,user,{ ...input, conversation_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).rejects.toMatchObject({ status: 404 });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv('VIDEO_MODEL','modello-inesistente');
    await expect(startVideo(f.client,user,input)).rejects.toMatchObject({ status: 503 });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('verifica spazio prima del consumo e segnala quota esaurita senza chiamata video', async () => {
    const fetcher = vi.fn(async () => reply(catalog)); vi.stubGlobal('fetch',fetcher);
    const f = clientFixture(); f.rows.myai_documents.push({ size_bytes: 240 * 1024 * 1024 });
    await expect(startVideo(f.client,user,input)).rejects.toMatchObject({ status: 413 });
    expect(fetcher).not.toHaveBeenCalled();
    f.rows.myai_documents = [];
    f.rpc.mockImplementation(async () => ({ data: null, error: { message: 'video_daily_limit' } }) as never);
    await expect(startVideo(f.client,user,input)).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([402, 503])('errore provider %i: nessun retry automatico o risultato inventato', async status => {
    const fetcher = vi.fn(async (url: string) => url.endsWith('/models') ? reply(catalog) : reply({ error: 'private upstream payload' },status));
    vi.stubGlobal('fetch',fetcher);
    const f = clientFixture(); const job = await startVideo(f.client,user,input);
    expect(job.status).toBe(status === 402 ? 'failed' : 'uncertain');
    expect(job.error).not.toContain('private upstream');
    await startVideo(f.client,user,input);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(f.upload).not.toHaveBeenCalled();
  });
  it('timeout di invio persistito come incerto e mai ripetuto automaticamente', async () => {
    vi.stubGlobal('fetch',vi.fn(async (url: string) => { if (url.endsWith('/models')) return reply(catalog); throw new DOMException('timeout','TimeoutError'); }));
    const f = clientFixture();
    expect((await startVideo(f.client,user,input)).status).toBe('uncertain');
    await startVideo(f.client,user,input);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('non accetta la chiave immagini di un altro provider', () => {
    vi.stubEnv('OPENROUTER_API_KEY',''); vi.stubEnv('IMAGE_API_KEY','image-only-secret'); vi.stubEnv('IMAGE_BASE_URL','https://api.openai.com/v1');
    expect(openrouterVideoKey()).toBe('');
    vi.stubEnv('IMAGE_BASE_URL','https://openrouter.ai/api/v1');
    expect(openrouterVideoKey()).toBe('image-only-secret');
  });
  it('poll/download su host fisso, file privato idempotente e costo reale dal provider', async () => {
    const f = clientFixture(); pending(f);
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/provider-1')) return reply({ id: 'provider-1', status: 'completed', unsigned_urls: ['http://127.0.0.1/secret'], usage: { cost: 0.12 } });
      expect(url).toBe('https://openrouter.ai/api/v1/videos/provider-1/content?index=0');
      return new Response(mp4, { headers: { 'Content-Type': 'video/mp4' } });
    });
    vi.stubGlobal('fetch',fetcher);
    const result = await refreshVideo(f.client,id);
    expect(result).toMatchObject({ status: 'completed', document_id: id, cost: 0.12 });
    expect(f.rows.myai_documents).toHaveLength(1);
    expect(f.rows.myai_documents[0]).toMatchObject({ scope: 'memory', mime: 'video/mp4', origin: 'generated', status: 'ready' });
    expect(f.upload).toHaveBeenCalledWith(`${user}/${id}.mp4`,mp4,{ contentType: 'video/mp4', upsert: false, cacheControl: '0' });
    await refreshVideo(f.client,id);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('job manomessi o altrui non inviano credenziali né interrogano il provider', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    const f = clientFixture();
    await expect(refreshVideo(f.client,id)).rejects.toMatchObject({ status: 404 });
    pending(f); f.rows.myai_video_jobs[0].provider_id = 'another-users-job';
    await expect(refreshVideo(f.client,id)).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
    const proof = videoProof(user,id,'provider-1');
    expect(() => verifyVideoProof({ user_id: 'other', id, provider_id: 'provider-1', provider_signature: proof })).toThrow();
    expect(publicVideo(f.rows.myai_video_jobs[0] as never)).not.toHaveProperty('provider_signature');
  });
  it('lease polling impedisce scaricamenti simultanei e fallimenti terminali non producono file', async () => {
    const f = clientFixture(); pending(f); f.rows.myai_video_jobs[0].lease = 'other-worker';
    const fetcher = vi.fn(async () => reply({ id: 'provider-1', status: 'failed', error: 'provider secret' })); vi.stubGlobal('fetch',fetcher);
    expect((await refreshVideo(f.client,id)).status).toBe('pending'); expect(fetcher).not.toHaveBeenCalled();
    f.rows.myai_video_jobs[0].lease = null;
    expect((await refreshVideo(f.client,id)).status).toBe('failed'); expect(f.upload).not.toHaveBeenCalled();
  });
  it('errore storage resta recuperabile senza generare un nuovo video', async () => {
    const f = clientFixture(); pending(f);
    vi.stubGlobal('fetch',vi.fn(async (url: string) => url.endsWith('/provider-1') ? reply({ id: 'provider-1', status: 'completed' }) : new Response(mp4,{ headers: { 'Content-Type':'video/mp4' } })));
    f.upload.mockResolvedValueOnce({ error: { statusCode: '500' } });
    const first = await refreshVideo(f.client,id);
    expect(first.status).toBe('pending'); expect(first.error).toContain('Salvataggio video');
    expect((await refreshVideo(f.client,id)).status).toBe('completed');
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.every(([,init]) => init.method === 'GET')).toBe(true);
  });
  it.each(['text/html','video/mp4'])('contenuto non valido (%s) non viene salvato', async mime => {
    const f = clientFixture(); pending(f);
    vi.stubGlobal('fetch',vi.fn(async (url: string) => url.endsWith('/provider-1') ? reply({ id: 'provider-1', status: 'completed' }) : new Response('<html>not video</html>',{ headers: { 'Content-Type':mime } })));
    const result = await refreshVideo(f.client,id);
    expect(result.status).toBe('pending'); expect(result.error).toBeTruthy(); expect(f.upload).not.toHaveBeenCalled();
  });
  it('budget download reale: cancel sul superamento, non un MP4 troncato', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(9)); c.enqueue(new Uint8Array(9)); }, cancel }));
    await expect(readVideoBody(response,10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalled();
    await expect(readVideoBody(new Response(mp4,{ headers:{ 'Content-Length':String(maxVideoBytes+1) } }))).rejects.toMatchObject({ status: 413 });
  });
  it('invio rimasto senza conferma dopo un crash diventa incerto, non viene ripetuto', async () => {
    const f = clientFixture(); pending(f); Object.assign(f.rows.myai_video_jobs[0],{ status: 'submitting', created_at: new Date(Date.now()-600_000).toISOString() });
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    expect((await refreshVideo(f.client,id)).status).toBe('uncertain'); expect(fetcher).not.toHaveBeenCalled();
  });
});
