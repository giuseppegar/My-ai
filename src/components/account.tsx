'use client';
import { useState } from 'react';
import { Download, LogOut, ShieldCheck, Trash2, KeyRound, Server, Bot, Check } from 'lucide-react';
import { type Bootstrap, type Preferences } from '@/lib/domain';
import { api, Modal } from './ui';

export function AuthModal({ configured, onClose, onSuccess }: { configured: boolean; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return <Modal title={signup ? 'Un piccolo spazio, tutto tuo' : 'Bentornato nel tuo arcipelago'} onClose={onClose}>
    {!configured ? <div className="form-stack"><div className="notice"><Server size={24}/><div><strong>Colleghiamo prima Supabase.</strong><p>L’anteprima non crea account e non conserva dati. Configura le variabili in <code>.env.local</code> e applica la migrazione SQL seguendo <code>README.md</code>.</p></div></div><p>Il server deve avere <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code>. Per l’AI serve anche <code>DEEPSEEK_API_KEY</code>.</p><button className="button primary" onClick={onClose}>Torna all’anteprima</button></div> : <form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const result = await api<{ confirmation: boolean; message: string }>(`auth/${signup ? 'signup' : 'login'}`, 'POST', { email, password }); if (result.confirmation) { setMessage(result.message); setPassword(''); } else { await onSuccess(); onClose(); } } catch (e) { setError(e instanceof Error ? e.message : 'Accesso non riuscito.'); } finally { setBusy(false); } }}>
      <p className="muted">Chat, ricordi e documenti ti aspettano anche su un altro dispositivo. Nessuno spazio condiviso.</p>
      <label>Email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Password<input autoComplete={signup ? 'new-password' : 'current-password'} type="password" required minLength={signup ? 12 : 1} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/>{signup && <small>Almeno 12 caratteri. Preferisci una frase lunga e unica.</small>}</label>
      {signup && <p className="small muted">Le richieste inviate e le risposte sono conservate e catalogate nel tuo account; le chat riservate restano escluse dalla memoria globale. Con l’invio AI, richiesta e contesto pertinente vengono comunicati a DeepSeek. Gli strumenti web, immagini e video usano i rispettivi provider esterni solo su invio esplicito. Puoi esportare o eliminare i tuoi dati.</p>}
      {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice sage" role="status">{message}</p>}
      <button className="button primary" disabled={busy}><KeyRound size={16}/>{busy ? 'Un momento…' : signup ? 'Crea il tuo account' : 'Accedi'}</button>
      <button type="button" className="button ghost" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Hai già un account? Accedi' : 'È la prima volta? Crea un account'}</button>
    </form>}
  </Modal>;
}
export function Settings({ data, preview, onSave, onLogout }: { data: Bootstrap; preview: boolean; onSave: (prefs: Preferences) => Promise<void>; onLogout: () => Promise<void> }) {
  const [form, setForm] = useState(data.preferences);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const exportData = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/account/export', { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob();
      const tail = await blob.slice(-500).text();
      if (!tail.trim().endsWith('{"type":"complete","ok":true}')) throw new Error('Esportazione incompleta. Riprova: nessun dato è stato eliminato.');
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'my-ai-export.ndjson'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Esportazione pronta: include dati e file originali in formato NDJSON/base64.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Esportazione non riuscita.'); } finally { setBusy(false); }
  };
  return <div className="settings-layout"><div className="panel form-stack">
    <h2>Come ti piace stare qui</h2><form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave(form); setNotice(preview ? 'Preferenze applicate solo a questa anteprima.' : 'Preferenze salvate.'); } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); } finally { setBusy(false); } }}>
      <label>Come vuoi essere chiamato?<input maxLength={60} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}/></label>
      <label>Vista delle isole<select value={form.island_view} onChange={e => setForm({ ...form, island_view: e.target.value as Preferences['island_view'] })}><option value="illustrated">Isole illustrate</option><option value="list">Elenco essenziale</option></select></label>
      <label className="check-label"><input type="checkbox" checked={form.reduced_motion} onChange={e => setForm({ ...form, reduced_motion: e.target.checked })}/>Riduci ulteriormente le animazioni</label>
      <hr/><h3>Limiti di Approfondisci</h3><p className="small muted">Il server riserva un costo cautelativo prima di ogni passo. Le tariffe sono configurate dall’amministratore: verifica sempre i consumi sul portale DeepSeek.</p>
      <div className="form-row"><label>Cicli di revisione<select value={form.agent_cycles} onChange={e => setForm({ ...form, agent_cycles: Number(e.target.value) })}><option value={0}>0 · sola proposta e sintesi</option><option value={1}>1 ciclo</option><option value={2}>2 cicli</option></select></label><label>Budget USD per sessione<input type="number" min="0.02" max="1" step="0.01" value={form.agent_budget} onChange={e => setForm({ ...form, agent_budget: Number(e.target.value) })}/></label></div>
      <label>Durata massima del lavoro attivo, secondi<input type="number" min="30" max="600" value={form.agent_seconds} onChange={e => setForm({ ...form, agent_seconds: Number(e.target.value) })}/></label>
      <button className="button primary" disabled={busy}><Check size={16}/>Salva impostazioni</button>
    </form>
  </div><div className="form-stack"><section className="panel"><h2><Server size={20}/>Collegamenti</h2>
    <div className="connection"><span>Supabase · account e archivio</span><span className="badge">{data.capabilities.configured ? 'Configurato' : 'Da configurare'}</span></div>
    <div className="connection"><span>DeepSeek · {data.capabilities.model}</span><span className="badge">{data.capabilities.ai ? 'Chiave presente' : 'Da configurare'}</span></div>
    <div className="connection"><span>Ricerca vettoriale locale</span><span className="badge">{data.capabilities.embeddings ? 'Endpoint configurato' : 'Opzionale · non collegata'}</span></div>
    <div className="connection"><span>OCR locale · testo di foto e scansioni</span><span className="badge">{data.capabilities.ocr ? 'Configurato · italiano e inglese' : 'Non attivo'}</span></div>
    <div className="connection"><span>Ricerca web · {data.capabilities.webProvider === 'openrouter' ? 'OpenRouter' : 'Tavily'}</span><span className="badge">{data.capabilities.web ? 'Chiave presente' : 'Non configurata'}</span></div>
    <div className="connection"><span>Generazione immagini · {data.capabilities.imageModel}</span><span className="badge">{data.capabilities.images ? 'Chiave presente' : 'Non configurata'}</span></div>
    <div className="connection"><span>Video OpenRouter · {data.capabilities.videoModel} · {data.capabilities.videoDuration}s / {data.capabilities.videoResolution}</span><span className="badge">{data.capabilities.videos ? 'Configurati · a pagamento' : 'Non configurati'}</span></div>
    <p className="small muted">I video richiedono conferma prima dell’invio e usano solo il prompt, senza audio, cronologia o allegati. OpenRouter e il provider conservano temporaneamente l’output: Zero Data Retention non è supportata. Il recupero nell’archivio privato avviene mentre l’app è aperta; riaprila se l’hai chiusa durante la generazione.</p>
    <p className="small muted">La ricerca web invia la domanda al servizio configurato solo quando premi “Cerca nel web”; i link incollati vengono aperti dal server senza toccare la rete locale. Le immagini sono generate da un servizio esterno: riceve solo il prompt, nel momento della generazione. Lo stato indica la configurazione, non un test di connessione. Senza embeddings: ricerca testuale e termini affini. Senza DeepSeek: nessuna risposta simulata. Visione immagini: {data.capabilities.vision ? 'abilitata per la chat normale' : 'non attiva'}.</p>
  </section><section className="panel"><h2><ShieldCheck size={20}/>I tuoi dati, le tue scelte</h2>
    <ul className="privacy-list"><li>Nuove richieste salvate e catalogate automaticamente nell’isola selezionata; in Chat libera la categoria è proposta con regole locali, senza chiamate AI aggiuntive. La risposta aggiorna lo stesso ricordo. Puoi correggere categoria e contenuto o eliminare il ricordo. Le preferenze personali non vengono dedotte automaticamente.</li><li>Bozze e cronologia delle ricerche non conservate. Con embeddings configurati, il testo cercato passa solo al servizio locale di fiducia.</li><li>“Solo per questa chat”: file escluso dalla ricerca globale. Per prudenza, anche la conversazione che lo contiene viene esclusa e le sue copie automatiche nelle isole vengono rimosse. Richieste e risposte restano nella cronologia riservata. Eliminando la chat, questi file vengono eliminati.</li><li>“Conserva nella memoria”: file ricercabile, resta anche se elimini la chat. Puoi eliminarlo da Documenti.</li><li>Nessuna scadenza automatica dei contenuti. Gli originali e le anteprime passano dall’app: accesso verificato a ogni apertura, anche fuori dalla rete di casa.</li><li>I documenti sono materiale da analizzare, non istruzioni da eseguire.</li><li>Le copie nei backup seguono la conservazione decisa dall’amministratore; la cancellazione dall’app non le rimuove istantaneamente.</li></ul>
    <p className="small"><Bot size={15}/> Con l’invio AI vengono trasmessi a DeepSeek la richiesta, una parte della conversazione e il contesto pertinente. La conservazione lato provider dipende dalle sue condizioni. Nessun tracking pubblicitario.</p>
    {!preview && <><p className="small muted">Account: {data.user?.email}</p><div className="button-wrap"><button className="button secondary" disabled={busy} onClick={() => { void exportData(); }}><Download size={16}/>Esporta dati e file</button><button className="button ghost" onClick={() => { void onLogout().catch(e => setError(e.message)); }}><LogOut size={16}/>Esci</button></div><button className="button danger" disabled={!data.capabilities.accountDeletion} onClick={() => setDeleteOpen(true)}><Trash2 size={16}/>Elimina account e contenuti</button>{!data.capabilities.accountDeletion && <p className="small muted">L’amministratore deve abilitare l’eliminazione account su un’istanza Supabase dedicata.</p>}</>}
  </section></div>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice sage">{notice}</p>}
    {deleteOpen && <Modal title="Eliminare definitivamente il tuo spazio?" onClose={() => setDeleteOpen(false)}><form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await api('account', 'DELETE', { confirmation, password }); setDeleteOpen(false); await onLogout(); } catch (e) { setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.'); } finally { setBusy(false); } }}><p>Verranno eliminati account, chat, ricordi, desideri, sessioni e file. L’operazione non è annullabile. Prima puoi esportare i dati.</p><label>Scrivi ELIMINA IL MIO ACCOUNT<input autoComplete="off" required value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label><label>Conferma la tua password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>{error && <p role="alert" className="error">{error}</p>}<button className="button danger" disabled={busy || confirmation !== 'ELIMINA IL MIO ACCOUNT'}>{busy ? 'Eliminazione…' : 'Elimina definitivamente'}</button></form></Modal>}
  </div>;
}
