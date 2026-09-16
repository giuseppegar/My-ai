import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTextArtifact, updateTextArtifact, aiEditTextArtifact } from '@/server/artifacts';
import { detectMime } from '@/server/files';
import type { Document } from '@/lib/domain';

function createMockClient(initialDocs: Document[] = []) {
  const documents = [...initialDocs];
  const chunks: Array<{ document_id: string; content: string; embedding: string | null }> = [];
  const messages: Array<{ conversation_id: string; role: string; content: string }> = [];
  const storageFiles = new Map<string, Buffer>();

  const upload = vi.fn(async (path: string, buffer: Buffer) => {
    storageFiles.set(path, buffer);
    return { error: null };
  });

  const download = vi.fn(async (path: string) => {
    const buf = storageFiles.get(path);
    if (!buf) return { data: null, error: { message: 'Not found' } };
    return { data: new Blob([new Uint8Array(buf)]), error: null };
  });

  const remove = vi.fn(async (paths: string[]) => {
    for (const p of paths) storageFiles.delete(p);
    return { error: null };
  });

  const storage = {
    from: () => ({ upload, download, remove }),
  };

  const rpc = vi.fn(async (name: string) => {
    if (name === 'myai_consume_call' || name === 'myai_consume_ai') return { data: true, error: null };
    return { data: null, error: null };
  });

  type MockQuery = {
    _eqVal?: unknown;
    select: () => MockQuery;
    eq: (_col: string, val: unknown) => MockQuery;
    limit: () => MockQuery;
    single: () => Promise<{ data: unknown; error: unknown }>;
    insert: (rows: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } };
    update: (patch: Record<string, unknown>) => { eq: (_col: string, val: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } };
    delete: () => { eq: (_col: string, val: unknown) => Promise<{ data: unknown; error: unknown }> };
    then: (resolve: (val: unknown) => unknown) => Promise<unknown>;
  };

  const from = (table: string) => {
    const query: MockQuery = {
      select: () => query,
      eq: (_col: string, val: unknown) => {
        query._eqVal = val;
        return query;
      },
      limit: () => query,
      single: async () => {
        if (table === 'myai_documents') {
          const doc = documents.find(d => d.id === query._eqVal) || documents[0];
          return { data: doc || null, error: doc ? null : { message: 'Not found' } };
        }
        return { data: { id: 'msg-id' }, error: null };
      },
      insert: (rows: unknown) => {
        const rowArr = (Array.isArray(rows) ? rows : [rows]) as Array<Record<string, unknown>>;
        if (table === 'myai_documents') {
          documents.push(...(rowArr as unknown as Document[]));
        } else if (table === 'myai_document_chunks') {
          chunks.push(...(rowArr as unknown as Array<{ document_id: string; content: string; embedding: string | null }>));
        } else if (table === 'myai_messages') {
          messages.push(...(rowArr as unknown as Array<{ conversation_id: string; role: string; content: string }>));
        }
        return {
          select: () => ({
            single: async () => ({ data: rowArr[0], error: null }),
          }),
        };
      },
      update: (patch: Record<string, unknown>) => {
        return {
          eq: (_col: string, val: unknown) => {
            if (table === 'myai_documents') {
              const doc = documents.find(d => d.id === val);
              if (doc) Object.assign(doc, patch);
            }
            return {
              select: () => ({
                single: async () => {
                  const doc = documents.find(d => d.id === val);
                  return { data: doc || null, error: null };
                },
              }),
            };
          },
        };
      },
      delete: () => {
        return {
          eq: async (_col: string, val: unknown) => {
            if (table === 'myai_document_chunks') {
              for (let i = chunks.length - 1; i >= 0; i--) {
                if (chunks[i].document_id === val) chunks.splice(i, 1);
              }
            }
            return { data: null, error: null };
          },
        };
      },
      then: (resolve: (val: unknown) => unknown) => {
        if (table === 'myai_documents') {
          return Promise.resolve({ data: documents.map(d => ({ size_bytes: d.size_bytes || 0 })), error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return query;
  };

  return {
    client: { from, rpc, storage } as unknown as SupabaseClient,
    documents,
    chunks,
    messages,
    storageFiles,
    storage,
    rpc,
  };
}

beforeEach(() => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
  vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-chat');
  vi.stubEnv('OLLAMA_BASE_URL', '');
  vi.stubEnv('DOCUMENT_OCR_ENABLED', 'false');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('MIME detection per file di testo e Markdown', () => {
  it('riconosce correttamente .md e .txt come text/plain', () => {
    const mdBuf = Buffer.from('# Titolo\n\nQuesto è un documento markdown.');
    expect(detectMime(mdBuf, 'guida.md')).toBe('text/plain');

    const txtBuf = Buffer.from('Testo semplice.');
    expect(detectMime(txtBuf, 'appunti.txt')).toBe('text/plain');
  });
});

describe('generazione file di testo e artefatti', () => {
  it('salva un file di testo diretto senza chiamare l’AI se il contenuto è fornito', async () => {
    const mock = createMockClient();
    const doc = await generateTextArtifact(mock.client, 'user-123', {
      conversation_id: 'conv-1',
      category: 'scrivere',
      title: 'Lettera formale',
      filename: 'lettera.md',
      content: '# Gentile Direzione,\nVi scrivo per confermare...',
    });

    expect(doc.title).toBe('Lettera formale');
    expect(doc.filename).toBe('lettera.md');
    expect(doc.mime).toBe('text/plain');
    expect(doc.origin).toBe('generated');
    expect(doc.status).toBe('ready');
    expect(mock.documents).toHaveLength(1);
    expect(mock.chunks).toHaveLength(1);
    expect(mock.chunks[0].content).toContain('Gentile Direzione');
    expect(mock.storage.from().upload).toHaveBeenCalledTimes(1);
  });

  it('genera un file di testo con l’AI via JSON structured output quando è fornito un prompt', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('api.deepseek.com');
      const body = JSON.parse(String(init?.body));
      expect(body.response_format).toEqual({ type: 'json_object' });

      const aiAnswer = {
        title: 'Guida rapida a TypeScript',
        filename: 'typescript-guide.md',
        content: '# Guida TypeScript\n\nTypeScript introduce tipi statici a JavaScript.',
        summary: 'Ho preparato per te una guida introduttiva a TypeScript.',
      };

      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: JSON.stringify(aiAnswer) } }],
        usage: { prompt_tokens: 50, completion_tokens: 100 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    const mock = createMockClient();
    const doc = await generateTextArtifact(mock.client, 'user-123', {
      conversation_id: 'conv-1',
      category: 'capire',
      prompt: 'Crea una guida introduttiva a TypeScript',
    });

    expect(doc.title).toBe('Guida rapida a TypeScript');
    expect(doc.filename).toBe('typescript-guide.md');
    expect(doc.status).toBe('ready');
    // Verifica che siano stati registrati i messaggi di richiesta e risposta nella chat
    expect(mock.messages).toHaveLength(2);
    expect(mock.messages[0].content).toContain('[Genera file di testo]');
    expect(mock.messages[1].content).toContain('Guida rapida a TypeScript');
  });

  it('rifiuta la generazione AI se manca la chiave API DeepSeek', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    const mock = createMockClient();
    await expect(generateTextArtifact(mock.client, 'user-123', {
      conversation_id: 'conv-1',
      category: 'scrivere',
      prompt: 'Scrivi un saggio',
    })).rejects.toMatchObject({ status: 503 });
  });

  it('rifiuta contenuti vuoti', async () => {
    const mock = createMockClient();
    await expect(generateTextArtifact(mock.client, 'user-123', {
      conversation_id: 'conv-1',
      category: 'scrivere',
      content: '   ',
    })).rejects.toMatchObject({ status: 400 });
  });
});

describe('modifica autonoma e manuale dei file di testo', () => {
  it('aggiorna il titolo e il contenuto del file, sostituendo il path nello storage ed eliminando il vecchio', async () => {
    const existingDoc: Document = {
      id: 'doc-existing',
      title: 'Nota iniziale',
      filename: 'nota.md',
      mime: 'text/plain',
      scope: 'memory',
      conversation_id: 'conv-1',
      path: 'user-123/old-path.md',
      status: 'ready',
      error: null,
      page_count: 1,
      origin: 'generated',
      created_at: new Date().toISOString(),
      size_bytes: 50,
      category: 'scrivere',
    };

    const originalPath = existingDoc.path;
    const mock = createMockClient([existingDoc]);
    mock.storageFiles.set(originalPath, Buffer.from('Contenuto iniziale'));

    const updated = await updateTextArtifact(mock.client, 'user-123', existingDoc.id, {
      title: 'Nota aggiornata',
      content: '# Nota aggiornata\nNuovo testo manuale.',
    });

    expect(updated.title).toBe('Nota aggiornata');
    expect(updated.path).not.toBe(originalPath);
    // Verifica che il vecchio file sia stato rimosso
    expect(mock.storage.from().remove).toHaveBeenCalledWith([originalPath]);
    // Verifica che il nuovo file sia presente nello storage
    expect(mock.storageFiles.has(updated.path)).toBe(true);
    expect(mock.storageFiles.get(updated.path)?.toString('utf-8')).toContain('Nuovo testo manuale');
  });

  it('rifiuta modifiche su file non di testo (es. immagini o video)', async () => {
    const imageDoc: Document = {
      id: 'img-1',
      title: 'Foto',
      filename: 'foto.png',
      mime: 'image/png',
      scope: 'memory',
      conversation_id: 'conv-1',
      path: 'user-123/foto.png',
      status: 'ready',
      error: null,
      page_count: null,
      origin: 'upload',
      created_at: new Date().toISOString(),
      category: 'capire',
    };

    const mock = createMockClient([imageDoc]);
    await expect(updateTextArtifact(mock.client, 'user-123', imageDoc.id, {
      title: 'Foto',
      content: 'tentativo testo',
    })).rejects.toMatchObject({ status: 415 });
  });
});

describe('modifica assistita dall’AI per file di testo', () => {
  it('applica un’istruzione di riscrittura o completamento al file esistente', async () => {
    const existingDoc: Document = {
      id: 'doc-ai-edit',
      title: 'Appunti riunione',
      filename: 'riunione.md',
      mime: 'text/plain',
      scope: 'chat',
      conversation_id: 'conv-1',
      path: 'user-123/riunione.md',
      status: 'ready',
      error: null,
      page_count: 1,
      origin: 'generated',
      created_at: new Date().toISOString(),
      category: 'scrivere',
    };

    const initialContent = 'Punti discussi: budget, calendario, compiti.';
    const mock = createMockClient([existingDoc]);
    mock.storageFiles.set(existingDoc.path, Buffer.from(initialContent));

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.messages[1].content).toContain(initialContent);
      expect(body.messages[1].content).toContain('Formatta come tabella');

      const aiAnswer = {
        title: 'Verbale riunione strutturato',
        content: '| Punto | Dettaglio |\n|---|---|\n| Budget | Approvato |',
        summary: 'Ho formattato i punti in una tabella leggibile.',
      };

      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: JSON.stringify(aiAnswer) } }],
        usage: { prompt_tokens: 60, completion_tokens: 80 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    // Test preview (saveDirectly = false)
    const preview = await aiEditTextArtifact(mock.client, 'user-123', existingDoc.id, 'Formatta come tabella', false);
    expect(preview.title).toBe('Verbale riunione strutturato');
    expect(preview.content).toContain('| Punto | Dettaglio |');
    expect(preview.summary).toContain('tabella');
    // Storage non ancora modificato in modalità preview
    expect(mock.storageFiles.get(existingDoc.path)?.toString('utf-8')).toBe(initialContent);

    // Test salvataggio diretto (saveDirectly = true)
    const direct = await aiEditTextArtifact(mock.client, 'user-123', existingDoc.id, 'Formatta come tabella', true);
    expect(direct.document).toBeDefined();
    expect(direct.document?.title).toBe('Verbale riunione strutturato');
    expect(mock.storageFiles.get(direct.document!.path)?.toString('utf-8')).toContain('| Punto | Dettaglio |');
  });
});
