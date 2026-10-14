import React, { useEffect, useState } from 'react';
import { Status, STATUS_LABEL } from '../engine/types';

const STATUS_ICON: Record<Status, string> = { given: 'Б', photo: 'Ф', clarify: '?', model: 'М', result: '=' };

export function Tag({ s, short }: { s: Status; short?: boolean }) {
  return (
    <span className={`tag tag-${s}`} title={STATUS_LABEL[s]}>
      <b aria-hidden>{STATUS_ICON[s]}</b>{short ? null : <span>{STATUS_LABEL[s]}</span>}
    </span>
  );
}

export function NumField(props: {
  label: React.ReactNode; value: number; unit?: string; status?: Status; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; hint?: string; disabled?: boolean; integer?: boolean;
}) {
  const { label, value, unit, status, min = 0, max = 1e6, step = 0.1, onChange, hint, disabled, integer } = props;
  const [txt, setTxt] = useState(String(value).replace('.', ','));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setTxt(String(value).replace('.', ',')); setErr(null); }, [value]);
  const commit = (s: string) => {
    const n = Number(s.trim().replace(',', '.'));
    if (s.trim() === '' || !Number.isFinite(n)) { setErr('Сан енгізіңіз'); return; }
    if (n < min || n > max) { setErr(`Рұқсат етілген аралық: ${min}…${max}`); return; }
    if (integer && !Number.isInteger(n)) { setErr('Бүтін сан енгізіңіз'); return; }
    setErr(null); if (n !== value) onChange(n);
  };
  return (
    <label className={`field ${err ? 'has-err' : ''}`}>
      <span className="field-label">{label}{status && <Tag s={status} short />}</span>
      <span className="field-input">
        <input
          inputMode="decimal" value={txt} disabled={disabled} aria-invalid={!!err}
          onChange={(e) => { setTxt(e.target.value); }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        />
        {unit && <span className="unit">{unit}</span>}
        <span className="steppers">
          <button type="button" aria-label="азайту" disabled={disabled} onClick={() => onChange(Math.max(min, +(value - step).toFixed(6)))}>−</button>
          <button type="button" aria-label="арттыру" disabled={disabled} onClick={() => onChange(Math.min(max, +(value + step).toFixed(6)))}>+</button>
        </span>
      </span>
      {err ? <span className="field-err" role="alert">{err} — соңғы дұрыс мән сақталды</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function Metric({ label, value, sub, tone, status = 'result' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'warn' | 'bad' | 'ok'; status?: Status }) {
  return (
    <div className={`metric ${tone ? 'metric-' + tone : ''}`}>
      <div className="metric-label">{label} <Tag s={status} short /></div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export function Section({ title, children, right }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><h3>{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  return <p className={`note note-${tone}`}>{children}</p>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost" onClick={onClose} aria-label="Жабу">✕</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const ARTIFACT_MODE = import.meta.env.VITE_ARTIFACT === '1';
export const appToast = (m: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: m }));

export function download(name: string, content: string | Blob, type = 'text/plain') {
  if (ARTIFACT_MODE) {
    // Артефакт терезесінде файл жүктеу бұғатталады — мазмұн алмасу буферіне көшіріледі.
    const text = typeof content === 'string' ? content.replace(/^\ufeff/, '') : '';
    navigator.clipboard?.writeText(text).then(
      () => appToast(`«${name}» мазмұны алмасу буферіне көшірілді. Оны мәтіндік файлға қойып, ${name} атымен сақтаңыз.`),
      () => appToast('Көшіру мүмкін болмады. Файлдарды жүктеу үшін жобаны жергілікті іске қосыңыз (README).'),
    ) ?? appToast('Көшіру мүмкін болмады.');
    return;
  }
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
