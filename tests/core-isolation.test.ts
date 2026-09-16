import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
  createServerClient: vi.fn(() => ({ auth: {} })),
  hasExpectedInstance: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('../src/server/instance', () => ({ hasExpectedInstance: mocks.hasExpectedInstance }));
import { adminForAccountDeletion, capabilities, checked, checkOrigin, db } from '../src/server/core';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_URL', 'http://myai.invalid:8010');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
  vi.stubEnv('SUPABASE_INSTANCE_ID', '369ed347-b740-4c3a-a80b-87cf522edc2f');
  vi.stubEnv('SUPABASE_AUTH_COOKIE_NAME', 'myai-test-auth-token');
  vi.stubEnv('ALLOW_AUTH_ACCOUNT_DELETION', 'false');
  mocks.hasExpectedInstance.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe('BFF isolato', () => {
  it('senza istanza dichiarata non apre il client Supabase', async () => {
    vi.stubEnv('SUPABASE_INSTANCE_ID', '');
    expect(capabilities().configured).toBe(false);
    await expect(db()).rejects.toMatchObject({ status: 503 });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
  it('rifiuta il backend sbagliato prima di leggere cookie o operare su Auth', async () => {
    mocks.hasExpectedInstance.mockResolvedValue(false);
    await expect(db()).rejects.toMatchObject({ status: 503 });
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
  it('usa un nome cookie proprio anziché quello derivato dal solo hostname', async () => {
    await db();
    expect(mocks.createServerClient).toHaveBeenCalledWith('http://myai.invalid:8010', 'test-anon-key', expect.objectContaining({
      cookieOptions: expect.objectContaining({ name: 'myai-test-auth-token', httpOnly: true, sameSite: 'lax' }),
    }));
  });
  it('non permette eliminazione amministrativa senza consenso di configurazione', () => {
    expect(() => adminForAccountDeletion()).toThrow('Eliminazione account non configurata');
  });
  it.each(['PGRST301', 'PGRST303'])('tratta %s come errore JWT, non come cache schema', async code => {
    await expect(checked(Promise.resolve({ data: null, error: { code, message: 'invalid JWT' } }))).rejects.toMatchObject({ status: 401 });
  });
});

describe('controllo origine con più host', () => {
  const request = (origin: string | null, site = 'same-origin') => new Request('http://myai.invalid/api/x', { headers: origin ? { origin, 'sec-fetch-site': site } : {} });
  it('accetta APP_URL quando APP_ORIGINS non è configurato', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('APP_ORIGINS', '');
    expect(() => checkOrigin(request('http://localhost:3000'))).not.toThrow();
    expect(() => checkOrigin(request('https://myai.terraleonum.com'))).toThrow('Origine della richiesta non autorizzata');
  });
  it('accetta ogni host elencato in APP_ORIGINS e rifiuta gli altri', () => {
    vi.stubEnv('APP_URL', 'https://myai.terraleonum.com');
    vi.stubEnv('APP_ORIGINS', 'https://myai.terraleonum.com, https://myai.terraleonum.duckdns.org');
    expect(() => checkOrigin(request('https://myai.terraleonum.com'))).not.toThrow();
    expect(() => checkOrigin(request('https://myai.terraleonum.duckdns.org'))).not.toThrow();
    expect(() => checkOrigin(request('https://altro.terraleonum.com'))).toThrow('Origine della richiesta non autorizzata');
    expect(() => checkOrigin(request(null))).toThrow();
  });
  it('rifiuta richieste cross-site anche con origine consentita', () => {
    vi.stubEnv('APP_URL', 'https://myai.terraleonum.com');
    vi.stubEnv('APP_ORIGINS', '');
    expect(() => checkOrigin(request('https://myai.terraleonum.com', 'cross-site'))).toThrow('Origine della richiesta non autorizzata');
  });
});
