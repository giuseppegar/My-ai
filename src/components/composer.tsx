'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, Plus, Send, Users, X, FileText, ArrowRight, LoaderCircle, ShieldCheck, Globe, SlidersHorizontal, ChevronDown, Film, Image as ImageIcon, ScrollText } from 'lucide-react';
import { categories, categoryOf, type Bootstrap, type ContextRef, type SearchResult } from '@/lib/domain';
import { previewResults } from '@/lib/demo';
import { searchPreview } from '@/lib/search';
import { api, Modal } from './ui';
export type PendingFile = { id: string; file: File; scope: 'chat' | 'memory'; preview?: string };
export function Composer({ data, preview, value, onChange, refs, onRemoveRef, onOpen, onSubmit, onBusyChange }: { data: Bootstrap; preview: boolean; value: string; onChange: (value: string) => void; refs: (ContextRef & { title: string })[]; onRemoveRef: (id: string) => void; onOpen: (item: SearchResult) => void; onSubmit: (text: string, files: PendingFile[], mode: { deep: boolean; web: boolean; image: boolean; video: boolean; artifact: boolean }, uploaded: (id: string) => void, onlyFiles: boolean) => Promise<void>; onBusyChange?: (busy: boolean) => void }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mode, setMode] = useState('lexical');
  const [selected, setSelected] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [tool, setTool] = useState<'deep' | 'web' | 'image' | 'video' | 'artifact' | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLButtonElement>(null);
  const deep = tool === 'deep';
  const web = tool === 'web';
  const imageMode = tool === 'image';
  const videoMode = tool === 'video';
  const artifactMode = tool === 'artifact';
  const mediaMode = imageMode || videoMode;
  const [videoConfirm, setVideoConfirm] = useState(false);
  const toolLabel = deep ? 'Approfondisci' : web ? 'Web' : imageMode ? 'Immagine' : videoMode ? 'Video' : artifactMode ? 'File di testo' : 'Strumenti';
  const ToolIcon = deep ? Users : web ? Globe : imageMode ? ImageIcon : videoMode ? Film : artifactMode ? ScrollText : SlidersHorizontal;
  const closeTools = () => { setToolsOpen(false); toolsRef.current?.focus({ preventScroll: true }); };
  const chooseTool = (next: NonNullable<typeof tool>) => { setTool(current => current === next ? null : next); closeTools(); };
  const [files, setFiles] = useState<PendingFile[]>([]);
  const fileRef = useRef<PendingFile[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyLock = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const query = value.trim().slice(0, 500);
    setSelected(-1); setDismissed(false); setSearchError(''); setResults([]);
    if (query.length < 2) { setSearching(false); return; }
    let active = true;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        if (preview) { setResults(searchPreview(previewResults(data), query).filter(r => (!category || r.category === category) && (!source || r.source === source))); setMode('lexical'); }
        else {
          const found = await api<{ results: SearchResult[]; mode: string }>('search', 'POST', { query, category: category || null, source: source || null, take: expanded ? 60 : 6 }, controller.signal);
          if (active) { setResults(found.results); setMode(found.mode); }
        }
      } catch (e) { if (active) setSearchError(e instanceof Error ? e.message : 'Ricerca non disponibile.'); }
      finally { if (active) setSearching(false); }
    }, 280);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [value, category, source, preview, data, expanded]);
  useEffect(() => { if (toolsOpen) document.getElementById('composer-tools')?.scrollIntoView({ block: 'nearest' }); }, [toolsOpen]);
  useEffect(() => () => { fileRef.current.forEach(f => f.preview && URL.revokeObjectURL(f.preview)); }, []);
  const changeFiles = (next: PendingFile[]) => { fileRef.current = next; setFiles(next); };
  const removeFile = (id: string) => { const item = fileRef.current.find(f => f.id === id); if (item?.preview) URL.revokeObjectURL(item.preview); changeFiles(fileRef.current.filter(f => f.id !== id)); };
  const addFiles = (incoming: File[]) => {
    if (busy) return;
    setError('');
    if (incoming.length + fileRef.current.length > 3) { setError('Allega al massimo tre file alla volta.'); return; }
    if (incoming.some(f => f.size > 10 * 1024 * 1024 || f.size === 0 || !/\.(pdf|docx|txt|png|jpe?g|webp|gif)$/i.test(f.name))) { setError('Usa PDF, DOCX, TXT o immagini JPG/PNG/WebP/GIF, non vuoti e fino a 10 MB.'); return; }
    changeFiles([...fileRef.current, ...incoming.map(file => ({ id: crypto.randomUUID(), file, scope: 'chat' as const, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }))]);
  };
  const submit = async (onlyFiles = false, videoConfirmed = false) => {
    if (busyLock.current || (!value.trim() && !onlyFiles)) return;
    if (videoMode && !data.capabilities.videos) { setError('La generazione video non è configurata: servono OpenRouter e VIDEO_ENABLED.'); return; }
    if (videoMode && !videoConfirmed) { setError(''); setVideoConfirm(true); return; }
    if (imageMode && !data.capabilities.images) { setError('La generazione immagini non è configurata (serve IMAGE_API_KEY).'); return; }
    if (artifactMode && !data.capabilities.ai) { setError('La generazione di file di testo richiede la configurazione di DeepSeek.'); return; }
    if (web && !data.capabilities.web && !/https?:\/\//i.test(value)) { setError('La ricerca web non è configurata (serve una chiave OpenRouter o Tavily). Puoi incollare un link nel messaggio: viene aperto in sicurezza anche senza ricerca.'); return; }
    busyLock.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try { await onSubmit(value, files, { deep, web, image: imageMode, video: videoMode, artifact: artifactMode }, removeFile, onlyFiles); if (!onlyFiles) onChange(''); setResults([]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invio non riuscito.'); }
    finally { busyLock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const showSearch = value.trim().length >= 2 && !dismissed;
  const sendLabel = busy ? 'Elaborazione…' : imageMode ? 'Genera immagine' : videoMode ? 'Genera video' : artifactMode ? 'Genera file di testo' : deep ? 'Avvia il tavolo' : 'Chiedi all’AI';
  const resultList = (all: boolean) => <>
    {searching ? <p className="search-state" role="status"><LoaderCircle size={16} className="spin"/>Cerco solo nel tuo spazio…</p> : searchError ? <p role="alert" className="error">{searchError}</p> : results.length ? <div id={all ? 'all-search-results' : 'memory-results'} role="listbox" aria-label="Risultati nella memoria personale">{results.slice(0, all ? 60 : 4).map((item, i) => <button type="button" key={`${item.source}:${item.id}`} id={`memory-result-${all ? 'all-' : ''}${i}`} role="option" aria-selected={selected === i} className={`search-result ${selected === i ? 'selected' : ''}`} onClick={() => { onOpen(item); setExpanded(false); }} onMouseEnter={() => setSelected(i)}>
      {item.preview_url ? <img src={item.preview_url} alt="" className="result-image"/> : <span className={`result-icon category-${item.category}`}><FileText size={18}/></span>}
      <span className="result-copy"><strong>{item.title}</strong><span>{categoryOf(item.category).name} · {({ memory: 'Ricordo', message: 'Conversazione', document: 'Documento', wish: 'Desiderio' })[item.source]}{item.page ? ` · pag. ${item.page}` : ''}</span><small>{item.excerpt.replace('ESEMPIO DIMOSTRATIVO', '').slice(0, 120)}</small></span><ArrowUpRight size={17}/>
    </button>)}</div> : <p className="search-state">Non c’è ancora nei tuoi ricordi. Chiedi all’AI.</p>}
  </>;
  return <div className={`composer ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}>
    <div className="composer-topline"><span><Search size={15}/>Prima cerchiamo nei tuoi ricordi</span><span className="privacy-dot"><ShieldCheck size={13}/>Solo tuoi</span></div>
    {refs.length > 0 && <div className="context-chips">{refs.map(ref => <span className="badge" key={`${ref.source}:${ref.id}`}>Ripartiamo da: {ref.title}<button className="icon-button tiny" aria-label={`Rimuovi contesto ${ref.title}`} onClick={() => onRemoveRef(ref.id)}><X size={13}/></button></span>)}</div>}
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="sr-only" htmlFor="chat-input">Scrivi una domanda o cerca nella tua memoria</label>
      <textarea id="chat-input" ref={inputRef} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={showSearch && results.length > 0} aria-controls={showSearch && results.length > 0 ? 'memory-results' : undefined} aria-activedescendant={selected >= 0 && !expanded && showSearch && results.length ? `memory-result-${selected}` : undefined} aria-describedby="composer-hint" rows={3} maxLength={imageMode ? 500 : videoMode ? 2000 : 12000} value={value} onChange={e => onChange(e.target.value)} placeholder="Un’idea, una domanda, un ricordo da ritrovare…" disabled={busy} onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'ArrowDown' && results.length && showSearch) { e.preventDefault(); setSelected(i => Math.min(i + 1, Math.min(results.length, 4) - 1)); }
        if (e.key === 'ArrowUp' && selected >= 0) { e.preventDefault(); setSelected(i => i - 1); }
        if (e.key === 'Escape') { setDismissed(true); setSelected(-1); }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (selected >= 0 && showSearch && results[selected]) onOpen(results[selected]); else void submit(); }
      }}/>
      {imageMode && <p className="image-mode-hint">Il tuo testo è il prompt. Immagine salvata e catalogata automaticamente; nelle chat riservate resta solo nella chat. Gli allegati non vengono inviati.</p>}
      {videoMode && <p className="video-mode-hint">Il tuo testo è il prompt. OpenRouter genera un video senza audio: {data.capabilities.videoDuration} secondi, {data.capabilities.videoResolution}. Prima dell’invio confermi il consumo di credito. Gli allegati non vengono inviati.</p>}
      {artifactMode && <p className="artifact-mode-hint">Il tuo testo è il prompt. My ai genererà un file di testo (.md o .txt) completo e formattato, salvato nei tuoi documenti e ricercabile nell’isola.</p>}
      {web && !data.capabilities.web && <p className="web-hint">Ricerca non configurata: i link incollati nel messaggio vengono comunque aperti in sicurezza.</p>}
      {files.length > 0 && !mediaMode && <div className="attachment-list">{files.map(item => <div className="attachment" key={item.id}>{item.preview ? <img src={item.preview} alt={`Anteprima ${item.file.name}`}/> : <FileText size={26}/>}<div><strong>{item.file.name}</strong><label className="sr-only" htmlFor={`scope-${item.id}`}>Conservazione di {item.file.name}</label><select id={`scope-${item.id}`} disabled={busy} value={item.scope} onChange={e => changeFiles(fileRef.current.map(f => f.id === item.id ? { ...f, scope: e.target.value as PendingFile['scope'] } : f))}><option value="chat">Solo per questa chat</option><option value="memory">Conserva nella memoria</option></select></div><button type="button" className="icon-button" disabled={busy} aria-label={`Rimuovi allegato ${item.file.name}`} onClick={() => removeFile(item.id)}><X size={16}/></button></div>)}<div className="attachment-support small muted"><p>PDF, DOCX, TXT UTF-8, JPG, PNG, GIF e WebP · massimo 10 MB per file. PDF: fino a 500 pagine / 1.000.000 caratteri, con avviso se la lettura è parziale.</p><p>{data.capabilities.ocr ? 'OCR locale per il testo di foto e scansioni (fino a 20 pagine scansionate per file); verifica sempre l’originale.' : 'OCR non attivo: foto e PDF scansionati vengono conservati, ma il loro testo non viene letto.'} {data.capabilities.vision && !deep ? 'Con l’invio AI, le immagini vengono inviate anche al modello con visione configurato.' : 'La descrizione visiva delle foto non è attiva in questa modalità.'}</p><p>L’anteprima rimane sul dispositivo. Caricare non avvia l’AI.</p></div><button type="button" className="button secondary small" disabled={busy} onClick={() => { void submit(true); }}>Carica allegati senza chiedere all’AI</button></div>}
      {showSearch && <div className="search-panel"><div className="search-heading"><span>DAL TUO ARCIPELAGO</span><span>{mode === 'hybrid' ? 'Testo + significato' : 'Testo + termini affini'}</span></div>{resultList(false)}{results.length > 0 && <button type="button" className="search-all" onClick={() => setExpanded(true)}>Tutti i risultati e filtri <ArrowRight size={14}/></button>}</div>}
      <div className="composer-actions">
        {!mediaMode && <input ref={fileInput} type="file" className="sr-only" disabled={busy} tabIndex={-1} multiple accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/>}
        {!mediaMode && <button type="button" className="icon-button attachment-button" aria-label="Aggiungi documenti o immagini" disabled={busy} onClick={() => fileInput.current?.click()}><Plus size={22}/></button>}
        <button ref={toolsRef} type="button" className={`button tools-toggle ${tool ? 'active' : ''}`} aria-label={tool ? `Strumenti: ${toolLabel}` : 'Strumenti'} aria-expanded={toolsOpen} aria-controls="composer-tools" disabled={busy} onClick={() => setToolsOpen(!toolsOpen)} onKeyDown={e => {
          if (e.key === 'Escape') closeTools();
          if (e.key === 'ArrowDown') { e.preventDefault(); setToolsOpen(true); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#composer-tools button')?.focus()); }
        }}><ToolIcon size={17}/><span>{toolLabel}</span><ChevronDown size={14} className={toolsOpen ? 'expanded' : ''}/></button>
        <button type="submit" className="button primary send-button" aria-label={sendLabel} title={sendLabel} aria-busy={busy} disabled={busy || !value.trim()}>{busy ? <LoaderCircle className="spin" size={18}/> : imageMode ? <ImageIcon size={18}/> : videoMode ? <Film size={18}/> : artifactMode ? <ScrollText size={18}/> : <Send size={18}/>}<span>{sendLabel}</span></button>
      </div>
      <div id="composer-tools" className="composer-tools" hidden={!toolsOpen} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTools(); } }}>
        <p>Scegli uno strumento. Si avvia solo quando invii.</p>
        <div className="composer-tools-grid" role="group" aria-label="Strumenti della chat">
          <button type="button" className={`button artifact-button ${artifactMode ? 'active' : ''}`} aria-pressed={artifactMode} disabled={busy} title={data.capabilities.ai ? 'Genera un documento o codice in formato testo/markdown' : 'Richiede la chiave DeepSeek'} onClick={() => chooseTool('artifact')}><ScrollText size={18}/><span>Genera file di testo</span></button>
          <button type="button" className={`button web-button ${web ? 'active' : ''}`} aria-pressed={web} disabled={busy} title={data.capabilities.web ? 'Cerca nel web con la tua domanda' : 'Ricerca web non configurata: puoi comunque incollare un link nel messaggio'} onClick={() => chooseTool('web')}><Globe size={18}/><span>Cerca nel web</span></button>
          <button type="button" className={`button deep-button ${deep ? 'active' : ''}`} aria-pressed={deep} disabled={busy} title="Coinvolgi più ruoli per un’analisi approfondita" onClick={() => chooseTool('deep')}><Users size={18}/><span>Approfondisci</span></button>
          <button type="button" className={`button image-button ${imageMode ? 'active' : ''}`} aria-pressed={imageMode} disabled={busy} title={data.capabilities.images ? 'Genera un’immagine con il tuo testo come prompt' : 'Generazione immagini non configurata (serve IMAGE_API_KEY)'} onClick={() => chooseTool('image')}><ImageIcon size={18}/><span>Genera immagine</span></button>
          <button type="button" className={`button video-button ${videoMode ? 'active' : ''}`} aria-pressed={videoMode} disabled={busy} title={data.capabilities.videos ? 'Genera un video tramite OpenRouter' : 'Generazione video non configurata'} onClick={() => chooseTool('video')}><Film size={18}/><span>Genera video</span></button>
        </div>
        {tool && <p>Per tornare alla chat semplice, tocca di nuovo lo strumento attivo.</p>}
      </div>
    </form>
    <div className="composer-bottom" id="composer-hint"><span>La bozza non è salvata. Le richieste inviate sono conservate e catalogate automaticamente, salvo le chat riservate.</span><span className="keyboard-hint">Invio: chiedi all’AI · ⇧ Invio: a capo · ↓: risultati</span></div>
    {error && <p role="alert" className="error composer-error">{error}</p>}
    {videoConfirm && <Modal title="Confermi la generazione video?" onClose={() => setVideoConfirm(false)}><div className="form-stack"><p>Modello: <strong>{data.capabilities.videoModel}</strong> · {data.capabilities.videoDuration} secondi · {data.capabilities.videoResolution} · senza audio.</p><p className="prose">{value}</p><p>Questa richiesta consuma credito OpenRouter. Il costo dipende dal modello e dal listino del provider; non è incluso nel costo della chat.</p><p className="small muted">Invieremo solo questo prompt, non allegati o cronologia. Il provider conserva temporaneamente il filmato: i video non supportano Zero Data Retention. Se chiudi l’app, riaprila per archiviarlo.</p><div className="button-wrap"><button className="button secondary" onClick={() => setVideoConfirm(false)}>Annulla</button><button className="button primary" onClick={() => { setVideoConfirm(false); void submit(false, true); }}>Conferma e genera video</button></div></div></Modal>}
    {expanded && <Modal title="Ritrova un pezzetto del tuo mondo" onClose={() => setExpanded(false)} wide><p className="muted">Risultati per “{value.slice(0, 100)}” · fino a 60 risultati pertinenti.</p><div className="form-row"><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Tutte le isole</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tipo<select value={source} onChange={e => setSource(e.target.value)}><option value="">Tutti i tipi</option><option value="memory">Ricordi</option><option value="message">Conversazioni</option><option value="document">Documenti</option><option value="wish">Desideri</option></select></label></div>{resultList(true)}</Modal>}
  </div>;
}
