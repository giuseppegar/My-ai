import { defaultPreferences, gaugeDefinitions, type Bootstrap, type SearchResult } from './domain';
const created = new Date().toISOString();
export const demoData: Bootstrap = {
  capabilities: { configured: false, ai: false, embeddings: false, vision: false, ocr: false, web: false, webProvider: 'tavily', images: false, imageModel: 'gpt-image-1', videos: false, videoModel: 'google/veo-3.1-lite', videoDuration: 4, videoResolution: '720p', accountDeletion: false, model: 'deepseek-flash' },
  user: null,
  preferences: defaultPreferences,
  conversations: [], documents: [], wishes: [], sessions: [], videoJobs: [],
  memories: [
    { id: 'demo-risotto', title: 'Risotto ai funghi, senza fretta', category: 'cucinare', kind: 'content', content: 'ESEMPIO DIMOSTRATIVO — Per due persone: 160 g di riso, 200 g di funghi, brodo vegetale, una piccola cipolla e olio.\n\nFai rosolare la cipolla, aggiungi i funghi e poi il riso. Tosta un minuto e unisci il brodo poco alla volta, mescolando. Controlla la cottura indicata sulla confezione.\n\nUn’idea da adattare ai tuoi gusti e alle tue esigenze alimentari.', origin: 'Esempio, non un tuo ricordo', created_at: created, updated_at: created },
    { id: 'demo-email', title: 'Un’email gentile, ma chiara', category: 'scrivere', kind: 'content', content: 'ESEMPIO DIMOSTRATIVO\n\nBuongiorno, ti scrivo per sapere se ci sono aggiornamenti sul progetto. Se può esserti utile, sono disponibile per un breve confronto.\nGrazie per il tuo tempo e a presto!', origin: 'Esempio, non un tuo ricordo', created_at: created, updated_at: created },
    { id: 'demo-scoperta', title: 'Perché il cielo è azzurro?', category: 'capire', kind: 'discovery', content: 'ESEMPIO DIMOSTRATIVO\n\nLe molecole dell’aria diffondono la luce a lunghezza d’onda corta più di quella a lunghezza d’onda lunga. È la diffusione di Rayleigh. Il colore che vediamo dipende anche dalla luce del Sole e dalla sensibilità dei nostri occhi.', origin: 'Esempio editoriale', created_at: created, updated_at: created },
    { id: 'demo-idea', title: 'Dieci minuti per una nuova lingua', category: 'desideri', kind: 'idea', content: 'ESEMPIO DIMOSTRATIVO\n\nUn piccolo esperimento: scegliere una lingua, ascoltare cinque minuti di un dialogo e annotare tre frasi utili. Prima di fare un piano, chiarire perché vuoi impararla e quanto tempo desideri dedicarle.', origin: 'Esempio, non un tuo desiderio', created_at: created, updated_at: created },
  ],
  gauges: gaugeDefinitions.map((g, i) => ({ ...g, value: i%2 === 1 ? 1 : 0, related: i === 1 ? [{ id: 'demo-idea', title: 'Dieci minuti per una nuova lingua', source: 'memory' }] : i === 3 ? [{ id: 'demo-scoperta', title: 'Perché il cielo è azzurro?', source: 'memory' }] : [] })),
};
export function previewResults(data: Bootstrap): SearchResult[] {
  return [...data.memories.map(m => ({ id: m.id, source: 'memory' as const, title: m.title, category: m.category, excerpt: m.content.slice(0, 380), page: null, conversation_id: null, score: 0 })), ...data.wishes.map(w => ({ id: w.id, source: 'wish' as const, title: w.title, category: 'desideri' as const, excerpt: `${w.motivation} ${w.outcome} ${w.next_action}`, page: null, conversation_id: null, score: 0 }))];
}
