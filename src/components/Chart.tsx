import React, { useMemo, useRef, useState } from 'react';
import { useTime } from '../state/store';
import { fmt } from '../engine/num';

export const SERIES = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', violet: '#6250d6', gray: '#8a8f96', red: '#d62d20', yellow: '#c98500' };

export interface Series { name: string; color: string; points: [number, number][]; dash?: string; area?: boolean; width?: number }
export interface VMarker { x: number; label: string; color?: string }

function niceStep(range: number, target = 5) {
  const raw = range / target; const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p; const s = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10; return s * p;
}

export function LineChart(props: {
  series: Series[]; xLabel: string; yLabel: string; height?: number; xMax?: number; yMax?: number; xMin?: number;
  markers?: VMarker[]; timeToX?: (t: number) => number | null; title?: string; yUnit?: string; xUnit?: string;
}) {
  const { series, xLabel, yLabel, height = 220, markers = [], timeToX, title, yUnit = '', xUnit = '' } = props;
  const W = 560, H = height, m = { l: 56, r: 14, t: 14, b: 40 };
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const xMin = props.xMin ?? Math.min(0, ...all.map((p) => p[0]));
  const xMax = props.xMax ?? Math.max(1, ...all.map((p) => p[0]));
  const yMax0 = props.yMax ?? Math.max(1, ...all.map((p) => p[1]));
  const ys = niceStep(yMax0, 4); const yMax = Math.ceil(yMax0 / ys) * ys || 1;
  const xs = niceStep(xMax - xMin, 6);
  const X = (x: number) => m.l + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (W - m.l - m.r);
  const Y = (y: number) => H - m.b - (y / yMax) * (H - m.t - m.b);
  const time = useTime();
  const tx = timeToX ? timeToX(time.t) : null;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const xticks = useMemo(() => { const a: number[] = []; for (let x = Math.ceil(xMin / xs) * xs; x <= xMax + 1e-9; x += xs) a.push(+x.toFixed(6)); return a; }, [xMin, xMax, xs]);
  const yticks: number[] = []; for (let y = 0; y <= yMax + 1e-9; y += ys) yticks.push(+y.toFixed(6));
  const valueAt = (s: Series, x: number) => {
    const p = s.points; if (!p.length) return null;
    if (x < p[0][0] || x > p[p.length - 1][0]) return null;
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
    return p[p.length - 1][1];
  };
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const x = xMin + ((px - m.l) / (W - m.l - m.r)) * (xMax - xMin);
    setHover(x >= xMin && x <= xMax ? x : null);
  };

  return (
    <figure className="chart">
      {title && <figcaption>{title}</figcaption>}
      {series.length > 1 && (
        <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color, borderTop: s.dash ? `2px dashed ${s.color}` : undefined, height: s.dash ? 0 : 3 }} />{s.name}</span>)}</div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title ?? yLabel}: график`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yticks.map((y) => <g key={y}><line x1={m.l} x2={W - m.r} y1={Y(y)} y2={Y(y)} className="grid" /><text x={m.l - 6} y={Y(y)} className="tick" textAnchor="end" dominantBaseline="middle">{fmt(y, 2)}</text></g>)}
        {xticks.map((x) => <text key={x} x={X(x)} y={H - m.b + 16} className="tick" textAnchor="middle">{fmt(x, 2)}</text>)}
        <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} className="axis" />
        <text x={(m.l + W - m.r) / 2} y={H - 4} className="axis-label" textAnchor="middle">{xLabel}</text>
        <text x={12} y={(m.t + H - m.b) / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`}>{yLabel}</text>
        {series.map((s) => {
          const pts = s.points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
          if (!pts.length) return null;
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(Math.min(p[1], yMax)).toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              {s.area && <path d={`${d} L${X(pts[pts.length - 1][0])},${Y(0)} L${X(pts[0][0])},${Y(0)} Z`} fill={s.color} opacity={0.12} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" />
            </g>
          );
        })}
        {markers.filter((mk) => mk.x >= xMin && mk.x <= xMax).map((mk, i) => (
          <g key={i}><line x1={X(mk.x)} x2={X(mk.x)} y1={m.t} y2={H - m.b} stroke={mk.color ?? '#6b7280'} strokeDasharray="3 3" />
            <text x={X(mk.x) + 3} y={m.t + 10 + (i % 3) * 12} className="mk-label">{mk.label}</text></g>
        ))}
        {tx !== null && tx >= xMin && tx <= xMax && <line x1={X(tx)} x2={X(tx)} y1={m.t} y2={H - m.b} stroke="#d62d20" strokeWidth={1.5} />}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={X(hover)} x2={X(hover)} y1={m.t} y2={H - m.b} stroke="#111" opacity={0.25} />
            {series.map((s) => { const v = valueAt(s, hover); return v === null ? null : <circle key={s.name} cx={X(hover)} cy={Y(Math.min(v, yMax))} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />; })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="tooltip">
          <b>{xLabel}: {fmt(hover, 2)} {xUnit}</b>
          {series.map((s) => { const v = valueAt(s, hover); return v === null ? null : <div key={s.name}><i style={{ background: s.color }} />{s.name}: {fmt(v, 2)} {yUnit}</div>; })}
        </div>
      )}
    </figure>
  );
}

export interface GanttRow { label: string; bars: { from: number; to: number; color: string; text?: string; hatch?: boolean }[] }
export function Gantt({ rows, xMax, xLabel, timeToX, markers = [] }: { rows: GanttRow[]; xMax: number; xLabel: string; timeToX?: (t: number) => number | null; markers?: VMarker[] }) {
  const W = 560, rh = 30, m = { l: 132, r: 12, t: 8, b: 34 };
  const H = m.t + rows.length * rh + m.b;
  const X = (x: number) => m.l + (Math.min(x, xMax) / Math.max(1e-9, xMax)) * (W - m.l - m.r);
  const time = useTime();
  const tx = timeToX ? timeToX(time.t) : null;
  const step = niceStep(xMax, 6); const ticks: number[] = []; for (let x = 0; x <= xMax + 1e-9; x += step) ticks.push(+x.toFixed(6));
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Уақыт шкаласы">
        <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" opacity="0.6" /></pattern></defs>
        {ticks.map((x) => <g key={x}><line x1={X(x)} x2={X(x)} y1={m.t} y2={H - m.b} className="grid" /><text x={X(x)} y={H - m.b + 14} className="tick" textAnchor="middle">{fmt(x, 2)}</text></g>)}
        <text x={(m.l + W - m.r) / 2} y={H - 4} className="axis-label" textAnchor="middle">{xLabel}</text>
        {rows.map((r, i) => (
          <g key={i}>
            <text x={m.l - 6} y={m.t + i * rh + rh / 2} className="tick row-label" textAnchor="end" dominantBaseline="middle">{r.label}</text>
            {r.bars.filter((b) => b.to > b.from).map((b, j) => (
              <g key={j}>
                <rect x={X(b.from) + 1} y={m.t + i * rh + 5} width={Math.max(1, X(b.to) - X(b.from) - 2)} height={rh - 10} rx={4} fill={b.color} />
                {b.hatch && <rect x={X(b.from) + 1} y={m.t + i * rh + 5} width={Math.max(1, X(b.to) - X(b.from) - 2)} height={rh - 10} rx={4} fill="url(#hatch)" />}
                {b.text && X(b.to) - X(b.from) > 34 && <text x={(X(b.from) + X(b.to)) / 2} y={m.t + i * rh + rh / 2 + 1} className="bar-text" textAnchor="middle" dominantBaseline="middle">{b.text}</text>}
              </g>
            ))}
          </g>
        ))}
        {markers.map((mk, i) => <g key={i}><line x1={X(mk.x)} x2={X(mk.x)} y1={m.t} y2={H - m.b} stroke={mk.color ?? '#111'} strokeDasharray="3 3" /></g>)}
        {tx !== null && tx >= 0 && tx <= xMax && <line x1={X(tx)} x2={X(tx)} y1={m.t} y2={H - m.b} stroke="#d62d20" strokeWidth={1.5} />}
      </svg>
    </figure>
  );
}

export function Table({ head, rows, caption }: { head: React.ReactNode[]; rows: React.ReactNode[][]; caption?: string }) {
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
