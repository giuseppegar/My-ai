'use client';
import { useState } from 'react';
import { Check, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { categories, kindLabels, type Document, type Memory, type Wish } from '@/lib/domain';
import { Modal } from './ui';

export function MemoryEditor({ initial, onClose, onSave }: { initial: Partial<Memory>; onClose: () => void; onSave: (data: Partial<Memory> & { confirmed: boolean }) => Promise<void> }) {
  const [form, setForm] = useState({ title: initial.title || '', content: initial.content || '', category: initial.category || 'capire', kind: initial.kind || 'content', origin: initial.origin || 'Inserito da te' });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title={initial.id ? 'Prenditi cura di questo ricordo' : 'Salva nella tua isola'} onClose={onClose}>
    <form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ ...initial, ...form, confirmed }); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); } finally { setBusy(false); } }}>
      <label>Titolo<input required maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <div className="form-row"><label>Isola<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Memory['category'] })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Che cosa conservi?<select value={form.kind} onChange={e => { setForm({ ...form, kind: e.target.value as Memory['kind'] }); setConfirmed(false); }}>{Object.entries(kindLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label></div>
      <label>Contenuto o sintesi<textarea rows={9} required maxLength={65000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}/></label>
      <label>Origine<input maxLength={250} value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })}/></label>
      {form.kind === 'preference' && <div className="notice sage"><ShieldCheck size={20}/><div><strong>Una preferenza è una tua scelta.</strong><p>Non salvare ipotesi sul carattere o sullo stato psicologico.</p><label className="check-label"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Confermo che questa preferenza mi rappresenta.</label></div></div>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Annulla</button><button className="button primary" disabled={busy || form.kind === 'preference' && !confirmed}><Check size={16}/>{busy ? 'Salvataggio…' : 'Salva nell’isola'}</button></div>
    </form>
  </Modal>;
}
const wishFields = [ ['motivation','Perché è importante per te'],['outcome','Il risultato che desideri'],['timeframe','Tempi indicativi'],['resources','Risorse disponibili · solo dati confermati'],['constraints','Vincoli'],['unknowns','Informazioni mancanti · stime e ipotesi da verificare'],['next_action','La prossima azione concreta'],['obstacles','Ostacoli e risposte · se accade…, allora…'],['decisions','Decisioni e progressi confermati'] ] as const;
export function WishEditor({ initial, documents, onClose, onSave }: { initial: Partial<Wish>; documents: Document[]; onClose: () => void; onSave: (data: Partial<Wish>) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', motivation: '', outcome: '', timeframe: '', resources: '', constraints: '', unknowns: '', next_action: '', obstacles: '', decisions: '', milestones: [], status: 'active', image_document_id: null, ...initial } as Wish);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title={initial.id ? 'Il tuo percorso può cambiare' : 'Dai spazio a un desiderio'} onClose={onClose} wide>
    <form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSave(form); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); } finally { setBusy(false); } }}>
      <p className="muted">Non serve avere già tutte le risposte. I campi possono restare vuoti; nessun progresso viene dedotto dalla chat.</p>
      <label>Il tuo desiderio<input required maxLength={150} placeholder="Ad esempio, imparare lo spagnolo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <div className="form-row"><label>Stato<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Wish['status'] })}><option value="active">In cammino</option><option value="paused">In pausa</option><option value="abandoned">Ho scelto un’altra strada</option></select></label><label>Immagine dalla memoria<select value={form.image_document_id || ''} onChange={e => setForm({ ...form, image_document_id: e.target.value || null })}><option value="">Illustrazione dell’isola</option>{documents.filter(d => d.mime.startsWith('image/') && d.scope === 'memory').map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></div>
      <div className="form-grid">{wishFields.map(([field, label]) => <label key={field}>{label}<textarea rows={field === 'timeframe' ? 2 : 3} maxLength={field === 'timeframe' ? 250 : field === 'next_action' ? 1000 : 5000} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}/></label>)}</div>
      <fieldset className="milestones"><legend>Tappe · conferma solo quelle completate</legend>{form.milestones.map((m, i) => <div className="milestone" key={m.id}><label className="check-label"><input type="checkbox" checked={m.done} onChange={e => setForm({ ...form, milestones: form.milestones.map((item, j) => i === j ? { ...item, done: e.target.checked } : item) })}/><span>{m.title}</span></label><button className="icon-button" type="button" aria-label={`Elimina tappa ${m.title}`} onClick={() => setForm({ ...form, milestones: form.milestones.filter(item => item.id !== m.id) })}><Trash2 size={15}/></button></div>)}
      <div className="inline-form"><input aria-label="Nuova tappa" placeholder="Un passo piccolo e concreto" maxLength={250} value={step} onChange={e => setStep(e.target.value)}/><button type="button" className="button secondary" disabled={!step.trim() || form.milestones.length >= 30} onClick={() => { setForm({ ...form, milestones: [...form.milestones, { id: crypto.randomUUID(), title: step.trim(), done: false }] }); setStep(''); }}><Plus size={16}/>Aggiungi tappa</button></div></fieldset>
      <p className="small muted">L’avanzamento dipende solo dalle tappe spuntate e salvate. Pausa e cambio di strada non comportano penalità.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Conferma e salva il percorso'}</button></div>
    </form>
  </Modal>;
}

export function TextArtifactEditor({
  document,
  initialContent,
  onClose,
  onSave,
  onAiEdit,
}: {
  document: Document;
  initialContent: string;
  onClose: () => void;
  onSave: (data: { title: string; content: string }) => Promise<void>;
  onAiEdit: (instruction: string) => Promise<{ title: string; content: string; summary: string }>;
}) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(initialContent);
  const [instruction, setInstruction] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const handleAi = async () => {
    if (!instruction.trim() || aiBusy) return;
    setAiBusy(true);
    setError('');
    try {
      const res = await onAiEdit(instruction.trim());
      if (res.title) setTitle(res.title);
      if (res.content) setContent(res.content);
      setAiSummary(res.summary || 'Modifica applicata con successo al testo.');
      setInstruction('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modifica con l’AI non riuscita.');
    } finally {
      setAiBusy(false);
    }
  };

  return <Modal title={`Modifica file: ${document.filename}`} onClose={onClose} wide>
    <form className="form-stack" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      setError('');
      try {
        await onSave({ title, content });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
      } finally {
        setBusy(false);
      }
    }}>
      <label>Titolo del documento
        <input required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} disabled={busy}/>
      </label>

      <label>Contenuto del file
        <textarea rows={14} required maxLength={65000} value={content} onChange={e => setContent(e.target.value)} disabled={busy} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}/>
      </label>

      <div className="panel" style={{ background: '#f6f8f1', border: '1px solid #dce4d1' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span>✨</span> Modifica con l’aiuto dell’AI
        </h4>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Chiedi a My ai di riscrivere, completare, sintetizzare, correggere o aggiungere una sezione al testo.
        </p>
        <div className="inline-form">
          <input
            placeholder="Cosa vorresti cambiare? (es. 'Aggiungi una sezione conclusiva', 'Traduci in inglese', 'Correggi la forma')..."
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            disabled={aiBusy || busy}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAi(); } }}
          />
          <button type="button" className="button secondary" disabled={!instruction.trim() || aiBusy || busy} onClick={() => void handleAi()}>
            {aiBusy ? 'Elaborazione…' : 'Chiedi all’AI'}
          </button>
        </div>
        {aiSummary && <p className="notice sage small" style={{ marginTop: '10px' }}>{aiSummary} Verifica il testo sopra prima di salvare.</p>}
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="modal-actions">
        <button type="button" className="button ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="button primary" disabled={busy || aiBusy}>
          <Check size={16}/>{busy ? 'Salvataggio…' : 'Salva modifiche al file'}
        </button>
      </div>
    </form>
  </Modal>;
}
