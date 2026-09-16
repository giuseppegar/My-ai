import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { gatherContext } from '@/server/retrieval';

type Row = Record<string, unknown>;
function clientFor(tables: Record<string, Row[]>, found: Row[] = []) {
  return {
    rpc: async () => ({ data: found, error: null }),
    from: (table: string) => {
      let rows = [...(tables[table] || [])];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter(r => r[key] === value); return query; },
        order: () => query,
        limit: (n: number) => { rows = rows.slice(0, n); return query; },
        single: async () => ({ data: rows[0], error: rows.length ? null : { code: 'PGRST116', message: 'Not found' } }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}
beforeEach(() => vi.stubEnv('OLLAMA_BASE_URL', ''));
afterEach(() => vi.unstubAllEnvs());
const doc = { id: 'doc', title: 'Un documento', category: 'capire', scope: 'chat', conversation_id: 'current', mime: 'application/pdf', status: 'ready' };
describe('contesto autorizzato e priorità degli allegati', () => {
  it('non lascia che ricordi automatici lunghi escludano il PDF appena caricato', async () => {
    const memories = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, title: 'Ricordo', content: 'contenuto '.repeat(2500), kind: 'content' }));
    const client = clientFor({ myai_documents: [doc], myai_document_chunks: [{ document_id: 'doc', page: 206, content: 'TULIPANO99' }], myai_memories: memories }, memories.map(m => ({ id: m.id, source: 'memory' })));
    const context = await gatherContext(client, 'TULIPANO99', 'current', [], 'capire');
    expect(context.text).toContain('TULIPANO99');
    expect(context.text.indexOf('TULIPANO99')).toBeLessThan(context.text.indexOf('Ricordo'));
    expect(context.text.length).toBeLessThanOrEqual(18000);
  });
  it('rifiuta allegati esclusivi e messaggi privati di un’altra conversazione', async () => {
    const client = clientFor({ myai_documents: [{ ...doc, conversation_id: 'other' }], myai_messages: [{ id: 'msg', conversation_id: 'other', content: 'Privato' }], myai_conversations: [{ id: 'other', title: 'Privata', searchable: false }] });
    await expect(gatherContext(client, 'Test', 'current', [{ id: 'doc', source: 'document' }], 'capire')).rejects.toMatchObject({ status: 403 });
    await expect(gatherContext(client, 'Test', 'current', [{ id: 'msg', source: 'message' }], 'capire')).rejects.toMatchObject({ status: 403 });
  });
  it('include una foto scelta dalla memoria prima delle foto già allegate, senza duplicati', async () => {
    const explicit = { ...doc, id: 'explicit', scope: 'memory', mime: 'image/png', conversation_id: null };
    const client = clientFor({ myai_documents: [doc, explicit] });
    const context = await gatherContext(client, 'Test', 'current', [{ id: 'explicit', source: 'document' }, { id: 'doc', source: 'document' }], 'capire');
    expect(context.documents.map(d => d.id)).toEqual(['explicit', 'doc']);
    expect(context.text.match(/id doc\]/g)).toHaveLength(1);
    expect(context.text).toContain('Non inventare il contenuto');
  });
});
