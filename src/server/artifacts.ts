import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Document } from '@/lib/domain';
import { ApiError, capabilities, checked, quota } from './core';
import { checkSpace, processDocument } from './files';
import { complete } from './ai';

export type GenerateArtifactInput = {
  conversation_id: string;
  category: Category;
  prompt?: string;
  content?: string;
  title?: string;
  filename?: string;
};

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').slice(0, 80);
  if (!clean.includes('.')) return `${clean || 'documento'}.md`;
  return clean || 'documento.md';
}

export async function generateTextArtifact(
  client: SupabaseClient,
  userId: string,
  input: GenerateArtifactInput,
  signal?: AbortSignal
): Promise<Document> {
  let title = input.title?.trim() || '';
  let filename = input.filename?.trim() || '';
  let content = input.content ?? '';
  let summary = '';

  if (input.prompt && !content) {
    if (!capabilities().ai) throw new ApiError(503, 'Configura la chiave DeepSeek sul server per generare file di testo.');
    await quota(client);

    const system = `Sei un assistente per la creazione di documenti e file di testo (artefatti) per My ai.
Genera un documento di testo completo, ben strutturato e utile per la richiesta dell'utente.
Rispondi ESCLUSIVAMENTE con un singolo oggetto JSON valido (senza blocchi di codice esterni o testo aggiuntivo) con i seguenti campi:
- "title": titolo breve e chiaro del documento (stringa, max 150 caratteri)
- "filename": nome del file suggerito con estensione es. .md, .txt, .json, .csv, .py, .html (stringa, max 80 caratteri, solo lettere, numeri, trattini e punto)
- "content": il contenuto completo del file in formato testo o markdown (stringa)
- "summary": una frase breve e accogliente che descrive il documento generato (stringa, max 200 caratteri)`;

    const aiRes = await complete([
      { role: 'system', content: system },
      { role: 'user', content: input.prompt.slice(0, 2000) },
    ], userId, signal, true);

    try {
      const parsed = JSON.parse(aiRes.content) as { title?: unknown; filename?: unknown; content?: unknown; summary?: unknown };
      if (typeof parsed.content === 'string' && parsed.content.trim()) content = parsed.content.trim();
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.filename === 'string' && parsed.filename.trim()) filename = parsed.filename.trim();
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) summary = parsed.summary.trim();
    } catch {
      // In caso di parsing imperfetto dal modello, usa la risposta diretta come markdown
      content = aiRes.content.trim();
      title = input.prompt.split('\n')[0].slice(0, 80).trim() || 'Documento generato';
      filename = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 30) || 'documento'}.md`;
      summary = 'Documento generato da My ai.';
    }
  }

  if (!content.trim()) throw new ApiError(400, 'Nessun contenuto testuale da salvare nel file.');

  if (!title) {
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80).trim();
    title = firstLine || (input.prompt ? input.prompt.split('\n')[0].slice(0, 80).trim() : 'Documento di testo');
  }
  if (!filename) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'documento';
    filename = `${base}.md`;
  }
  filename = sanitizeFilename(filename);

  const buffer = Buffer.from(content, 'utf-8');
  if (buffer.length > 10 * 1024 * 1024) throw new ApiError(413, 'File di testo troppo grande (massimo 10 MB).');
  await checkSpace(client, buffer.length);

  const id = crypto.randomUUID();
  const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
  const path = `${userId}/${id}.${ext}`;

  const { error: storageError } = await client.storage.from('myai-private').upload(path, buffer, {
    contentType: 'text/plain',
    upsert: false,
    cacheControl: '0',
  });
  if (storageError) throw new ApiError(502, 'Salvataggio del file non riuscito. Controlla il bucket privato Supabase.');

  let doc: Document;
  try {
    doc = await checked(client.from('myai_documents').insert({
      id,
      conversation_id: input.conversation_id,
      scope: 'memory',
      category: input.category,
      title: title.slice(0, 150),
      filename: filename.slice(0, 250),
      mime: 'text/plain',
      origin: 'generated',
      status: 'processing',
      path,
      size_bytes: buffer.length,
    }).select('*').single()) as Document;
  } catch (error) {
    await client.storage.from('myai-private').remove([path]);
    throw error;
  }

  const processed = await processDocument(client, doc, buffer);

  if (input.prompt) {
    const requestMessage = await checked(client.from('myai_messages').insert({
      conversation_id: input.conversation_id,
      role: 'user',
      category: input.category,
      content: `[Genera file di testo]\n${input.prompt}`,
    }).select('id').single());

    await checked(client.from('myai_messages').insert({
      conversation_id: input.conversation_id,
      role: 'assistant',
      reply_to_id: requestMessage.id,
      category: input.category,
      content: `Ho generato il file di testo **${processed.title}** (\`${processed.filename}\`).\n\n${summary || (processed.scope === 'memory' ? 'Salvato nei tuoi documenti e catalogato nell’isola.' : 'Conservato nei documenti di questa chat riservata.')}`,
    }));
  }

  return processed;
}

export async function updateTextArtifact(
  client: SupabaseClient,
  userId: string,
  documentId: string,
  input: { title?: string; content: string }
): Promise<Document> {
  const doc = await checked(client.from('myai_documents').select('*').eq('id', documentId).single()) as Document;
  if (!doc.mime.startsWith('text/plain')) throw new ApiError(415, 'Solo i file di testo possono essere modificati direttamente.');

  const content = input.content ?? '';
  if (!content.trim()) throw new ApiError(400, 'Il contenuto del file non può essere vuoto.');

  const title = (input.title?.trim() || doc.title).slice(0, 150);
  const buffer = Buffer.from(content, 'utf-8');
  if (buffer.length > 10 * 1024 * 1024) throw new ApiError(413, 'File di testo troppo grande (massimo 10 MB).');

  const diffBytes = buffer.length - (doc.size_bytes || 0);
  if (diffBytes > 0) await checkSpace(client, diffBytes);

  const ext = doc.filename.split('.').pop()?.toLowerCase() || 'txt';
  const newPath = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await client.storage.from('myai-private').upload(newPath, buffer, {
    contentType: 'text/plain',
    upsert: false,
    cacheControl: '0',
  });
  if (uploadError) throw new ApiError(502, 'Salvataggio del file modificato non riuscito.');

  const oldPath = doc.path;
  let updatedDoc: Document;
  try {
    updatedDoc = await checked(
      client.from('myai_documents').update({
        title,
        path: newPath,
        size_bytes: buffer.length,
        status: 'processing',
      }).eq('id', documentId).select('*').single()
    ) as Document;
  } catch (error) {
    await client.storage.from('myai-private').remove([newPath]);
    throw error;
  }

  if (oldPath && oldPath !== newPath) {
    await client.storage.from('myai-private').remove([oldPath]);
  }

  return processDocument(client, updatedDoc, buffer);
}

export async function aiEditTextArtifact(
  client: SupabaseClient,
  userId: string,
  documentId: string,
  instruction: string,
  saveDirectly = false,
  signal?: AbortSignal
): Promise<{ title: string; content: string; summary: string; document?: Document }> {
  const doc = await checked(client.from('myai_documents').select('*').eq('id', documentId).single()) as Document;
  if (!doc.mime.startsWith('text/plain')) throw new ApiError(415, 'Solo i file di testo possono essere modificati con l’AI.');

  if (!capabilities().ai) throw new ApiError(503, 'Configura la chiave DeepSeek sul server per modificare i documenti con l’AI.');
  await quota(client);

  const { data, error } = await client.storage.from('myai-private').download(doc.path);
  if (error || !data) throw new ApiError(502, 'File originale non disponibile per la lettura.');

  const currentText = Buffer.from(await data.arrayBuffer()).toString('utf-8');

  const system = `Sei un assistente editoriale di precisione per My ai.
Ti viene fornito un documento di testo esistente e una richiesta di modifica o miglioramento da parte dell'utente.
Modifica il documento applicando con cura l'istruzione richiesta, preservando la struttura generale e le parti non interessate dalla modifica.
Rispondi ESCLUSIVAMENTE con un singolo oggetto JSON valido:
- "title": il titolo del documento (aggiornato se opportuno, o invariato, max 150 caratteri)
- "content": l'intero documento di testo aggiornato e completo (stringa)
- "summary": breve spiegazione amichevole (1-2 frasi) di cosa è stato modificato (stringa, max 200 caratteri)`;

  const userPrompt = `DOCUMENTO ESISTENTE (Titolo: "${doc.title}"):\n${currentText}\n\nISTRUZIONE DI MODIFICA DELL'UTENTE:\n${instruction}`;

  const aiRes = await complete([
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ], userId, signal, true);

  let newTitle = doc.title;
  let newContent = currentText;
  let summary = 'Documento modificato con l’aiuto dell’AI.';

  try {
    const parsed = JSON.parse(aiRes.content) as { title?: unknown; content?: unknown; summary?: unknown };
    if (typeof parsed.title === 'string' && parsed.title.trim()) newTitle = parsed.title.trim().slice(0, 150);
    if (typeof parsed.content === 'string' && parsed.content.trim()) newContent = parsed.content.trim();
    if (typeof parsed.summary === 'string' && parsed.summary.trim()) summary = parsed.summary.trim();
  } catch {
    newContent = aiRes.content.trim();
  }

  if (saveDirectly) {
    const updated = await updateTextArtifact(client, userId, documentId, { title: newTitle, content: newContent });
    return { title: newTitle, content: newContent, summary, document: updated };
  }

  return { title: newTitle, content: newContent, summary };
}
