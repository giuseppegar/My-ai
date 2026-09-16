import { expandQuery, normalize } from './search';
type Passage = { content: string; page: number | null };
const stopWords = new Set('che del della delle degli con per una uno come sono questo questa documento file pdf riassumi spiegami puoi cosa quali alla dalle nella nel dei'.split(' '));

// Search every indexed passage, including chat-only files, not just the first pages.
export function documentPassages(chunks: Passage[], query = '', preferredPage?: number, budget = 14000) {
  if (!chunks.length) return '';
  const words = expandQuery(query).split(' | ').filter(w => w.length > 2 && !stopWords.has(w));
  const requested = preferredPage ?? Number(query.match(/pagin[ae]\s+(\d+)/i)?.[1]);
  const ranked = chunks.map((chunk, index) => {
    const text = normalize(chunk.content);
    return { ...chunk, index, score: (chunk.page === requested ? 1000 : 0) + words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const count = Math.min(chunks.length, Math.max(1, Math.floor(budget / 2900)));
  // With no useful keywords (e.g. "riassumi"), sample beginning, middle and end.
  const selected = ranked[0].score > 0 ? ranked.slice(0, count) : Array.from({ length: count }, (_, i) => chunks[count === 1 ? 0 : Math.round(i * (chunks.length - 1) / (count - 1))]);
  const text = selected.map(ch => `${ch.page ? `[pagina ${ch.page}] ` : ''}${ch.content}`).join('\n\n');
  const partial = selected.length < chunks.length || text.length > budget;
  return `${partial ? '[Estratti selezionati, non il documento integrale. Non presumere di aver letto le parti omesse.]\n' : ''}${text.slice(0, budget)}`;
}
