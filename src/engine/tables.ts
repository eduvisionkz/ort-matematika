// Графиктер мен кестелерге арналған деректер — тек есептеу модулінің нәтижелерінен алынады.
import { Results } from './compute';
import { waterStateAt, supplyDuration, gapVariants, availableVolume } from './water';
import { fmt, pct } from './num';
import { Params } from './types';
import { computeAll } from './compute';

export type Pt = [number, number];

export function waterSeries(R: Results) {
  const w = R.water;
  if (!w) return null;
  const V: Pt[] = []; const res: Pt[] = []; const qReq: Pt[] = []; const qOut: Pt[] = []; const qIn: Pt[] = []; const unmet: Pt[] = [];
  for (const s of w.segs) {
    V.push([s.t0, s.V0], [s.t1, s.V1]);
    res.push([s.t0, s.reserve], [s.t1, s.reserve]);
    qReq.push([s.t0, s.qReq], [s.t1, s.qReq]);
    qOut.push([s.t0, s.qOut], [s.t1, s.qOut]);
    qIn.push([s.t0, s.qAccepted + s.qWasted], [s.t1, s.qAccepted + s.qWasted]);
    unmet.push([s.t0, s.cum0.unmet], [s.t1, s.cum0.unmet + 60 * Math.max(0, s.qReq - s.qOut) * (s.t1 - s.t0)]);
  }
  return { V, res, qReq, qOut, qIn, unmet };
}

/** 1 минуттық қадаммен су кестесі (τ бойынша), CSV және есеп үшін. */
export function waterTable(R: Results) {
  const w = R.water; if (!w || R.ts === null) return { head: [] as string[], rows: [] as string[][] };
  const rows: string[][] = [];
  const steps = Math.ceil(w.T);
  for (let i = 0; i <= steps; i++) {
    const tau = Math.min(i, w.T);
    const s = waterStateAt(w, tau - (tau === w.T ? 1e-9 : 0));
    rows.push([fmt(tau, 2), fmt(R.ts + tau, 2), fmt(s.V, 1), fmt(s.reserve, 1), fmt(s.qReq, 2), fmt(s.qOut, 2), fmt(s.qIn, 2), fmt(s.delivered, 1), fmt(s.unmet, 1)]);
    if (tau === w.T) break;
  }
  return { head: ['τ, мин (су беру басынан)', 't, мин (хабарлаудан)', 'Қол жетімді V, л', 'Vқ, л', 'Сұралған Q, л/с', 'Нақты Q, л/с', 'Кіріс Q, л/с', 'Берілді, л', 'Қамтылмаған, л'], rows };
}

export function staffSeries(R: Results) {
  const avail: Pt[] = [], req: Pt[] = [];
  for (const s of R.staff.steps) { avail.push([s.from, s.avail], [s.to, s.avail]); req.push([s.from, s.req], [s.to, s.req]); }
  return { avail, req };
}

export function tqCurve(vd: number, qMax = 20): Pt[] {
  const pts: Pt[] = [];
  for (let q = 1; q <= qMax + 1e-9; q += 0.25) { const T = supplyDuration(vd, q); if (T !== null) pts.push([q, T]); }
  return pts;
}

export function sensitivityTable(vols: number[], qs: number[]) {
  return {
    head: ['Vп, л \\ Q, л/с', ...qs.map((q) => fmt(q))],
    rows: vols.map((v) => [fmt(v), ...qs.map((q) => { const T = supplyDuration(v, q); return T === null ? 'Су шығыны жоқ' : `${fmt(T, 2)} мин`; })]),
  };
}

export function currentGapVariants(R: Results) {
  const p = R.params;
  const a = p.trucks[0], b = p.trucks[1];
  const vd = availableVolume(a.v0, a.reservePct);
  const q = Math.max(0.0001, R.waterSummary.qReq || a.flowLps || 10);
  return { vd, q, rows: gapVariants(vd, q, [6, 7.5, 9, 12], availableVolume(b.v0, b.reservePct)) };
}

export interface CompareRow { name: string; unit: string; a: number | null; b: number | null; diff: number | null; diffPct: number | null; note?: string }

const finite = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? null : x);

export function metricsOf(R: Results) {
  const w = R.water;
  return {
    evac: finite(R.evac.total),
    routes: finite(R.routes.total),
    arrival: finite(R.tFirstArrival),
    start: finite(R.ts),
    supported: finite(R.waterSummary.supported),
    vd: R.waterSummary.vdTotal,
    req: R.waterSummary.req,
    deficit: R.waterSummary.deficitSimple,
    unmet: w ? w.totals.unmet : null,
    gaps: w ? w.gaps.reduce((a, g) => a + (g.to - g.from), 0) : null,
    staffReq: R.staff.initialReq,
    staffAvail: R.staff.initialAvail,
    staffDef: R.staff.initialDeficit,
    ph: R.staff.H,
  };
}

export const METRIC_DEFS: { key: keyof ReturnType<typeof metricsOf>; name: string; unit: string }[] = [
  { key: 'evac', name: 'Модельдік эвакуация учаскесінің уақыты', unit: 'с' },
  { key: 'routes', name: 'Бірнеше маршрут: tжалпы', unit: 'с' },
  { key: 'arrival', name: 'Бірінші машинаның келуі (t)', unit: 'мин' },
  { key: 'start', name: 'Су беру басы (t)', unit: 'мин' },
  { key: 'supported', name: 'Берілген шығынның қамтылған ұзақтығы (τ)', unit: 'мин' },
  { key: 'vd', name: 'Қол жетімді су (барлық қатысатын машина)', unit: 'л' },
  { key: 'req', name: 'Қажетті көлем Vқаж', unit: 'л' },
  { key: 'deficit', name: 'Су тапшылығы ΔV (толықтырусыз)', unit: 'л' },
  { key: 'unmet', name: 'Қамтылмаған көлем (уақыт моделі)', unit: 'л' },
  { key: 'gaps', name: 'Су берудегі үзілістер/жетіспеушілік ұзақтығы', unit: 'мин' },
  { key: 'staffReq', name: 'Қажет адам (бастапқы)', unit: 'адам' },
  { key: 'staffAvail', name: 'Бар адам (бастапқы)', unit: 'адам' },
  { key: 'staffDef', name: 'Жеке құрам тапшылығы (бастапқы)', unit: 'адам' },
  { key: 'ph', name: 'Адам-сағат', unit: 'адам-сағ' },
];

export function compareScenarios(A: Params, B: Params): CompareRow[] {
  const ma = metricsOf(computeAll(A)), mb = metricsOf(computeAll(B));
  return METRIC_DEFS.map((d) => {
    const a = ma[d.key], b = mb[d.key];
    const diff = a !== null && b !== null ? b - a : null;
    return { name: d.name, unit: d.unit, a, b, diff, diffPct: diff !== null && a !== null ? pct(diff, a) : null };
  });
}

/** Параметрлердің айырмасы (тек өзгергендері). */
export function paramDiff(A: Params, B: Params) {
  const out: { path: string; a: string; b: string }[] = [];
  const walk = (x: any, y: any, path: string) => {
    if (typeof x !== 'object' || x === null || typeof y !== 'object' || y === null) {
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path, a: String(x), b: String(y) });
      return;
    }
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    keys.forEach((k) => { if (k !== 'name' && k !== 'version' && k !== 'scene') walk(x[k], y[k], path ? `${path}.${k}` : k); });
  };
  walk(A, B, '');
  return out;
}

export function toCSV(head: string[], rows: (string | number | null)[][]) {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v).replace(/(\d)\u00a0(?=\d)/g, '$1'); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Excel-ге ыңғайлы: нүктелі үтір бөлгіш, UTF-8 BOM
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}
