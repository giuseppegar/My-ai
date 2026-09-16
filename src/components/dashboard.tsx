'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, Compass, CookingPot, Copy, Download, Eye, Feather, FileText, Flag, History, Home, LoaderCircle, MessageCircle, Pencil, Plus, ScrollText, Search, Settings2, ShieldCheck, Sparkles, Telescope, Trash2, UserRound, Users, X, Image as ImageIcon } from 'lucide-react';
import { categories, categoryOf, gaugeDefinitions, kindLabels, type AgentSession, type Bootstrap, type Category, type ContextRef, type Conversation, type Document, type Gauge, type Memory, type Message, type Preferences, type SearchResult, type VideoJob, type Wish } from '@/lib/domain';
import { demoData } from '@/lib/demo';
import { proposeCategory } from '@/lib/search';
import { Island } from './island';
import { Archipelago } from './archipelago';
import { AnalogGauge, api, dateLabel, Empty, Modal } from './ui';
import { Composer, type PendingFile } from './composer';
import { MemoryEditor, TextArtifactEditor, WishEditor } from './editors';
import { AuthModal, Settings } from './account';
import { AgentsPanel } from './agents-panel';
import { VideoJobs, VideoMonitor } from './video-jobs';

type View = 'home' | 'collection' | 'history' | 'documents' | 'wishes' | 'settings';
type Detail = { id: string; source: SearchResult['source']; title: string; category: Category; text: string; origin?: string; created_at?: string; url?: string; mime?: string; scope?: string; conversation_id?: string; searchable?: boolean; page?: number | null };
const icons = { scrivere: Feather, cucinare: CookingPot, capire: Telescope, desideri: Flag };
const emptyData: Bootstrap = { ...demoData, memories: [], wishes: [], gauges: gaugeDefinitions.map(g => ({ ...g, value: 0, related: [] })) };
const titles: Record<View, string> = { home: 'Il tuo arcipelago', collection: 'Le cose da tenere vicine', history: 'I fili delle tue conversazioni', documents: 'I tuoi documenti, al loro posto', wishes: 'Un passo verso ciò che desideri', settings: 'A modo tuo' };
export function Dashboard() {
  const [data, setData] = useState<Bootstrap>(demoData);
  const [preview, setPreview] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>('home');
  const [category, setCategory] = useState<Category | null>(null);
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [draft, setDraft] = useState('');
  const [refs, setRefs] = useState<(ContextRef & { title: string })[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [memoryEditor, setMemoryEditor] = useState<Partial<Memory> | null>(null);
  const [wishEditor, setWishEditor] = useState<Partial<Wish> | null>(null);
  const [docEditor, setDocEditor] = useState<Document | null>(null);
  const [textEditor, setTextEditor] = useState<{ document: Document; content: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [gauge, setGauge] = useState<Gauge | null>(null);
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [uploadResults, setUploadResults] = useState<Document[]>([]);
  const [help, setHelp] = useState(false);
  const videoRequest = useRef<{ signature: string; id: string } | null>(null);

  const copyText = async (textOrUrl: string, id: string, isUrl = false) => {
    try {
      let text = textOrUrl;
      if (isUrl) {
        const res = await fetch(textOrUrl);
        text = await res.text();
      }
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      setToast('Copiato negli appunti.');
    } catch {
      setToast('Impossibile copiare negli appunti.');
    }
  };

  const openTextEditor = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/file`);
      if (!res.ok) throw new Error('Impossibile leggere il file.');
      const content = await res.text();
      setTextEditor({ document: doc, content });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento del file.');
    }
  };

  const handleSaveTextArtifact = async (form: { title: string; content: string }) => {
    if (!textEditor) return;
    const updated = await api<Document>(`artifacts/${textEditor.document.id}`, 'PATCH', form);
    await refresh();
    if (detail && detail.id === updated.id) {
      setDetail({ ...detail, title: updated.title, text: form.content });
    }
    setToast(`File "${updated.filename}" aggiornato con successo.`);
  };

  const handleAiEditTextArtifact = async (instruction: string) => {
    if (!textEditor) throw new Error('Nessun file aperto.');
    return api<{ title: string; content: string; summary: string }>(`artifacts/${textEditor.document.id}/edit`, 'POST', { instruction, save_directly: false });
  };

  const saveMessageAsArtifact = async (msg: Message) => {
    needAccount();
    try {
      const doc = await api<Document>('artifacts', 'POST', {
        conversation_id: msg.conversation_id,
        category: category || 'capire',
        content: msg.content,
      });
      await refresh();
      setToast(`File "${doc.filename}" creato e salvato nei documenti.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio file non riuscito.');
    }
  };
  const refresh = useCallback(async () => {
    const next = await api<Partial<Bootstrap>>('bootstrap');
    if (!next.capabilities?.configured) { setData({ ...demoData, capabilities: next.capabilities || demoData.capabilities }); setPreview(true); }
    else { setPreview(false); setData(next.user ? next as Bootstrap : { ...emptyData, capabilities: next.capabilities, user: null }); }
    setLoaded(true);
  }, []);
  useEffect(() => { void refresh().catch(e => { setError(e.message); setLoaded(true); }); }, [refresh]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 5500); return () => clearTimeout(timeout); }, [toast]);
  const navigate = (next: View) => { setView(next); setFilter(''); setKindFilter(''); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const perform = async (fn: () => Promise<void>) => { setError(''); setWorking(true); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Operazione non riuscita.'); } finally { setWorking(false); } };
  const updatePreview = (patch: Partial<Bootstrap>) => setData(current => {
    const next = { ...current, ...patch };
    next.gauges = gaugeDefinitions.map((g, i) => { const related = i === 1 || i === 3 ? next.memories.filter(m => m.kind === (i === 1 ? 'idea' : 'discovery')).map(m => ({ id: m.id, title: m.title, source: 'memory' })) : []; return { ...g, value: related.length, related }; });
    return next;
  });
  const needAccount = () => { if (!data.user || preview) { setAuthOpen(true); throw new Error(preview ? 'Questa è un’anteprima: collega Supabase e accedi per conservare chat e file.' : 'Accedi al tuo spazio personale.'); } };
  const handleConsolidate = async () => {
    if (isConsolidating) return;
    setIsConsolidating(true);
    try {
      const result = await api<{ consolidatedCount: number; newIslands: string[]; updatedIslands: string[]; diaryEntry: string }>('islands/consolidate', 'POST', {});
      await refresh();
      setToast(result.diaryEntry || `Memoria consolidata: ${result.newIslands.length} nuove isole.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Consolidamento non riuscito.');
    } finally {
      setIsConsolidating(false);
    }
  };
  const ensureConversation = async (text: string) => {
    if (conversation) return conversation;
    const created = await api<Conversation>('conversations', 'POST', { title: text.trim().slice(0, 100) || 'Una nuova conversazione', category: category || proposeCategory(text), island_id: selectedIslandId || null });
    setConversation(created); return created;
  };
  const focusChat = () => requestAnimationFrame(() => {
    document.getElementById('chat-workspace')?.scrollIntoView({ block: 'start', behavior: data.preferences.reduced_motion ? 'instant' : 'smooth' });
    document.getElementById('chat-input')?.focus({ preventScroll: true });
  });
  const chooseChat = (next: Category | null, islandId?: string | null) => {
    if (chatBusy) return;
    if (next !== category || islandId !== selectedIslandId || (conversation && next !== conversation.category)) { setConversation(null); setMessages([]); setRefs([]); setUploadResults([]); }
    setCategory(next);
    setSelectedIslandId(islandId || null);
    focusChat();
  };
  const updateVideo = async (job: VideoJob) => {
    setData(current => ({ ...current, videoJobs: [job, ...(current.videoJobs || []).filter(j => j.id !== job.id)] }));
    if (job.status === 'completed') {
      await refresh();
      if (conversation?.id === job.conversation_id) setMessages(await api<Message[]>(`conversations/${job.conversation_id}`));
    }
  };
  const submit = async (text: string, files: PendingFile[], mode: { deep: boolean; web: boolean; image: boolean; video: boolean; artifact: boolean }, uploaded: (id: string) => void, onlyFiles: boolean) => {
    needAccount();
    if (mode.image || mode.video || mode.artifact) {
      const conv = await ensureConversation(text);
      try {
        const input = { prompt: text, conversation_id: conv.id, category: category || proposeCategory(text), island_id: selectedIslandId || null };
        if (mode.video) {
          const signature = JSON.stringify(input);
          if (videoRequest.current?.signature !== signature) videoRequest.current = { signature, id: crypto.randomUUID() };
          const job = await api<VideoJob>('videos', 'POST', { ...input, request_id: videoRequest.current.id, confirmed: true });
          setToast(job.error || 'Richiesta video salvata. La generazione continua su OpenRouter.');
        } else if (mode.image) {
          const doc = await api<Document>('images', 'POST', input);
          setToast(doc.scope === 'memory' ? 'Immagine salvata e catalogata nell’isola.' : 'Immagine salvata solo in questa chat riservata.');
        } else if (mode.artifact) {
          const doc = await api<Document>('artifacts', 'POST', input);
          setToast(doc.scope === 'memory' ? `File "${doc.filename}" generato e catalogato nell’isola.` : `File "${doc.filename}" salvato solo in questa chat riservata.`);
        }
      } finally {
        setMessages(await api<Message[]>(`conversations/${conv.id}`));
        await refresh();
      }
      if (mode.video) videoRequest.current = null;
      return;
    }
    if (!onlyFiles && !data.capabilities.ai) throw new Error('DeepSeek non è ancora configurato. I tuoi ricordi funzionano indipendentemente dall’AI.');
    const conv = await ensureConversation(text);
    const unreadable: Document[] = [];
    for (const item of files) {
      const body = new FormData(); body.set('file', item.file); body.set('scope', item.scope); body.set('category', category || conv.category); body.set('conversation_id', conv.id);
      const doc = await api<Document>('documents', 'POST', body); uploaded(item.id);
      setUploadResults(current => [...current.filter(d => d.id !== doc.id), doc]);
      if (doc.status === 'error' || (doc.status === 'no_text' && !(doc.mime.startsWith('image/') && data.capabilities.vision && !mode.deep))) unreadable.push(doc);
    }
    if (onlyFiles || unreadable.length) {
      await refresh();
      if (unreadable.length) {
        const notice = 'File conservati, ma alcuni non hanno testo leggibile. Controlla gli esiti sotto: nessuna richiesta AI avviata.';
        if (!onlyFiles) throw new Error(notice);
        setToast(notice);
      } else setToast('Allegati caricati. Gli esiti di lettura sono qui sotto. Nessuna richiesta AI avviata.');
      return;
    }
    const input = { content: text, conversation_id: conv.id, category: category || proposeCategory(text), refs: refs.map(({ id, source }) => ({ id, source })), web: mode.web, island_id: selectedIslandId || conv.island_id || null };
    try {
      if (mode.deep) setAgent(await api<AgentSession>('agents', 'POST', input));
      else await api('chat', 'POST', input);
    } finally {
      setMessages(await api<Message[]>(`conversations/${conv.id}`));
      await refresh();
    }
    setRefs([]);
  };
  const saveMemory = async (content: Partial<Memory> & { confirmed: boolean }) => {
    if (preview) {
      const record = { ...content, id: content.id || crypto.randomUUID(), created_at: content.created_at || new Date().toISOString(), updated_at: new Date().toISOString() } as Memory;
      updatePreview({ memories: [record, ...data.memories.filter(m => m.id !== record.id)] });
    } else { needAccount(); await api(content.id ? `memories/${content.id}` : 'memories', content.id ? 'PATCH' : 'POST', content); await refresh(); }
    setToast(preview ? 'Ricordo aggiunto all’anteprima: scomparirà ricaricando la pagina.' : 'Un nuovo pezzetto della tua isola.');
  };
  const saveWish = async (content: Partial<Wish>) => {
    if (preview) { const record = { ...content, id: content.id || crypto.randomUUID(), created_at: content.created_at || new Date().toISOString() } as Wish; updatePreview({ wishes: [record, ...data.wishes.filter(w => w.id !== record.id)] }); }
    else { needAccount(); await api(content.id ? `wishes/${content.id}` : 'wishes', content.id ? 'PATCH' : 'POST', content); await refresh(); }
    setToast(preview ? 'Percorso aggiornato solo nell’anteprima.' : 'Percorso aggiornato con le tue conferme.');
  };
  const openContent = async (item: ContextRef & { page?: number | null }) => {
    if (preview) {
      const memory = data.memories.find(m => m.id === item.id);
      if (memory) setDetail({ ...memory, source: 'memory', text: memory.content });
      const wish = data.wishes.find(w => w.id === item.id);
      if (wish) setWishEditor(wish);
    } else {
      const content = await api<Detail>(`content/${item.source}/${item.id}${item.page ? `?page=${item.page}` : ''}`);
      if (item.source === 'document') { const file = await api<{ url: string }>(`documents/${item.id}`); content.url = file.url; }
      setDetail({ ...content, page: item.page });
    }
  };
  const openConversation = async (conv: Conversation) => {
    needAccount(); setMessages(await api<Message[]>(`conversations/${conv.id}`)); setConversation(conv); setCategory(conv.category); setRefs([]); setDraft(''); setUploadResults([]); navigate('home'); focusChat();
  };
  const restart = async (item: Detail) => {
    if ((item.scope === 'chat' || item.searchable === false) && item.conversation_id && item.conversation_id !== conversation?.id) {
      const conv = data.conversations.find(c => c.id === item.conversation_id);
      if (conv) await openConversation(conv);
    }
    setRefs(current => [...current.filter(r => r.id !== item.id), { id: item.id, source: item.source, title: item.title }].slice(-6));
    setCategory(item.category); setDetail(null); navigate('home'); focusChat(); setToast('Contesto aggiunto. L’AI parte solo quando decidi tu.');
  };
  const remove = async (resource: string, id: string, title: string) => {
    if (!window.confirm(`Eliminare “${title}”?${resource === 'conversations' ? ' Saranno eliminati messaggi, sessioni e allegati esclusivi; i contenuti conservati nelle isole restano.' : ' L’operazione non è annullabile.'}`)) return;
    if (preview) {
      if (resource === 'memories') updatePreview({ memories: data.memories.filter(m => m.id !== id) });
      if (resource === 'wishes') updatePreview({ wishes: data.wishes.filter(w => w.id !== id) });
    } else { await api(`${resource}/${id}`, 'DELETE'); await refresh(); }
    if (resource === 'documents') setUploadResults(current => current.filter(d => d.id !== id));
    if (resource === 'conversations' && conversation?.id === id) { setConversation(null); setMessages([]); setRefs([]); }
    setDetail(null); setToast('Contenuto eliminato. Anche la ricerca è aggiornata.');
  };
  const savePrefs = async (prefs: Preferences) => { if (preview) updatePreview({ preferences: prefs }); else { needAccount(); await api('settings', 'PATCH', prefs); await refresh(); } };
  const logout = async () => { await api('auth/logout', 'POST', {}); videoRequest.current = null; setMessages([]); setConversation(null); setRefs([]); setDraft(''); setAgent(null); setDetail(null); setUploadResults([]); await refresh(); navigate('home'); };
  const filteredMemories = data.memories.filter(m => (!category || m.category === category) && (!selectedIslandId || m.island_id === selectedIslandId) && (!kindFilter || m.kind === kindFilter) && `${m.title} ${m.content}`.toLowerCase().includes(filter.toLowerCase()));
  const chatDocuments = [...new Map([...uploadResults, ...data.documents].filter(d => d.conversation_id === conversation?.id).map(d => [d.id, d])).values()];
  const chatImages = chatDocuments.filter(d => d.origin === 'generated' && d.mime.startsWith('image/'));
  const chatArtifacts = chatDocuments.filter(d => (d.origin === 'generated' || d.mime === 'text/plain') && (d.mime === 'text/plain' || d.filename.endsWith('.md') || d.filename.endsWith('.txt')));
  const canUse = preview || Boolean(data.user);
  const selectedIsland = data.islands?.find(i => i.id === selectedIslandId);
  const selectedCategory = category ? categoryOf(category) : null;
  const activeSuggestions = selectedCategory?.suggestions || ['Aiutami a scrivere un’email.', 'Cosa cucino stasera?', 'Vorrei dare forma a un’idea.'];
  return <div className={data.preferences.reduced_motion ? 'app reduce-motion' : 'app'}>
    <a className="skip-link" href="#main">Vai al contenuto</a>
    <header className="site-header"><div className="header-inner"><button className="brand" onClick={() => navigate('home')} aria-label="My ai, pagina iniziale"><span className="brand-mark"><Compass size={24} strokeWidth={1.4}/></span><span>my<span className="brand-ai">ai</span><small>IL TUO ARCIPELAGO</small></span></button>
      <nav className="desktop-nav" aria-label="Navigazione principale">{([['home','Il mio spazio',Home],['collection','Memoria',BookOpen],['history','Cronologia',History],['documents','Documenti',FileText]] as const).map(([key,label,Icon]) => <button className={view === key ? 'nav-link active' : 'nav-link'} key={key} onClick={() => { if (key === 'collection') { setCategory(null); setSelectedIslandId(null); } navigate(key); }} aria-current={view === key ? 'page' : undefined}><Icon size={16}/>{label}</button>)}</nav>
      <div className="header-actions"><button className="icon-button desktop-help" aria-label="Come funziona My ai" onClick={() => setHelp(true)}><CircleHelp size={19}/></button><button className={`icon-button ${view === 'settings' ? 'active' : ''}`} aria-label="Impostazioni" onClick={() => navigate('settings')}><Settings2 size={19}/></button><button className="account-button" onClick={() => data.user && !preview ? navigate('settings') : setAuthOpen(true)} aria-label={data.user ? 'Il tuo account' : 'Accedi al tuo account'}><UserRound size={16}/><span>{data.user ? data.preferences.display_name || 'Il tuo account' : 'Accedi'}</span></button></div>
    </div></header>
    {preview && loaded && <div className="preview-banner"><span><span className="status-dot"/>Anteprima dimostrativa · esempi e modifiche solo in questa pagina, nessun salvataggio reale.</span><button onClick={() => setAuthOpen(true)}>Collega il tuo spazio <ArrowRight size={13}/></button></div>}
    <main id="main" className="main-container">
      <div className="page-eyebrow"><span><span className="little-line"/>{view === 'home' ? 'UNO SPAZIO PER COLTIVARE LE TUE IDEE' : 'IL TUO SPAZIO PERSONALE'}</span><span className="today">{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div>
      {error && <div className="notice error" role="alert">{error}<button className="icon-button" aria-label="Chiudi errore" onClick={() => setError('')}><X size={16}/></button></div>}
      {!loaded ? <div className="loading-home" role="status"><LoaderCircle className="spin" size={25}/>Preparo il tuo spazio…</div> : !canUse && view !== 'settings' ? <section className="welcome"><Island category="desideri"/><h1>Le tue idee meritano<br/>un posto a cui tornare.</h1><p>Una chat, quattro isole e una memoria che scegli tu.<br/>Accedi per ritrovare il tuo mondo, da qualsiasi dispositivo.</p><button className="button primary" onClick={() => setAuthOpen(true)}>Entra nel tuo arcipelago <ArrowRight size={17}/></button></section> : <>
        {view === 'home' && <>
          <Archipelago data={data} category={category} selectedIslandId={selectedIslandId} disabled={chatBusy} onChat={chooseChat} onOpen={(next, islId) => { setCategory(next); setSelectedIslandId(islId || null); navigate(next === 'desideri' ? 'wishes' : 'collection'); }} onList={() => { setCategory(null); setSelectedIslandId(null); navigate('collection'); }} onConsolidate={handleConsolidate} isConsolidating={isConsolidating}/>
          <section id="chat-workspace" className={`chat-section chat-island category-${category || 'libera'}`} aria-labelledby="chat-title"><div className="chat-island-heading"><span className="badge" style={selectedIsland ? { borderColor: selectedIsland.color, color: selectedIsland.color } : undefined}>{selectedIsland ? `Isola: ${selectedIsland.name}` : selectedCategory?.name || 'Chat libera'}</span><button className="button ghost small" onClick={() => document.getElementById('islands-title')?.scrollIntoView({ block: 'start' })}>Torna all’arcipelago ↑</button></div><div className="chat-intro"><div className="chat-spark"><Sparkles size={19} strokeWidth={1.3}/></div><h2 id="chat-title">{selectedIsland ? `Stiamo esplorando ${selectedIsland.name}` : selectedCategory ? `Parliamo di ${selectedCategory.name.toLowerCase()}` : data.preferences.display_name ? `Cosa esploriamo, ${data.preferences.display_name}?` : 'La tua isola per parlare liberamente'}</h2><p>{selectedIsland ? selectedIsland.description || 'I tuoi ricordi e scoperte in quest’isola arricchiscono ogni risposta.' : 'Ritrova un ricordo. Fai spazio a un’idea. Segui una curiosità.'}</p>{selectedIsland?.profile_summary && <div className="notice sage" style={{ fontSize: '12px', marginTop: '10px' }}><Sparkles size={14}/><span><strong>Stile & memoria appresa:</strong> {selectedIsland.profile_summary}</span></div>}</div>
            {conversation && <div className="conversation-heading"><span><MessageCircle size={16}/>{conversation.title}</span><button className="button ghost small" disabled={chatBusy} onClick={() => { setConversation(null); setMessages([]); setDraft(''); setRefs([]); setUploadResults([]); focusChat(); }}><Plus size={14}/>Nuova chat</button></div>}
            {messages.length > 0 && <div className="message-list" aria-label="Messaggi della conversazione">{messages.map(message => <article className={`message ${message.role}`} key={message.id}><div className="message-author">{message.role === 'user' ? <UserRound size={14}/> : <Sparkles size={14}/>}<strong>{message.role === 'user' ? 'Tu' : 'My ai'}</strong><span>{dateLabel(message.created_at)}</span></div><div className="prose">{message.content}</div>{message.role === 'assistant' && <div className="button-wrap" style={{ marginTop: '10px' }}>{(() => { const saved = data.memories.find(m => m.id === message.reply_to_id); return saved ? <button className="button ghost small" onClick={() => setMemoryEditor(saved)}><Check size={14}/>Salvato in {categoryOf(saved.category).name} · Modifica</button> : <button className="button ghost small" onClick={() => setMemoryEditor({ title: message.content.split('\n')[0].slice(0, 100), content: message.content, category: category || proposeCategory(message.content), kind: 'content', origin: `Chat · ${conversation?.title || 'Conversazione'}`, island_id: selectedIslandId || null })}><Plus size={14}/>Salva nell’isola</button>; })()}<button className="button ghost small" onClick={() => void saveMessageAsArtifact(message)} title="Salva questa risposta come file di testo o markdown"><ScrollText size={14}/>Salva come file di testo</button></div>}</article>)}</div>}
            {chatImages.length > 0 && <section className="generated-gallery" aria-label="Immagini generate"><h3><ImageIcon size={15}/>Immagini generate in questa chat</h3><div className="generated-grid">{chatImages.map(doc => <figure key={doc.id}><button className="gallery-image" aria-label={`Apri immagine ${doc.title}`} onClick={() => { void perform(() => openContent({ id: doc.id, source: 'document' })); }}><img src={`/api/documents/${doc.id}/preview`} alt={doc.title} loading="lazy"/></button><figcaption>{doc.title}</figcaption><div className="button-wrap"><button className="button secondary small" disabled={doc.scope === 'memory'} onClick={() => { void perform(async () => { await api(`documents/${doc.id}`, 'PATCH', { title: doc.title, category: doc.category, scope: 'memory' }); await refresh(); setToast('Immagine conservata nella memoria: ora è ricercabile.'); }); }}>{doc.scope === 'memory' ? 'Nella memoria ✓' : 'Conserva nella memoria'}</button><button className="icon-button" aria-label={`Elimina immagine ${doc.title}`} onClick={() => { void perform(() => remove('documents', doc.id, doc.title)); }}><Trash2 size={15}/></button></div></figure>)}</div></section>}
            {chatArtifacts.length > 0 && <section className="generated-gallery" aria-label="File di testo e artefatti generati"><h3><ScrollText size={15}/>File di testo e artefatti in questa chat</h3><div className="artifacts-grid">{chatArtifacts.map(doc => <article key={doc.id} className="artifact-card panel"><div className="artifact-header"><span className="artifact-badge">{doc.filename.split('.').pop()?.toUpperCase() || 'TXT'}</span><strong className="artifact-filename">{doc.filename}</strong><span className="small muted">{dateLabel(doc.created_at)}</span></div><h4 className="artifact-title">{doc.title}</h4><div className="button-wrap"><button className="button secondary small" onClick={() => { void perform(() => openContent({ id: doc.id, source: 'document' })); }}><Eye size={13}/>Apri</button><button className="button secondary small" onClick={() => { void openTextEditor(doc); }}><Pencil size={13}/>Modifica testo</button><button className="button secondary small" onClick={() => { void copyText(`/api/documents/${doc.id}/file`, doc.id, true); }}>{copiedId === doc.id ? <Check size={13}/> : <Copy size={13}/>}{copiedId === doc.id ? 'Copiato' : 'Copia'}</button><a className="button secondary small" href={`/api/documents/${doc.id}/file?download=1`} download={doc.filename}><Download size={13}/>Scarica</a><button className="button secondary small" disabled={doc.scope === 'memory'} onClick={() => { void perform(async () => { await api(`documents/${doc.id}`, 'PATCH', { title: doc.title, category: doc.category, scope: 'memory' }); await refresh(); setToast('File conservato nella memoria dell’isola.'); }); }}>{doc.scope === 'memory' ? 'Nell’isola ✓' : 'Salva nell’isola'}</button><button className="icon-button" aria-label={`Elimina ${doc.title}`} onClick={() => { void perform(() => remove('documents', doc.id, doc.title)); }}><Trash2 size={14}/></button></div></article>)}</div></section>}
            <VideoJobs jobs={(data.videoJobs || []).filter(j => j.conversation_id === conversation?.id)} documentIds={data.documents.map(d => d.id)} onRefresh={id => { void perform(async () => updateVideo(await api<VideoJob>(`videos/${id}/refresh`, 'POST', {}))); }}/>
            {selectedIsland ? (
              <div className="context-category">
                <span className="badge" style={{ borderColor: selectedIsland.color, color: selectedIsland.color }}>Contesto Isola: {selectedIsland.name}</span>
                <button className="button ghost small" disabled={chatBusy} onClick={() => chooseChat(null, null)}>Torna a Chat libera <X size={13}/></button>
              </div>
            ) : selectedCategory ? (
              <div className="context-category">
                <span className={`badge category-${selectedCategory.id}`}>Contesto: {selectedCategory.name}</span>
                <button className="button ghost small" disabled={chatBusy} onClick={() => chooseChat(null, null)}>Scrivi liberamente <X size={13}/></button>
              </div>
            ) : null}
            {chatDocuments.length > 0 && <section className="upload-results" aria-label="Esiti lettura allegati" aria-live="polite">{chatDocuments.map(doc => <div className={`notice ${doc.status === 'ready' ? 'sage' : ''}`} key={doc.id}><FileText size={18}/><div><strong>{doc.title}</strong><p>{doc.origin === 'generated' ? 'Contenuto generato e salvato nell’archivio privato.' : doc.status === 'ready' ? `Testo letto e disponibile nella chat${doc.page_count ? ` · ${doc.page_count} pagine` : ''}.` : 'Originale conservato, testo non disponibile.'}</p>{doc.error && <p>{doc.error}</p>}<button className="button secondary small" onClick={() => { void perform(() => openContent({ id: doc.id, source: 'document' })); }}>Apri allegato</button></div></div>)}</section>}
            <Composer key={`${data.user?.id || 'preview'}`} data={data} preview={preview} value={draft} onChange={setDraft} refs={refs} onRemoveRef={id => setRefs(refs.filter(r => r.id !== id))} onOpen={item => { void perform(() => openContent(item)); }} onSubmit={submit} onBusyChange={setChatBusy}/>
            <div className="starter-prompts"><span>Uno spunto?</span>{activeSuggestions.map(text => <button key={text} onClick={() => { setDraft(text); document.getElementById('chat-input')?.focus(); }}>{text}<ArrowUpRightIcon/></button>)}</div>
          </section>
          <section className="gauges-section" aria-labelledby="gauges-title"><div className="section-kicker"><h2 id="gauges-title">Piccoli segni delle tue esplorazioni</h2><span>Attività nell’app, non punteggi personali <button className="icon-button tiny" aria-label="Come sono calcolati gli indicatori" onClick={() => setGauge(data.gauges[0])}><CircleHelp size={14}/></button></span></div><div className="gauges-grid">{data.gauges.map((g, i) => <AnalogGauge key={g.label} gauge={g} index={i} onClick={() => setGauge(g)}/>)}</div></section>
        </>}
        {view !== 'home' && <div className="view-heading"><button className="button ghost small" onClick={() => navigate('home')}><ArrowLeft size={15}/>Il mio spazio</button><h1>{view === 'collection' && selectedCategory ? selectedCategory.name : titles[view]}</h1></div>}
        {view === 'collection' && <>
          <div className="toolbar"><div className="filter-search"><Search size={17}/><input aria-label="Cerca nella raccolta" value={filter} placeholder="Cerca in questa raccolta…" onChange={e => setFilter(e.target.value)}/></div><select aria-label="Filtra per isola" value={selectedIslandId || category || ''} onChange={e => { const val = e.target.value; const isIsland = data.islands?.some(i => i.id === val); if (isIsland) { setSelectedIslandId(val); setCategory(null); } else { setSelectedIslandId(null); setCategory(val as Category || null); } }}><option value="">Tutte le isole</option>{data.islands && data.islands.length > 0 && <optgroup label="Le tue Isole">{data.islands.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>}<optgroup label="Ambiti base">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup></select><select aria-label="Filtra ricordi per tipo" value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value="">Tutti i ricordi</option>{Object.entries(kindLabels).map(([key,value]) => <option value={key} key={key}>{value}</option>)}</select><button className="button primary" onClick={() => setMemoryEditor({ category: category || 'capire', island_id: selectedIslandId || null })}><Plus size={16}/>Nuovo ricordo</button></div>
          {!filteredMemories.length ? <Empty title="Qui c’è spazio per qualcosa di bello">Le nuove richieste vengono salvate qui automaticamente, tranne quelle nelle chat riservate. Puoi anche aggiungere un ricordo con le tue parole.</Empty> : <div className="memory-grid">{filteredMemories.map(m => { const Icon = icons[m.category]; return <article className={`memory-card category-${m.category}`} key={m.id}><div className="card-meta"><span><Icon size={15}/>{categoryOf(m.category).name}</span><span>{kindLabels[m.kind]}</span></div><button className="card-main" onClick={() => { void perform(() => openContent({ id: m.id, source: 'memory' })); }}><h3>{m.title}</h3><p>{m.content.replace('ESEMPIO DIMOSTRATIVO', '').slice(0, 200)}</p></button><div className="card-footer"><span>{dateLabel(m.created_at)}</span><button className="icon-button" aria-label={`Modifica ${m.title}`} onClick={() => setMemoryEditor(m)}><Pencil size={15}/></button><button className="icon-button" aria-label={`Elimina ${m.title}`} onClick={() => { void perform(() => remove('memories', m.id, m.title)); }}><Trash2 size={15}/></button></div></article>; })}</div>}
          {data.documents.some(d => d.scope === 'memory' && (!category || d.category === category)) && <section className="panel collection-docs"><h3>Documenti in quest’isola</h3>{data.documents.filter(d => d.scope === 'memory' && (!category || d.category === category) && d.title.toLowerCase().includes(filter.toLowerCase())).map(d => <button className="list-row" key={d.id} onClick={() => { void perform(() => openContent({ id: d.id, source: 'document' })); }}><FileText size={18}/><span>{d.title}</span><ArrowRight size={16}/></button>)}</section>}
          {category === 'desideri' && <button className="button secondary" onClick={() => navigate('wishes')}><Flag size={16}/>Apri i percorsi dei desideri</button>}
        </>}
        {view === 'history' && <><p className="muted">Cronologia e catalogazione delle nuove richieste sono automatiche. Puoi modificare o eliminare i ricordi nelle isole. Le chat riservate restano escluse dalla memoria globale.</p>{!data.conversations.length ? <Empty title="Ogni conversazione è un nuovo filo">Dopo l’accesso, le chat realmente inviate compariranno qui. Nessuna conversazione dimostrativa viene spacciata per tua.</Empty> : <div className="panel">{[...data.conversations].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(conv => <div className="history-row" key={conv.id}><MessageCircle size={20}/><button className="card-main" onClick={() => { void perform(() => openConversation(conv)); }}><h3>{conv.title}</h3><p>{categoryOf(conv.category).name} · {dateLabel(conv.created_at)}{!conv.searchable && ' · Esclusa dalla ricerca globale'}</p></button><button className="icon-button" aria-label={`Elimina chat ${conv.title}`} onClick={() => { void perform(() => remove('conversations', conv.id, conv.title)); }}><Trash2 size={17}/></button></div>)}</div>}
          <h2 className="subsection-title">I tuoi tavoli di approfondimento</h2>{!data.sessions.length ? <p className="muted">La modalità Approfondisci parte solo quando la scegli.</p> : data.sessions.map(s => <div className="history-row panel" key={s.id}><Users size={19}/><button className="card-main" onClick={() => setAgent(s)}><h3>{s.request.slice(0, 100)}</h3><p>{s.steps.length} contributi · {({ ready: 'Da continuare', running: 'In elaborazione', waiting: 'Attende una tua scelta', completed: 'Completato', stopped: 'Interrotto', failed: 'Non completato' })[s.status]}</p></button><button className="icon-button" aria-label="Elimina sessione agenti" onClick={() => { void perform(() => remove('agents', s.id, s.request.slice(0,80))); }}><Trash2 size={16}/></button></div>)}</>}
        {view === 'documents' && <><div className="toolbar"><p className="muted">PDF, DOCX, TXT e immagini · massimo 10 MB per file</p><button className="button primary" onClick={() => { navigate('home'); focusChat(); setToast('Usa il pulsante + nella chat: vedrai l’anteprima prima di caricare.'); }}><Plus size={16}/>Carica dalla chat</button></div><div className="notice sage"><ShieldCheck size={20}/><p>“Solo per questa chat” resta fuori dalla ricerca globale. “Conserva nella memoria” aggiunge il documento anche all’isola. L’AI non parte con il caricamento.</p></div>
          <VideoJobs jobs={data.videoJobs || []} documentIds={data.documents.map(d => d.id)} onRefresh={id => { void perform(async () => updateVideo(await api<VideoJob>(`videos/${id}/refresh`, 'POST', {}))); }}/>
          {!data.documents.length ? <Empty title="Un posto sicuro per le tue pagine">Aggiungi un file con il + nella chat, scegli come conservarlo e conferma il caricamento.</Empty> : <div className="document-grid">{data.documents.map(d => <article className="document-card panel" key={d.id}>{d.mime === 'video/mp4' ? <video className="document-preview" controls playsInline muted preload="none" src={`/api/documents/${d.id}/file`} aria-label={`Video: ${d.title}`}/> : d.mime.startsWith('image/') ? <img className="document-preview" src={`/api/documents/${d.id}/preview`} alt={d.title}/> : <div className={`document-cover category-${d.category}`}><FileText size={42} strokeWidth={1}/><span>{d.filename.split('.').pop()?.toUpperCase()}</span></div>}<h3>{d.title}</h3><p className="small muted">{categoryOf(d.category).name} · {d.scope === 'chat' ? 'Solo per questa chat' : 'Conservato nella memoria'}</p><span className="badge">{d.origin === 'generated' ? (d.mime === 'text/plain' ? 'Artefatto generato' : 'Media generato e salvato') : ({ processing: 'Elaborazione in corso', ready: 'Testo indicizzato', no_text: 'Senza testo estraibile', error: 'Estrazione non riuscita' })[d.status]}{d.page_count ? ` · ${d.page_count} pagine` : ''}</span>{d.error && <p className="small muted">{d.error}</p>}<div className="button-wrap"><button className="button secondary small" onClick={() => { void perform(() => openContent({ id: d.id, source: 'document' })); }}>Apri</button>{(d.mime === 'text/plain' || d.filename.endsWith('.md') || d.filename.endsWith('.txt')) && <button className="button secondary small" onClick={() => { void openTextEditor(d); }}><Pencil size={13}/>Modifica testo</button>}<button className="icon-button" aria-label={`Modifica documento ${d.title}`} onClick={() => setDocEditor(d)}><Pencil size={16}/></button><button className="icon-button" aria-label={`Elimina documento ${d.title}`} onClick={() => { void perform(() => remove('documents', d.id, d.title)); }}><Trash2 size={16}/></button><button className="button ghost small" disabled={working || d.mime.startsWith('video/')} onClick={() => { void perform(async () => { const result = await api<Document>(`documents/${d.id}/reprocess`, 'POST', {}); setUploadResults(current => current.map(doc => doc.id === result.id ? result : doc)); await refresh(); setToast(result.error || 'Testo letto e reindicizzato.'); }); }}>Reindicizza</button></div></article>)}</div>}
        </>}
        {view === 'wishes' && <><div className="toolbar"><p className="muted">Niente corse, niente penalità. I progressi li confermi tu.</p><div className="button-wrap"><button className="button secondary" onClick={() => { setCategory('desideri'); navigate('collection'); }}><BookOpen size={16}/>Ricordi dell’isola</button><button className="button primary" onClick={() => setWishEditor({})}><Plus size={16}/>Nuovo desiderio</button></div></div>
          {!data.wishes.length ? <div className="wish-empty"><Island category="desideri"/><Empty title="I percorsi più belli iniziano con un “vorrei”">Una lingua, una casa, un progetto. Dai un nome al tuo desiderio e scegli il primo passo, senza inventare quello che ancora non sai.</Empty><button className="button primary" onClick={() => setWishEditor({})}>Dai forma a un desiderio <ArrowRight size={16}/></button></div> : <div className="wish-grid">{data.wishes.map(w => { const done = w.milestones.filter(m => m.done).length; return <article className="wish-card panel" key={w.id}>{w.image_document_id ? <img className="wish-image" src={`/api/documents/${w.image_document_id}/preview`} alt={w.title}/> : <div className="wish-art"><Island category="desideri" count={done}/></div>}<div className="wish-content"><span className="badge">{({ active: 'In cammino', paused: 'In pausa', abandoned: 'Un’altra strada' })[w.status]}</span><h2>{w.title}</h2><p>{w.motivation || 'La tua motivazione può prendere forma con calma.'}</p><ol className="wish-path" aria-label="Tappe confermate">{w.milestones.map((m, i) => <li key={m.id} className={m.done ? 'done' : ''}><span>{m.done ? <Check size={14}/> : i+1}</span><small>{m.title}{m.done ? ' · completata' : ''}</small></li>)}</ol><p className="small muted">{done} di {w.milestones.length} tappe confermate · {w.milestones.length ? Math.round(done/w.milestones.length*100) : 0}%</p><div className="next-action"><Flag size={17}/><div><span>IL PROSSIMO PICCOLO PASSO</span><p>{w.next_action || 'Ancora da scegliere, insieme a te.'}</p></div></div><div className="button-wrap"><button className="button secondary" onClick={() => setWishEditor(w)}><Pencil size={15}/>Percorso e progressi</button><button className="icon-button" aria-label={`Elimina desiderio ${w.title}`} onClick={() => { void perform(() => remove('wishes', w.id, w.title)); }}><Trash2 size={16}/></button></div></div></article>; })}</div>}
        </>}
        {view === 'settings' && <Settings key={data.user?.id || 'preview'} data={data} preview={preview || !data.user} onSave={savePrefs} onLogout={logout}/>}
      </>}
      <footer className="site-footer"><span><Compass size={16}/>myai <span className="muted">· uno spazio che cresce con te</span></span><button onClick={() => navigate('settings')}><ShieldCheck size={13}/>Privato, per scelta</button></footer>
    </main>
    <VideoMonitor jobs={data.videoJobs || []} enabled={!preview && Boolean(data.user)} onJob={updateVideo} onError={setError}/>
    <nav className="mobile-nav" aria-label="Navigazione mobile">{([['home','Spazio',Home],['collection','Memoria',BookOpen],['history','Cronologia',History],['documents','Documenti',FileText],['wishes','Desideri',Flag]] as const).map(([key,label,Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} className={view === key ? 'active' : ''} onClick={() => { if (key === 'collection') setCategory(null); navigate(key); }}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}<button className="icon-button" aria-label="Chiudi notifica" onClick={() => setToast('')}><X size={15}/></button></div>}
    {authOpen && <AuthModal configured={data.capabilities.configured} onClose={() => setAuthOpen(false)} onSuccess={refresh}/>}
    {memoryEditor && <MemoryEditor initial={memoryEditor} onClose={() => setMemoryEditor(null)} onSave={saveMemory}/>}
    {wishEditor && <WishEditor initial={wishEditor} documents={data.documents} onClose={() => setWishEditor(null)} onSave={saveWish}/>}
    {detail && <Modal title={detail.title} onClose={() => setDetail(null)} wide><div className="detail-meta"><span className={`badge category-${detail.category}`}>{categoryOf(detail.category).name}</span><span className="small muted">{detail.origin || 'Dal tuo spazio'}{detail.created_at ? ` · ${dateLabel(detail.created_at)}` : ''}{detail.page ? ` · pagina ${detail.page}` : ''}</span></div>{detail.mime?.startsWith('image/') && <img className="detail-image" src={`/api/documents/${detail.id}/preview`} alt={detail.title}/>}{detail.mime === 'video/mp4' && <video className="detail-video" controls playsInline muted preload="none" src={`/api/documents/${detail.id}/file`} aria-label={`Video: ${detail.title}`}/>}<div className="prose detail-text">{detail.text || 'Nessun testo estratto. Il documento originale è disponibile sotto.'}</div><div className="button-wrap">{detail.url && <a className="button secondary" href={detail.url + (detail.page ? `#page=${detail.page}` : '')} target="_blank" rel="noreferrer"><Download size={16}/>Apri file originale</a>}{detail.text && <button className="button secondary" onClick={() => { void copyText(detail.text, detail.id); }}>{copiedId === detail.id ? <Check size={16}/> : <Copy size={16}/>}{copiedId === detail.id ? 'Copiato ✓' : 'Copia testo'}</button>}{detail.source === 'document' && (!detail.mime || detail.mime === 'text/plain') && (() => { const doc = data.documents.find(d => d.id === detail.id); return doc ? <button className="button secondary" onClick={() => { void openTextEditor(doc); setDetail(null); }}><Pencil size={16}/>Modifica testo</button> : null; })()}<button className="button primary" onClick={() => { void perform(() => restart(detail)); }}>Ripartiamo da qui <ArrowRight size={16}/></button>{detail.source === 'memory' && <button className="button secondary" onClick={() => { const memory = data.memories.find(m => m.id === detail.id); if (memory) setMemoryEditor(memory); setDetail(null); }}><Pencil size={16}/>Modifica ricordo</button>}</div><p className="small muted">Aggiungere contesto non avvia una risposta AI.{detail.scope === 'chat' ? ' Questo allegato resta nella conversazione di origine.' : ''}</p></Modal>}
    {docEditor && <Modal title="Dove vive questo documento?" onClose={() => setDocEditor(null)}><form className="form-stack" onSubmit={e => { e.preventDefault(); void perform(async () => { await api(`documents/${docEditor.id}`, 'PATCH', { title: docEditor.title, category: docEditor.category, scope: docEditor.scope }); setDocEditor(null); await refresh(); }); }}><label>Titolo<input maxLength={150} required value={docEditor.title} onChange={e => setDocEditor({ ...docEditor, title: e.target.value })}/></label><label>Isola<select value={docEditor.category} onChange={e => setDocEditor({ ...docEditor, category: e.target.value as Category })}>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Conservazione<select value={docEditor.scope} onChange={e => setDocEditor({ ...docEditor, scope: e.target.value as Document['scope'] })}><option value="memory">Conserva nella memoria</option>{docEditor.conversation_id && <option value="chat">Solo per questa chat</option>}</select></label><p className="small muted">Cambiare ambito aggiorna subito la ricerca. Dopo il passaggio a memoria, usa Reindicizza per aggiungere gli embeddings se configurati.</p><button className="button primary" disabled={working}>Salva documento</button></form></Modal>}
    {textEditor && <TextArtifactEditor document={textEditor.document} initialContent={textEditor.content} onClose={() => setTextEditor(null)} onSave={handleSaveTextArtifact} onAiEdit={handleAiEditTextArtifact}/>}
    {gauge && <Modal title={`${gauge.label} · da dove viene la lancetta`} onClose={() => setGauge(null)}><p>{gauge.explanation}</p><p className="notice sage">{gauge.value} {gauge.max === 4 ? 'categorie' : 'ricordi'} · ultimi 30 giorni, giorni distinti calcolati in UTC.{preview ? ' Dati dimostrativi.' : ''}</p><p className="small muted">Nessun punteggio generato dall’AI, nessuna misura di intelligenza, benessere o valore personale. Eliminando un contenuto cambia anche il conteggio.</p>{!gauge.related.length ? <Empty title="Tutto da esplorare">La lancetta si muoverà quando ci saranno attività sufficienti.</Empty> : <><h3>Contenuti collegati · fino a 20</h3>{gauge.related.map(r => <button className="list-row" key={r.id} onClick={() => { setGauge(null); void perform(() => openContent({ id: r.id, source: r.source as SearchResult['source'] })); }}><FileText size={16}/><span>{r.title}</span><ArrowRight size={15}/></button>)}</>}</Modal>}
    {agent && <AgentsPanel key={agent.id} initial={agent} onClose={() => setAgent(null)} onUpdated={() => { void perform(async () => { await refresh(); if (conversation) setMessages(await api<Message[]>(`conversations/${conversation.id}`)); }); }} onSave={memory => { setAgent(null); setMemoryEditor(memory); }}/ >}
    {help && <Modal title="Un arcipelago, non un altro labirinto" onClose={() => setHelp(false)}><div className="form-stack"><p><strong>1. Cerca prima.</strong> Scrivi nella chat: ritrovi ricordi, conversazioni conservate e testi indicizzati. Nessuna generazione mentre digiti.</p><p><strong>2. Chiedi, se vuoi.</strong> Il pulsante di invio chiede una risposta a DeepSeek. Apri “Strumenti” per scegliere una modalità facoltativa, poi invia. “Cerca nel web” usa il servizio di ricerca configurato (se presente) e apre i link incollati in sicurezza. “Genera immagine” salva il risultato nell’archivio privato. “Genera video” usa OpenRouter, richiede conferma del consumo di credito e mostra l’avanzamento. “Approfondisci” coinvolge più ruoli; tu resti il Regista.</p><p><strong>3. Ritrova ciò che chiedi.</strong> Le richieste inviate sono salvate e catalogate automaticamente; la risposta aggiorna lo stesso ricordo. Le chat riservate restano solo in cronologia. Puoi correggere l’isola, modificare o eliminare i ricordi. Le preferenze personali richiedono sempre la tua conferma.</p><p><strong>4. Segui un desiderio.</strong> Le tappe avanzano quando le confermi, non quando scrivi di più.</p><p className="muted">Invio chiede all’AI, Maiusc+Invio va a capo. Con ↓ selezioni i risultati; Invio apre il risultato selezionato. Tutti i pulsanti sono raggiungibili con Tab.</p></div></Modal>}
  </div>;
}
function ArrowUpRightIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
