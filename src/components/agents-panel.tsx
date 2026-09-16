'use client';
import { useEffect, useRef, useState } from 'react';
import { Users, Square, Send, Check, GitBranch, SlidersHorizontal, CircleCheck, LoaderCircle } from 'lucide-react';
import type { AgentSession, Memory } from '@/lib/domain';
import { api, Modal } from './ui';

export function AgentsPanel({ initial, onClose, onSave, onUpdated }: { initial: AgentSession; onClose: () => void; onSave: (memory: Partial<Memory>) => void; onUpdated: () => void }) {
  const [session, setSession] = useState(initial);
  const current = useRef(initial);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const update = (next: AgentSession) => { current.current = next; setSession(next); };
  useEffect(() => {
    const controller = new AbortController();
    let active = true, busy = false;
    const timer = setInterval(async () => {
      const state = current.current;
      if (busy || !['ready','running'].includes(state.status)) return;
      busy = true;
      try {
        const next = await api<AgentSession>(`agents/${state.id}/advance`, 'POST', {}, controller.signal);
        if (active && next.version >= current.current.version && !['stopped','waiting'].includes(current.current.status)) { current.current = next; setSession(next); }
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : 'Connessione interrotta.'); current.current = { ...current.current, status: 'stopped' }; setSession(current.current); }
      } finally { busy = false; }
    }, 700);
    return () => { active = false; clearInterval(timer); controller.abort(); };
  }, []);
  const stop = async () => {
    update({ ...current.current, status: 'stopped' });
    try { update(await api<AgentSession>(`agents/${session.id}/stop`, 'POST', {})); } catch (e) { setError(e instanceof Error ? e.message : 'Interruzione non confermata.'); }
  };
  const submit = async () => {
    if (!input.trim()) return;
    setActionBusy(true); setError('');
    // Impedisce l'avvio di altri passi mentre il vincolo è in transito.
    update({ ...current.current, status: 'waiting' });
    try { update(await api<AgentSession>(`agents/${session.id}/intervene`, 'POST', { text: input })); setInput(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Intervento non inviato.'); }
    finally { setActionBusy(false); }
  };
  const close = async () => { if (['ready','running'].includes(current.current.status)) await stop(); onUpdated(); onClose(); };
  const statusLabel = { ready: 'Pronto al prossimo passo', running: `${session.plan[session.cursor]} al lavoro`, waiting: 'In attesa del Regista', completed: 'La proposta è pronta', stopped: 'Lavoro interrotto e conservato', failed: 'Serve un nuovo tentativo' }[session.status];
  return <Modal title="Approfondisci · il tuo tavolo" onClose={() => { void close(); }} wide>
    <div className="agent-header"><span className="badge"><Users size={14}/>Tu sei il Regista</span><span className="small muted">{session.cycles} cicli max · ${Number(session.reserved_cost).toFixed(3)} / ${Number(session.budget).toFixed(2)} riservati</span></div>
    <p className="small muted">Tariffe cautelative configurate, non fattura del provider. Massimo {session.duration_seconds}s di lavoro attivo. Il processo avanza solo con questo pannello aperto.</p>
    <div className="agent-status" role="status">{['ready','running'].includes(session.status) ? <LoaderCircle className="spin" size={18}/> : <CircleCheck size={18}/>}<span>{statusLabel}</span>{['ready','running'].includes(session.status) && <button className="button ghost small" onClick={() => { void stop(); }}><Square size={13}/>Interrompi</button>}</div>
    <p className="agent-request">{session.request}</p>
    <section className="agent-section"><h3>01 <span>Proposta</span></h3><div className="prose">{session.result?.proposal || [...session.steps].reverse().find(s => s.role === 'Progettista' && s.version === session.version)?.content || 'La proposta comparirà qui quando sarà stata realmente prodotta.'}</div></section>
    <section className="agent-section"><h3>02 <span>Punti da chiarire</span></h3>{session.result?.questions.length ? <ul>{session.result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul> : <p className="muted">{session.status === 'completed' ? 'Nessun chiarimento indispensabile indicato. Questo non garantisce che la proposta sia corretta.' : 'Le incertezze saranno evidenziate nei contributi e nella sintesi.'}</p>}</section>
    <section className="agent-section"><h3>03 <span>La tua scelta</span></h3><p>{session.result?.choice || 'Aggiungi contesto o cambia le priorità, anche mentre gli agenti lavorano.'}</p>
      <div className="suggestion-row">{[['Aggiungo un vincolo',SlidersHorizontal],['Proviamo un’alternativa',GitBranch]].map(([label,Icon]) => { const ItemIcon = Icon as typeof SlidersHorizontal; return <button key={String(label)} className="button chip" onClick={() => { setInput(`${label}: `); inputRef.current?.focus(); }}><ItemIcon size={14}/>{String(label)}</button>; })}</div>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}><label className="sr-only" htmlFor="director-input">Il tuo intervento come Regista</label><textarea ref={inputRef} id="director-input" rows={3} maxLength={3000} value={input} onChange={e => setInput(e.target.value)} placeholder="Un vincolo, una decisione, una domanda…"/><div className="right-actions"><button className="button secondary" disabled={actionBusy || !input.trim()}><Send size={15}/>{actionBusy ? 'Invio…' : 'Aggiorna il piano'}</button></div></form>
      {session.status === 'completed' && session.result && <button className="button primary" disabled={actionBusy} onClick={() => { setActionBusy(true); setError(''); void api<AgentSession>(`agents/${session.id}/choose`, 'POST', {}).then(chosen => update(chosen)).then(() => { onUpdated(); if (!session.request_message_id) onSave({ title: session.request.slice(0, 100), content: session.result!.proposal, category: session.category, kind: 'content', origin: `Risultato scelto · sessione ${session.id}` }); }).catch(e => setError(e instanceof Error ? e.message : 'Scelta non salvata.')).finally(() => setActionBusy(false)); }}><Check size={16}/>{session.request_message_id ? 'Scegliamo questa · già conservata' : 'Scegliamo questa · salva nell’isola'}</button>}
    </section>
    <details className="agent-table"><summary><Users size={17}/>Il tavolo degli agenti · contributi reali ({session.steps.length})</summary><p className="small muted">Sintesi operative, non ragionamenti interni. Stesso provider e modello, ruoli distinti. Il Verificatore non dispone di web o esecuzione test. Le immagini non sono analizzate in questa modalità.</p>
      {!session.steps.length && <p className="muted">Nessun contributo ancora completato.</p>}
      {session.steps.map((s, i) => <article className={`agent-contribution ${s.version < session.version ? 'superseded' : ''}`} key={i}><div><strong>{s.role}</strong><span className="small muted">{s.version < session.version ? 'Superato da un tuo intervento' : 'Completato'} · {s.tokens} token</span></div><p className="prose">{s.content}</p></article>)}
      {session.interventions.length > 0 && <div><h4>Decisioni e vincoli del Regista</h4>{session.interventions.map((i, n) => <p key={n}>{i.text}</p>)}</div>}
    </details>
    {(error || session.error) && <p role="alert" className="error">{error || session.error}</p>}
  </Modal>;
}
