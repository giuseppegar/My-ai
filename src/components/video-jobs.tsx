'use client';
import { useEffect, useRef } from 'react';
import { Film, RefreshCw } from 'lucide-react';
import type { VideoJob } from '@/lib/domain';
import { api } from './ui';

const active = (job: VideoJob) => ['submitting','pending','in_progress'].includes(job.status);
const labels: Record<VideoJob['status'], string> = { submitting: 'Conferma invio in attesa', pending: 'In coda', in_progress: 'Generazione in corso', completed: 'Generato e archiviato', failed: 'Non completato', uncertain: 'Invio da verificare' };
export function VideoMonitor({ jobs, enabled, onJob, onError }: { jobs: VideoJob[]; enabled: boolean; onJob: (job: VideoJob) => Promise<void>; onError: (error: string) => void }) {
  const current = useRef({ jobs, onJob, onError });
  useEffect(() => { current.current = { jobs, onJob, onError }; }, [jobs, onJob, onError]);
  const key = enabled ? jobs.filter(active).map(j => j.id).sort().join(',') : '';
  useEffect(() => {
    if (!key) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      if (document.visibilityState !== 'hidden') {
        for (const job of current.current.jobs.filter(active)) {
          if (stopped) break;
          try {
            const next = await api<VideoJob>(`videos/${job.id}/refresh`, 'POST', {}, controller.signal);
            if (!stopped) await current.current.onJob(next);
          } catch (error) { if (!stopped) current.current.onError(error instanceof Error ? error.message : 'Stato video non disponibile.'); }
        }
      }
      if (!stopped) timer = setTimeout(() => { void poll(); }, 30_000);
    };
    timer = setTimeout(() => { void poll(); }, 1000);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [key]);
  return null;
}
export function VideoJobs({ jobs, documentIds, onRefresh }: { jobs: VideoJob[]; documentIds: string[]; onRefresh: (id: string) => void }) {
  if (!jobs.length) return null;
  return <section className="video-jobs" aria-label="Video generati"><h3><Film size={17}/>I tuoi video</h3>
    <p className="small muted">Controllo ogni 30 secondi mentre l’app è aperta. Se la chiudi, OpenRouter continua: riaprila per recuperare e archiviare il risultato prima che scada sul provider.</p>
    <div className="video-grid">{jobs.map(job => <article className="panel video-job" key={job.id}>
      <h4>{job.prompt}</h4><p className="small muted">{job.model} · {job.duration} s · {job.resolution} · {job.aspect_ratio} · senza audio</p>
      <p className="badge" role="status">{labels[job.status]}</p>
      {job.document_id && documentIds.includes(job.document_id) && <video controls playsInline muted preload="none" src={`/api/documents/${job.document_id}/file`} aria-label={`Video: ${job.prompt}`}/>}
      {job.status === 'completed' && (!job.document_id || !documentIds.includes(job.document_id)) && <p className="small muted">Il file è stato eliminato dall’archivio.</p>}
      {job.error && <p className="error" role="alert">{job.error}</p>}
      {job.cost != null && <p className="small muted">Costo segnalato da OpenRouter: {Number(job.cost).toFixed(3)} USD.</p>}
      {active(job) && <button className="button secondary small" onClick={() => onRefresh(job.id)}><RefreshCw size={14}/>Controlla stato</button>}
    </article>)}</div>
  </section>;
}
