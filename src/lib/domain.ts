export const categories = [
  { id: 'scrivere', name: 'Scrivere meglio', short: 'Parole che ti somigliano', color: '#9b7551', icon: 'Feather', suggestions: ['Rendi questo messaggio più gentile.', 'Aiutami a scrivere un’email.', 'Riscrivilo in modo più chiaro.'] },
  { id: 'cucinare', name: 'Cucinare', short: 'Buone idee da portare a tavola', color: '#68866a', icon: 'CookingPot', suggestions: ['Cosa posso cucinare con questi ingredienti?', 'Una ricetta pronta in venti minuti.', 'Ritrova una ricetta che ho salvato.'] },
  { id: 'capire', name: 'Spiegami meglio', short: 'Un piccolo passo, una nuova scoperta', color: '#6c829c', icon: 'Telescope', suggestions: ['Spiegamelo con un esempio.', 'Aiutami a capire questo documento.', 'Parti dalle basi.'] },
  { id: 'desideri', name: 'Desideri', short: 'Dalle possibilità al prossimo passo', color: '#b67b69', icon: 'Flag', suggestions: ['Vorrei comprare casa.', 'Vorrei imparare una lingua.', 'Aiutami a trasformare questa idea in un piano.'] },
] as const;
export type Category = typeof categories[number]['id'];
export type MemoryKind = 'content' | 'preference' | 'idea' | 'discovery';
export const kindLabels: Record<MemoryKind, string> = { content: 'Contenuto', preference: 'Preferenza confermata', idea: 'Idea', discovery: 'Scoperta' };
export const categoryOf = (id: string) => categories.find(c => c.id === id) ?? categories[0];
export type IslandTheme = 'ancient' | 'botanical' | 'observatory' | 'workshop' | 'coastal';
export type IslandDistrict = { id: string; island_id: string; name: string; summary: string; created_at: string; updated_at: string };
export type Island = { id: string; name: string; slug: string; description: string; color: string; icon: string; theme: IslandTheme; profile_summary: string; weight: number; image_document_id?: string | null; districts?: IslandDistrict[]; created_at: string; updated_at: string };
export type Memory = { id: string; title: string; category: Category; kind: MemoryKind; content: string; origin: string; created_at: string; updated_at: string; auto_conversation_id?: string | null; island_id?: string | null; district_id?: string | null; consolidated?: boolean };
export type Conversation = { id: string; title: string; category: Category; created_at: string; searchable: boolean; island_id?: string | null; district_id?: string | null; consolidated?: boolean };
export type Message = { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; created_at: string; reply_to_id?: string | null };
export type Document = { id: string; title: string; category: Category; filename: string; mime: string; scope: 'chat' | 'memory'; conversation_id: string | null; path: string; status: 'processing' | 'ready' | 'no_text' | 'error'; error: string | null; page_count: number | null; origin: 'upload' | 'generated'; created_at: string; preview_url?: string; size_bytes?: number; island_id?: string | null };
export type VideoJob = { id: string; conversation_id: string; prompt: string; category: Category; model: string; duration: number; resolution: string; aspect_ratio: string; status: 'submitting' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'uncertain'; document_id: string | null; cost: number | null; error: string | null; created_at: string };
export type Milestone = { id: string; title: string; done: boolean };
export type Wish = { id: string; title: string; motivation: string; outcome: string; timeframe: string; resources: string; constraints: string; unknowns: string; next_action: string; obstacles: string; decisions: string; milestones: Milestone[]; status: 'active' | 'paused' | 'abandoned'; image_document_id: string | null; created_at: string };
export type SearchResult = { id: string; source: 'memory' | 'message' | 'document' | 'wish'; title: string; category: Category; excerpt: string; page: number | null; conversation_id: string | null; score: number; preview_url?: string };
export type ContextRef = Pick<SearchResult, 'id' | 'source'>;
export type Preferences = { display_name: string; reduced_motion: boolean; island_view: 'illustrated' | 'list'; agent_cycles: number; agent_budget: number; agent_seconds: number };
export const defaultPreferences: Preferences = { display_name: '', reduced_motion: false, island_view: 'illustrated', agent_cycles: 1, agent_budget: 0.2, agent_seconds: 240 };
export type Gauge = { label: string; value: number; max: number; explanation: string; related: { id: string; title: string; source: string }[] };
export const gaugeDefinitions = [
  { label: 'Passioni', max: 4, explanation: 'Categorie in cui hai scritto in almeno due giorni distinti negli ultimi 30 giorni. Scala: 0–4 categorie.' },
  { label: 'Idee', max: 10, explanation: 'Ricordi classificati da te come Idee, salvati negli ultimi 30 giorni e ancora presenti. Scala visiva: 0–10; il conteggio non è limitato.' },
  { label: 'Curiosità', max: 4, explanation: 'Categorie esplorate per la prima volta negli ultimi 30 giorni, sulla base delle conversazioni ancora presenti. Scala: 0–4 ambiti. Non misura la curiosità personale.' },
  { label: 'Scoperte', max: 10, explanation: 'Ricordi classificati da te come Scoperte, salvati negli ultimi 30 giorni e ancora presenti. Scala visiva: 0–10; il conteggio non è limitato.' },
];
export type Role = 'Coordinatore' | 'Progettista' | 'Revisore' | 'Analista degli scenari' | 'Verificatore' | 'Sintesi';
export type AgentStep = { role: Role; content: string; version: number; tokens: number; created_at: string };
export type AgentResult = { proposal: string; questions: string[]; choice: string };
export type AgentSession = { id: string; conversation_id: string; request_message_id?: string | null; category: Category; request: string; status: 'ready' | 'running' | 'waiting' | 'completed' | 'stopped' | 'failed'; version: number; plan: Role[]; cursor: number; steps: AgentStep[]; result: AgentResult | null; interventions: { text: string; created_at: string }[]; cycles: number; budget: number; reserved_cost: number; duration_seconds: number; elapsed_ms: number; lease: string | null; lease_until: string | null; error: string | null; created_at: string };
export type Capabilities = { configured: boolean; ai: boolean; embeddings: boolean; vision: boolean; ocr: boolean; web: boolean; webProvider: 'openrouter' | 'tavily'; images: boolean; imageModel: string; videos: boolean; videoModel: string; videoDuration: number; videoResolution: string; accountDeletion: boolean; model: string };
export type Bootstrap = { capabilities: Capabilities; user: { id: string; email: string } | null; memories: Memory[]; conversations: Conversation[]; documents: Document[]; wishes: Wish[]; sessions: AgentSession[]; videoJobs: VideoJob[]; preferences: Preferences; gauges: Gauge[]; islands: Island[]; districts: IslandDistrict[] };
