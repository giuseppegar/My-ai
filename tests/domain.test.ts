import { describe, expect, it } from 'vitest';
import { buildPlan, canAdvance, invalidatePlan } from '@/lib/agent-plan';
import { expandQuery, proposeCategory, searchPreview } from '@/lib/search';
import { demoData, previewResults } from '@/lib/demo';
import { memorySchema, preferencesSchema, wishSchema, chatSchema } from '@/lib/validation';
import { defaultPreferences, type AgentSession } from '@/lib/domain';

describe('ricerca non generativa', () => {
  it('ricetta riso ritrova risotto ai funghi senza un LLM', () => {
    expect(expandQuery('ricetta riso')).toContain('risotto');
    expect(searchPreview(previewResults(demoData), 'ricetta riso')[0].title).toContain('Risotto ai funghi');
  });
  it('normalizza simboli e limita la query tsquery', () => {
    expect(expandQuery("riso' ! & : < (DROP TABLE)" )).not.toMatch(/[&!:'<>]/);
    expect(searchPreview(previewResults(demoData), '')).toEqual([]);
  });
  it('propone categorie modificabili con regole esplicite', () => {
    expect(proposeCategory('Vorrei comprare casa')).toBe('desideri');
    expect(proposeCategory('Email più gentile')).toBe('scrivere');
  });
});
describe('conferme e indicatori non psicologici', () => {
  it('web è opzionale e disattivato di default', () => {
    const base = { conversation_id: crypto.randomUUID(), content: 'Una domanda', category: 'capire', refs: [] };
    expect(chatSchema.parse(base).web).toBe(false);
    expect(chatSchema.parse({ ...base, web: true }).web).toBe(true);
  });
  it('non permette preferenze non confermate', () => {
    const m = { title: 'Messaggi brevi', content: 'Preferisco messaggi brevi', category: 'scrivere', kind: 'preference' };
    expect(memorySchema.safeParse(m).success).toBe(false);
    expect(memorySchema.safeParse({ ...m, confirmed: true }).success).toBe(true);
  });
  it('non inventa tappe o risorse per i desideri', () => {
    const wish = wishSchema.parse({ title: 'Comprare casa' });
    expect(wish.resources).toBe(''); expect(wish.milestones).toEqual([]); expect(wish.timeframe).toBe('');
  });
  it('accetta solo limiti entro il tetto server', () => {
    expect(preferencesSchema.safeParse({ ...defaultPreferences, agent_cycles: 3 }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...defaultPreferences, agent_budget: 10 }).success).toBe(false);
  });
});
describe('orchestrazione agenti', () => {
  const session = { status: 'ready', budget: 0.2, reserved_cost: 0.01, duration_seconds: 240, elapsed_ms: 0, cursor: 0, plan: ['Coordinatore'], version: 1, interventions: [] } as unknown as AgentSession;
  it('attiva solo i ruoli necessari e al massimo due revisioni', () => {
    const plan = buildPlan(['Progettista','Revisore','Verificatore'], 99);
    expect(plan.filter(r => r === 'Revisore')).toHaveLength(2);
    expect(plan).not.toContain('Analista degli scenari');
    expect(plan.at(-1)).toBe('Sintesi');
  });
  it('stop, attesa e budget impediscono nuovo lavoro', () => {
    expect(canAdvance(session)).toBe(true);
    expect(canAdvance({ ...session, status: 'stopped' })).toBe(false);
    expect(canAdvance({ ...session, status: 'waiting' })).toBe(false);
    expect(canAdvance({ ...session, reserved_cost: 0.2 })).toBe(false);
    expect(canAdvance({ ...session, elapsed_ms: 240000 })).toBe(false);
  });
  it('un nuovo vincolo revoca la lease e invalida la vecchia proposta', () => {
    const updated = invalidatePlan(session, 'Budget massimo 500 euro, non una stima');
    expect(updated.version).toBe(2); expect(updated.lease).toBeNull(); expect(updated.result).toBeNull();
    expect(updated.cursor).toBe(0); expect(updated.plan).toEqual(['Coordinatore']);
    expect(updated.interventions[0].text).toContain('500 euro');
  });
});
