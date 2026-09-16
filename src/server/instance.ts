import 'server-only';

type InstanceConfig = { url: string; anonKey: string; instanceId: string };
let verified: { config: string; until: number } | undefined;

/** Verifica senza cookie utente né service-role, PRIMA di qualsiasi operazione Auth/dati. */
export async function hasExpectedInstance(config: InstanceConfig): Promise<boolean> {
  if (!config.url || !config.anonKey || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(config.instanceId)) return false;
  const key = JSON.stringify(config);
  if (verified?.config === key && verified.until > Date.now()) return true;
  try {
    const response = await fetch(`${config.url.replace(/\/+$/, '')}/rest/v1/rpc/myai_instance_id`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
      body: '{}', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || await response.json() !== config.instanceId) return false;
    verified = { config: key, until: Date.now() + 30_000 };
    return true;
  } catch {
    // Niente URL, token, risposte remote o dettagli dell'altra istanza nei log.
    return false;
  }
}
