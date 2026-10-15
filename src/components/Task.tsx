import React from 'react';
import { fmt } from '../engine/num';

/** Сан + бірлік: есептеу толық дәлдікпен, экранда — 2 ондық таңбаға дейін, үтірмен. */
export const n = (x: number | null | undefined, d = 2) => fmt(x ?? null, d);
export const u = (x: number | null | undefined, unit: string, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : `${fmt(x, d)} ${unit}`);
/** 140 с = 2 мин 20 с */
export function secText(s: number | null) {
  if (s === null || !Number.isFinite(s)) return '—';
  const r = Math.round(s * 100) / 100;
  const m = Math.floor(r / 60 + 1e-9); const rest = r - m * 60;
  if (m === 0) return `${fmt(r)} с`;
  return `${fmt(r)} с = ${m} мин${rest > 1e-6 ? ` ${fmt(rest)} с` : ''}`;
}

export type Legend = [sym: React.ReactNode, meaning: string, unit?: string][];

export function Task(props: {
  title: string; goal: React.ReactNode;
  inputs: React.ReactNode; formula: React.ReactNode[]; legend: Legend;
  steps: React.ReactNode[]; result: React.ReactNode; explain?: React.ReactNode;
  warn?: React.ReactNode; extra?: React.ReactNode; onReset?: () => void; on3D?: () => void;
}) {
  const { title, goal, inputs, formula, legend, steps, result, explain, warn, extra, onReset, on3D } = props;
  return (
    <section className="task">
      <div className="task-head">
        <h3>{title}</h3>
        <div className="seg">
          {on3D && <button className="btn small" onClick={on3D}>3D-де көрсету</button>}
          {onReset && <button className="btn small ghost" onClick={onReset} title="Осы есептің бастапқы мәндерін қайтару">↺ Бастапқы мәндерге қайтару</button>}
        </div>
      </div>
      <p className="task-goal"><b>Нені есептейміз:</b> {goal}</p>
      <div className="step"><h4><i>1</i>Бастапқы деректер</h4><div className="fields">{inputs}</div></div>
      <div className="step"><h4><i>2</i>Формула</h4>
        <div className="formulas">{formula.map((f, i) => <div key={i} className="fx">{f}</div>)}</div>
        <dl className="legend">{legend.map(([s, m, un], i) => <div key={i}><dt>{s}</dt><dd>{m}{un ? <>, <span className="un">{un}</span></> : null}</dd></div>)}</dl>
      </div>
      <div className="step"><h4><i>3</i>Есептеу</h4><div className="calc">{steps.map((s, i) => <div key={i}>{s}</div>)}</div></div>
      <div className="step step-result"><h4><i>4</i>Нәтиже</h4>
        <div className="answer">{result}</div>
        {explain && <p className="explain">{explain}</p>}
        {warn && <p className="task-warn">{warn}</p>}
      </div>
      {extra}
    </section>
  );
}
