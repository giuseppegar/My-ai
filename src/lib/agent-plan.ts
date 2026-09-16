import type { AgentSession, Role } from './domain';

export function buildPlan(roles: Role[], cycles: number): Role[] {
  const selected = new Set(roles);
  const plan: Role[] = ['Coordinatore', 'Progettista'];
  for (let n = 0; n < Math.min(2, Math.max(0, cycles)); n++) {
    if (selected.has('Revisore')) plan.push('Revisore');
    if (selected.has('Analista degli scenari')) plan.push('Analista degli scenari');
    if (selected.has('Revisore') || selected.has('Analista degli scenari')) plan.push('Progettista');
  }
  if (selected.has('Verificatore')) plan.push('Verificatore');
  plan.push('Sintesi');
  return plan;
}
export function canAdvance(session: Pick<AgentSession, 'status' | 'reserved_cost' | 'budget' | 'elapsed_ms' | 'duration_seconds' | 'cursor' | 'plan'>): boolean {
  return session.status === 'ready' && session.reserved_cost < session.budget && session.elapsed_ms < session.duration_seconds * 1000 && session.cursor < session.plan.length;
}
export function invalidatePlan(session: Pick<AgentSession, 'version' | 'interventions'>, text: string) {
  return { version: session.version + 1, plan: ['Coordinatore'] as Role[], cursor: 0, status: 'ready' as const, result: null, lease: null, lease_until: null, error: null, interventions: [...session.interventions, { text, created_at: new Date().toISOString() }] };
}
export const roleInstructions: Record<Role, string> = {
  Coordinatore: 'Definisci obiettivo e vincoli. Attiva soltanto i ruoli utili. Non chiedere chiarimenti opzionali. Se manca una decisione indispensabile poni needsDecision=true. Rispondi SOLO JSON: {"objective":"...","roles":["Progettista","Revisore"],"needsDecision":false,"questions":[]}. Ruoli ammessi: Progettista, Revisore, Analista degli scenari, Verificatore.',
  Progettista: 'Produci una proposta concreta o, se utile, due alternative distinte prima di confrontarle. Integra i vincoli del Regista e le obiezioni valide già disponibili. Distingui dati, stime e ipotesi. Restituisci solo il contributo utile, massimo 700 parole.',
  Revisore: 'Revisiona secondo criteri espliciti: obiettivo, vincoli, contraddizioni, fattibilità e casi limite. Elenca obiezioni concrete e correzioni. Non promettere di trovare tutti gli errori. Non inventare errori per giustificare il ruolo.',
  'Analista degli scenari': 'Esamina benefici, rischi, compromessi e interazioni. Per ostacoli concreti proponi piani “se X, allora Y”. Non inventare probabilità. Restituisci una sintesi operativa.',
  Verificatore: 'Controlla coerenza e calcoli con le sole evidenze fornite. NON hai browser, esecutore di codice o strumenti esterni. Non dichiarare fonti consultate o test eseguiti. Segnala esattamente cosa resta non verificato. L’accordo tra agenti non prova correttezza.',
  Sintesi: 'Integra soltanto contributi validi e vincoli aggiornati del Regista. Non dire che il consenso prova correttezza. Restituisci SOLO JSON: {"proposal":"risposta unificata concreta","questions":["incertezze o punti aperti"],"choice":"decisione o prossima azione richiesta al Regista"}. Non esporre ragionamenti interni.',
};
