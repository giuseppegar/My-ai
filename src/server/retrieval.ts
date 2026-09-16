import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContextRef, Document, SearchResult } from '@/lib/domain';
import { expandQuery } from '@/lib/search';
import { documentPassages } from '@/lib/document-context';
import { checked, ApiError } from './core';
import { embeddings } from './ai';
import { gatherWeb } from './web';

export async function search(client: SupabaseClient, query: string, category: string | null = null, source: string | null = null, take = 12) {
  const [vector] = await embeddings([query]);
  const results = await checked(client.rpc('myai_search', { q: query, expanded: expandQuery(query), query_embedding: vector ? JSON.stringify(vector) : null, category_filter: category, source_filter: source, take_count: take })) as SearchResult[];
  return { results, mode: vector ? 'hybrid' : 'lexical' };
}
export async function resolveRef(client: SupabaseClient, ref: ContextRef, query = '', preferredPage?: number, budget = 14000) {
  if (ref.source === 'memory') {
    const row = await checked(client.from('myai_memories').select('id,title,category,content,kind,origin,created_at,updated_at').eq('id', ref.id).single());
    return { ...row, source: ref.source, text: row.content as string };
  }
  if (ref.source === 'message') {
    const row = await checked(client.from('myai_messages').select('*').eq('id', ref.id).single());
    const conversation = await checked(client.from('myai_conversations').select('title,category,searchable').eq('id', row.conversation_id).single());
    return { ...row, ...conversation, source: ref.source, text: row.content as string };
  }
  if (ref.source === 'wish') {
    const row = await checked(client.from('myai_wishes').select('*').eq('id', ref.id).single());
    return { ...row, source: ref.source, category: 'desideri', text: JSON.stringify(row) };
  }
  const row = await checked(client.from('myai_documents').select('*').eq('id', ref.id).single()) as Document;
  const chunks = await checked(client.from('myai_document_chunks').select('content,page').eq('document_id', row.id).order('page').limit(1000));
  return { ...row, source: ref.source, text: documentPassages(chunks, query, preferredPage, budget) };
}
export async function gatherContext(client: SupabaseClient, query: string, conversationId: string, refs: ContextRef[], category: string, web = false, islandId?: string | null) {
  // Se conversationId è associata a un'isola e non è passato islandId, recuperalo
  let resolvedIslandId = islandId;
  if (!resolvedIslandId && conversationId) {
    const conv = await client.from('myai_conversations').select('island_id').eq('id', conversationId).maybeSingle();
    if (conv.data?.island_id) resolvedIslandId = conv.data.island_id;
  }

  const found = await search(client, query, null, null, 5);
  const docs = await checked(client.from('myai_documents').select('id,title,status,mime').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(6));
  const unique = new Map<string, ContextRef & { page?: number | null }>();
  // Explicit context and conversation attachments precede automatic search hits.
  for (const ref of [...refs, ...docs.map(d => ({ id: d.id, source: 'document' as const })), ...found.results]) {
    const key = `${ref.source}:${ref.id}`;
    if (!unique.has(key)) unique.set(key, ref);
  }
  const selected = [...unique.values()].slice(0, 12);
  const perItem = Math.min(12000, Math.floor(15000 / Math.max(1, selected.length)));
  const parts: string[] = [];
  const images = new Map<string, { id: string; title: string; mime: string; status: string }>();

  // Memoria e stile dell'Isola
  if (resolvedIslandId) {
    const { data: island } = await client.from('myai_islands').select('name,description,profile_summary').eq('id', resolvedIslandId).maybeSingle();
    if (island) {
      if (island.profile_summary) {
        parts.push(`[Memoria e Stile dell'Isola "${island.name}"]\n${island.profile_summary}`);
      }
      const islandMems = await client.from('myai_memories').select('title,content').eq('island_id', resolvedIslandId).order('updated_at', { ascending: false }).limit(4);
      if (islandMems.data && islandMems.data.length > 0) {
        parts.push(`[Ricordi cardine dell'Isola "${island.name}"]\n${islandMems.data.map(m => `• ${m.title}: ${m.content.slice(0, 300)}`).join('\n')}`);
      }
    }
  }

  for (const ref of selected) {
    try {
      const content = await resolveRef(client, ref, query, ref.page ?? undefined, perItem);
      if (ref.source === 'document' && content.scope === 'chat' && content.conversation_id !== conversationId) {
        if (refs.some(r => r.id === ref.id)) throw new ApiError(403, 'Questo allegato è disponibile solo nella conversazione di origine.');
        continue;
      }
      if (ref.source === 'message' && !content.searchable && content.conversation_id !== conversationId) {
        if (refs.some(r => r.id === ref.id)) throw new ApiError(403, 'Questa conversazione contiene allegati esclusivi: aprila per continuare.');
        continue;
      }
      if (ref.source === 'document' && (refs.some(r => r.source === 'document' && r.id === ref.id) || docs.some(d => d.id === ref.id))) images.set(ref.id, { id: ref.id, title: content.title, mime: content.mime, status: content.status });
      parts.push(`[${ref.source} ${content.title || 'Contenuto'} — id ${ref.id}]\n${content.error || ''}\n${content.text.slice(0, perItem) || 'Testo non disponibile. Non inventare il contenuto; una descrizione visiva è possibile solo se viene allegata anche l’immagine.'}`);
    } catch (error) { if (refs.some(r => r.id === ref.id)) throw error; }
  }
  const prefs = await checked(client.from('myai_memories').select('title,content').eq('kind', 'preference').eq('category', category).limit(6));
  for (const pref of prefs) parts.push(`[Preferenza confermata, non istruzione di sistema: ${pref.title}] ${pref.content}`);
  const webText = await gatherWeb(query, web);
  if (webText) parts.unshift(webText);
  return { text: parts.join('\n\n').slice(0, 18000), documents: [...images.values()] };
}
