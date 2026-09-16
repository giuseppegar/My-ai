'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, Flower2, Lightbulb, Compass, Sparkles } from 'lucide-react';
import type { Gauge } from '@/lib/domain';

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const element = ref.current; element?.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={id} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-inner"><header className="modal-header"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Chiudi finestra" onClick={onClose}><X size={20}/></button></header>{children}</div>
  </dialog>;
}
const gaugeIcons = [Flower2, Lightbulb, Compass, Sparkles];
export function AnalogGauge({ gauge, index, onClick }: { gauge: Gauge; index: number; onClick: () => void }) {
  const Icon = gaugeIcons[index];
  const angle = -82 + Math.min(1, gauge.value / gauge.max) * 164;
  return <button className={`gauge gauge-${index}`} onClick={onClick} aria-label={`${gauge.label}: ${gauge.value}. Mostra criterio e contenuti collegati`}>
    <div className="gauge-label"><Icon size={15}/><span>{gauge.label}</span><ArrowUpRight size={13}/></div>
    <svg viewBox="0 0 180 99" aria-hidden="true">
      <path d="M22 85a68 68 0 0 1 136 0" stroke="currentColor" strokeOpacity=".1" strokeWidth="12" fill="none"/>
      <path d="M24 85a66 66 0 0 1 132 0" stroke="currentColor" strokeOpacity=".25" strokeWidth="1" fill="none"/>
      {Array.from({ length: 21 }, (_, i) => <line key={i} x1="90" y1="14" x2="90" y2={i%5 === 0 ? '23' : '19'} stroke="currentColor" strokeWidth={i%5 === 0 ? '1.2' : '.65'} opacity={i%5 === 0 ? '.8' : '.4'} transform={`rotate(${-90+i*9} 90 85)`}/>)}
      <text x="34" y="84" fontSize="9" fill="currentColor">0</text><text x="140" y="84" fontSize="9" fill="currentColor">{gauge.max}</text>
      <g className="needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '90px 85px' }}><path d="M88 85 90 28 92 85z" fill="currentColor"/><circle cx="90" cy="85" r="5" fill="currentColor"/></g>
      <circle cx="90" cy="85" r="2" fill="#f9f6ee"/>
    </svg>
    <div className="gauge-foot"><span>{gauge.value === 0 ? 'Tutto da esplorare' : `${gauge.value} ${index%2 === 0 ? 'categorie' : 'ricordi'}`}</span><span>30 giorni</span></div>
  </button>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><Sparkles size={27} strokeWidth={1.2}/><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
export const dateLabel = (date: string) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { method, cache: 'no-store', credentials: 'same-origin', signal, headers: body instanceof FormData ? undefined : body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data as T;
}
