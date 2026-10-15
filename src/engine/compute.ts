// Бірыңғай есептеу: бөлімдер, 3D және экспорт осыдан алады.
// 3D-дегі әр көрініс өз уақыт осінде жүреді (секундпен); күй тек t-ға тәуелді.
import { Params, SceneMode } from './types';
import { sanitize } from './sanitize';
import { computeTasks, Tasks, spreadAt, refillLevel } from './calc';

export interface ModeInfo { tEnd: number; marks: { t: number; label: string }[]; unit: 'min' | 'sec'; speed: number; title: string }

export interface Results {
  params: Params;
  warnings: string[];
  tasks: Tasks;
  modes: Record<SceneMode, ModeInfo>;
}

/** Келу кезеңдері (тұтанудан бастап, минут). */
export function arrivalTimes(p: Params) {
  const a = p.arrival;
  const call = a.delay, depart = call + a.gather, arrive = depart + a.travel, water = arrive + a.prep;
  return { call, depart, arrive, water };
}

/** Екі машинаның суы: кезекпен (алдымен АЦ-5) немесе қатар (әрқайсысы Q/2, біреуі таусылса — екіншісі толық Q). */
export function tanksAt(p: Params, tau: number) {
  const w = p.water; const Q = Math.max(0, w.Q);
  const use5 = w.use !== 'ac6', use6 = w.use !== 'ac5';
  let V5 = use5 ? w.V5 : 0, V6 = use6 ? w.V6 : 0; let f5 = 0, f6 = 0;
  const T = Math.max(0, tau) * 60; // секунд
  if (Q > 0) {
    if (use5 && use6 && w.order === 'par') {
      // қатар: әрқайсысы Q/2
      const tA = Math.min(V5, V6) / (Q / 2); // бірінші таусылу (с)
      if (T <= tA) { V5 -= (Q / 2) * T; V6 -= (Q / 2) * T; f5 = f6 = Q / 2; }
      else {
        V5 -= (Q / 2) * tA; V6 -= (Q / 2) * tA;
        const rest = T - tA;
        if (V5 > V6) { V5 = Math.max(0, V5 - Q * rest); V6 = 0; f5 = V5 > 0 ? Q : 0; }
        else { V6 = Math.max(0, V6 - Q * rest); V5 = 0; f6 = V6 > 0 ? Q : 0; }
      }
    } else {
      // кезекпен: алдымен АЦ-5, сосын АЦ-6
      let need = Q * T;
      if (use5) { const d = Math.min(V5, need); V5 -= d; need -= d; f5 = V5 > 0 ? Q : 0; }
      if (use6) { const d = Math.min(V6, need); V6 -= d; need -= d; f6 = !use5 || V5 <= 0 ? (V6 > 0 ? Q : 0) : 0; }
    }
  }
  const clean = (v: number) => (Math.abs(v) < 1e-6 ? 0 : v);
  return { ac5: { used: use5, V: clean(V5), cap: w.V5, flow: f5 }, ac6: { used: use6, V: clean(V6), cap: w.V6, flow: f6 } };
}

export function computeAll(raw: unknown): Results {
  const { params: p, warnings } = sanitize(raw);
  const t = computeTasks(p);
  const at = arrivalTimes(p);
  const lim = t.spread.tLim ?? 0;
  const fireEnd = Math.max(lim, at.water) + 1;
  const evac2T = (p.evac2.two ? t.evac2.two.T : t.evac2.one.T) ?? 600;
  const schoolT = t.school.T ?? 900;
  const wT = t.water.T ?? 30;
  const rf = t.refill;
  const rEnd = rf.delayed.total !== null ? rf.delayed.total : Math.max(p.refill.delay, rf.delayed.emptyAt ?? 0) + 15;

  const modes: Record<SceneMode, ModeInfo> = {
    overview: { tEnd: fireEnd * 60, marks: [], unit: 'min', speed: 30, title: 'Мектеп' },
    fire: {
      tEnd: fireEnd * 60, unit: 'min', speed: 30, title: 'Өрт және келу',
      marks: [
        { t: at.call * 60, label: 'қоңырау' }, { t: at.depart * 60, label: 'шығу' }, { t: at.arrive * 60, label: 'келу' },
        { t: at.water * 60, label: 'су беру' }, ...(t.spread.tLim !== null ? [{ t: t.spread.tLim * 60, label: 'қабырғаға жетті' }] : []),
      ],
    },
    evac2: {
      tEnd: Math.min(3600, evac2T + 10), unit: 'sec', speed: 5, title: '2-қабаттан эвакуация',
      marks: [{ t: p.evac2.t0, label: 'қозғалыс' }, ...(t.evac2.one.tWalk !== null ? [{ t: p.evac2.t0 + t.evac2.one.tWalk, label: 'есікке жетті' }] : []), { t: evac2T, label: 'аяқталды' }],
    },
    evacAll: {
      tEnd: Math.min(7200, schoolT + 15), unit: 'sec', speed: 10, title: `${p.school.N} адамның эвакуациясы`,
      marks: [{ t: p.school.t0, label: 'қозғалыс' }, ...(t.school.walk !== null ? [{ t: p.school.t0 + t.school.walk, label: 'есікке жетті' }] : []),
        ...t.school.dirs.map((d, i) => ({ t: d.T ?? 0, label: `${i + 1}-бағыт` })).filter((m) => m.t > 0)],
    },
    water: { tEnd: Math.min(600, wT + 1) * 60, unit: 'min', speed: 60, title: 'Су қоры', marks: wT ? [{ t: wT * 60, label: 'су таусылды' }] : [] },
    refill: {
      tEnd: Math.min(600, rEnd + 1) * 60, unit: 'min', speed: 90, title: 'Су қорын толықтыру',
      marks: [{ t: p.refill.delay * 60, label: 'толықтыру' },
        ...(rf.delayed.emptyAt !== null ? [{ t: rf.delayed.emptyAt * 60, label: 'су таусылды' }] : []),
        ...(rf.delayed.total !== null && rf.delayed.emptyAt === null ? [{ t: rf.delayed.total * 60, label: 'су таусылды' }] : [])],
    },
    staff: { tEnd: 12, unit: 'sec', speed: 1, title: 'Міндеттерге бөлу', marks: [] },
  };
  return { params: p, warnings, tasks: t, modes };
}

// ---------------- 3D күйі ----------------
export type EvacPhase = 'wait' | 'walk' | 'pass' | 'done' | 'blocked';
export interface EvacGroup { path: 'r1' | 'r2'; N: number; phase: EvacPhase; part: 'corr' | 'stair'; frac: number; exited: number; queue: number }

function groupAt(path: 'r1' | 'r2', sec: number, N: number, t0: number, tCorr: number | null, tStair: number | null, q: number): EvacGroup {
  const g: EvacGroup = { path, N, phase: 'wait', part: 'corr', frac: 0, exited: 0, queue: N };
  if (sec < t0) return g;
  if (tCorr === null || tStair === null) return { ...g, phase: 'blocked' };
  const s = sec - t0;
  if (s < tCorr) return { ...g, phase: 'walk', part: 'corr', frac: tCorr > 0 ? s / tCorr : 1 };
  if (s < tCorr + tStair) return { ...g, phase: 'walk', part: 'stair', frac: tStair > 0 ? (s - tCorr) / tStair : 1 };
  const passS = s - tCorr - tStair;
  if (q <= 0) return N > 0 ? { ...g, phase: 'blocked', part: 'stair', frac: 1 } : { ...g, phase: 'done', queue: 0 };
  const exited = Math.min(N, Math.floor(q * passS + 1e-9));
  return { ...g, phase: exited >= N ? 'done' : 'pass', part: 'stair', frac: 1, exited, queue: N - exited };
}

export interface Snapshot {
  mode: SceneMode; sec: number;
  fire: { show: boolean; tMin: number; r: number; S: number; limited: boolean; rMax: number } | null;
  truck: { phase: 'station' | 'gather' | 'driving' | 'prep' | 'water'; frac: number } | null;
  tanks: { id: 'kamaz' | 'ural'; present: boolean; V: number; cap: number; flow: number }[];
  refill: { on: boolean; out: number; empty: boolean } | null;
  groups: EvacGroup[];
  staff: { frac: number } | null;
}

export function snapshotAt(R: Results, mode: SceneMode, sec: number): Snapshot {
  const p = R.params; const T = R.tasks;
  const snap: Snapshot = { mode, sec, fire: null, truck: null, tanks: [], refill: null, groups: [], staff: null };
  const min = sec / 60;
  if (mode === 'fire' || mode === 'overview') {
    const at = arrivalTimes(p);
    if (mode === 'fire') {
      const rMax = T.spread.rMax; const tl = T.spread.tLim;
      const tEff = tl !== null ? Math.min(min, tl) : min;
      const sp = spreadAt(p.spread.u, tEff, rMax);
      snap.fire = { show: true, tMin: min, r: sp.r, S: sp.S, limited: tl !== null && min > tl + 1e-9, rMax };
      let phase: NonNullable<Snapshot['truck']>['phase'] = 'station'; let frac = 0;
      if (min >= at.water) { phase = 'water'; frac = 1; }
      else if (min >= at.arrive) { phase = 'prep'; frac = (min - at.arrive) / Math.max(1e-9, at.water - at.arrive); }
      else if (min >= at.depart) { phase = 'driving'; frac = (min - at.depart) / Math.max(1e-9, at.arrive - at.depart); }
      else if (min >= at.call) { phase = 'gather'; frac = (min - at.call) / Math.max(1e-9, at.depart - at.call); }
      snap.truck = { phase, frac };
    }
  }
  if (mode === 'water') {
    const s = tanksAt(p, min);
    snap.tanks = [
      { id: 'kamaz', present: s.ac5.used, V: s.ac5.V, cap: s.ac5.cap, flow: s.ac5.flow },
      { id: 'ural', present: s.ac6.used, V: s.ac6.V, cap: s.ac6.cap, flow: s.ac6.flow },
    ];
  }
  if (mode === 'refill') {
    const r = p.refill; const l = refillLevel(r.V0, r.qOut, r.qIn, r.delay, min);
    snap.tanks = [{ id: 'kamaz', present: true, V: l.V, cap: r.V0, flow: l.out }, { id: 'ural', present: false, V: 0, cap: 0, flow: 0 }];
    snap.refill = { on: l.refillOn, out: l.out, empty: l.V <= 1e-6 };
  }
  if (mode === 'evac2') {
    const e = p.evac2; const one = T.evac2.one;
    if (!e.two) snap.groups = [groupAt('r1', sec, e.N, e.t0, one.tCorr, one.tStair, e.q)];
    else snap.groups = T.evac2.two.routes.map((r, i) => groupAt(i ? 'r2' : 'r1', sec, r.N, e.t0, r.tCorr, r.tStair, e.q));
  }
  if (mode === 'evacAll') {
    const s = p.school;
    snap.groups = T.school.dirs.map((d, i) => groupAt(i ? 'r2' : 'r1', sec, d.N, s.t0, d.tCorr, d.tStair, i ? s.q2 : s.q1));
  }
  if (mode === 'staff') snap.staff = { frac: Math.min(1, sec / 8) };
  return snap;
}
