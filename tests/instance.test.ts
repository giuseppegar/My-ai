import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = { url: 'http://myai.invalid:8010', anonKey: 'myai-anon-test', instanceId: '369ed347-b740-4c3a-a80b-87cf522edc2f' };
let hasExpectedInstance: typeof import('../src/server/instance').hasExpectedInstance;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  ({ hasExpectedInstance } = await import('../src/server/instance'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('guardia contro collegamenti a istanze di altre app', () => {
  it('verifica solo tramite anon key, senza cookie o credenziali amministrative', async () => {
    fetchMock.mockResolvedValue(Response.json(config.instanceId));
    expect(await hasExpectedInstance(config)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${config.url}/rest/v1/rpc/myai_instance_id`, expect.objectContaining({
      method: 'POST', cache: 'no-store', redirect: 'error', body: '{}',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
    }));
  });
  it('rifiuta una istanza differente anche se risponde 200', async () => {
    fetchMock.mockResolvedValue(Response.json('63cf4c61-12aa-4524-8078-971d5a5f6c8a'));
    expect(await hasExpectedInstance(config)).toBe(false);
  });
  it('non tenta chiamate quando manca un UUID valido', async () => {
    expect(await hasExpectedInstance({ ...config, instanceId: '' })).toBe(false);
    expect(await hasExpectedInstance({ ...config, instanceId: 'shared' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('blocca istanze prive del marcatore senza memorizzare il fallimento', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: 'PGRST202' }, { status: 404 }));
    expect(await hasExpectedInstance(config)).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json(config.instanceId));
    expect(await hasExpectedInstance(config)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('blocca risposte non JSON ed errori di connessione', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>altra app</html>'));
    expect(await hasExpectedInstance(config)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('connection error'));
    expect(await hasExpectedInstance(config)).toBe(false);
  });
  it('rivalida dopo 30 secondi e dopo cambi di URL o chiave', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => Promise.resolve(Response.json(config.instanceId)));
    expect(await hasExpectedInstance(config)).toBe(true);
    expect(await hasExpectedInstance(config)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await hasExpectedInstance(config)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await hasExpectedInstance({ ...config, url: 'http://other.invalid' })).toBe(true);
    expect(await hasExpectedInstance({ ...config, anonKey: 'other-key' })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
