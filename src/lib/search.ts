import type { SearchResult } from './domain';

// Espansione lessicale deterministica: non è un embedding e non chiama un LLM.
const concepts = [
  ['riso', 'risotto', 'risotti'], ['ricetta', 'ricette', 'cucinare', 'cucina'],
  ['funghi', 'fungo', 'porcini'], ['email', 'mail', 'messaggio', 'messaggi'],
  ['casa', 'abitazione', 'immobile', 'mutuo'], ['lingua', 'inglese', 'francese', 'spagnolo'],
  ['viaggio', 'vacanza', 'itinerario'], ['veloce', 'rapido', 'rapida', 'venti', '20'],
];
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function expandQuery(query: string): string {
  const words = normalize(query).split(' ').filter(w => w.length > 1).slice(0, 12);
  const expanded = new Set(words);
  for (const group of concepts) if (group.some(w => words.includes(w))) group.forEach(w => expanded.add(w));
  return [...expanded].slice(0, 36).join(' | ');
}
export function searchPreview(items: SearchResult[], query: string): SearchResult[] {
  const words = expandQuery(query).split(' | ').filter(Boolean);
  if (!words.length) return [];
  return items.map(item => {
    const text = normalize(`${item.title} ${item.excerpt}`);
    return { ...item, score: words.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0) };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}
export function proposeCategory(text: string): 'scrivere' | 'cucinare' | 'capire' | 'desideri' {
  const q = normalize(text);
  if (/ricett|cucin|risotto|ingredient/.test(q)) return 'cucinare';
  if (/vorrei|desider|viaggio|comprare casa|obiettivo|tappa/.test(q)) return 'desideri';
  if (/email|messaggio|scriv|testo|tono/.test(q)) return 'scrivere';
  return 'capire';
}
