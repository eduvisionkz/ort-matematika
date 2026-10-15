// Есептер: барлық формула осы жерде. Есептеу толық дәлдікпен, дөңгелектеу тек экранда.
import { Params } from './types';

/** Жұмыста қабылданған π мәні. */
export const PI = 3.14;
const EPS = 1e-9;
const pos = (x: number) => Number.isFinite(x) && x > EPS;

// ---------------- 1. Бөлме ауданы ----------------
export function roomArea(a: number, b: number): number | null {
  return pos(a) && pos(b) ? a * b : null;
}

// ---------------- 2. Өрттің таралуы ----------------
export interface SpreadPoint { t: number; r: number; S: number; valid: boolean }
/** Шеңберлік есеп қолданылатын шек: орталықтан жақын қабырғаға дейінгі қашықтық. */
export function spreadLimit(a: number, b: number, u: number) {
  const rMax = Math.min(a, b) / 2;
  const tLim = pos(u) ? rMax / u : null;
  return { rMax, tLim };
}
export function spreadAt(u: number, t: number, rMax: number): SpreadPoint {
  const r = Math.max(0, u) * Math.max(0, t);
  return { t, r, S: PI * r * r, valid: r <= rMax + EPS };
}

// ---------------- 3. Келу уақыты ----------------
export function avgSpeed(Lm: number, tMin: number) {
  const Lkm = Lm / 1000, th = tMin / 60;
  return { Lkm, th, v: pos(th) ? Lkm / th : null };
}

// ---------------- 4–5. Эвакуация ----------------
export interface RouteResult { N: number; tWalk: number | null; tPass: number | null; T: number | null; tCorr: number | null; tStair: number | null }
/** T = tдайындық + Lдәліз/vдәліз + Lбаспалдақ/vбаспалдақ + N/q */
export function routeTime(N: number, t0: number, Lc: number, vc: number, Ls: number, vs: number, q: number): RouteResult {
  const tCorr = pos(vc) ? Lc / vc : Lc <= EPS ? 0 : null;
  const tStair = pos(vs) ? Ls / vs : Ls <= EPS ? 0 : null;
  const tWalk = tCorr !== null && tStair !== null ? tCorr + tStair : null;
  const tPass = pos(q) ? N / q : N <= 0 ? 0 : null;
  const T = tWalk !== null && tPass !== null ? t0 + tWalk + tPass : null;
  return { N, tWalk, tPass, T, tCorr, tStair };
}
const maxOrNull = (xs: (number | null)[]) => (xs.some((x) => x === null) ? null : Math.max(...(xs as number[])));

export function splitEqual(N: number) { const N1 = Math.ceil(N / 2); return [N1, N - N1] as const; }

// ---------------- 6. Су шығыны және стволдар ----------------
export function flowNeed(I: number, S: number, qN: number) {
  const Qreq = Math.max(0, I) * Math.max(0, S);
  const n = pos(qN) ? (Qreq <= EPS ? 0 : Math.ceil(Qreq / qN - EPS)) : null;
  return { S, Qreq, n, Qact: n === null ? null : n * qN };
}

// ---------------- 7–8. Су қоры ----------------
export const supplyTime = (V: number, Q: number) => (pos(Q) ? Math.max(0, V) / (60 * Q) : null);
export const volumeFor = (Q: number, tMin: number) => Math.max(0, Q) * 60 * Math.max(0, tMin);

// ---------------- 9. Толықтыру ----------------
export interface RefillResult {
  net: number;
  /** Толықтыру бірден басталғанда */
  immediate: { T: number | null; steady: boolean };
  /** Толықтыру D минуттан кейін */
  delayed: {
    used: number; left: number; tAfter: number | null; total: number | null; steady: boolean;
    /** Толықтыру басталғанға дейін су таусылса */
    emptyAt: number | null; gap: number | null;
  };
}
export function refill(V0: number, qOut: number, qIn: number, D: number): RefillResult {
  const net = qOut - qIn;
  const steady = !(net > EPS);
  const immediate = { T: steady ? null : V0 / (60 * net), steady };
  const used = qOut * 60 * D;
  if (pos(qOut) && used >= V0 - EPS && V0 >= 0) {
    const emptyAt = V0 / (60 * qOut);
    return { net, immediate, delayed: { used: V0, left: 0, tAfter: null, total: emptyAt, steady, emptyAt, gap: D - emptyAt } };
  }
  const left = V0 - used;
  const tAfter = steady ? null : left / (60 * net);
  return { net, immediate, delayed: { used, left, tAfter, total: tAfter === null ? null : D + tAfter, steady, emptyAt: null, gap: null } };
}
/** Цистернадағы су τ минутта (толықтыру D минуттан басталады). */
export function refillLevel(V0: number, qOut: number, qIn: number, D: number, tau: number) {
  let V = V0; let out = qOut;
  const t1 = Math.min(tau, D);
  V = Math.max(0, V0 - qOut * 60 * t1);
  if (V <= 0 && tau <= D) out = 0;
  if (tau > D) {
    const dt = tau - D; const net = qOut - qIn;
    if (net > 0) V = Math.max(0, V - net * 60 * dt);
    else V = V + Math.abs(net) * 60 * dt; // кіріс басым: сыйымдылықпен шектеледі
    V = Math.min(V, Math.max(V0, 0));
    if (V <= 0 && net > 0) out = qIn; // бос цистерна: тек кіріс ағыны беріледі
  }
  return { V, out, refillOn: tau >= D };
}

// ---------------- 10. Қызметкерлер ----------------
export const staffNeed = (k: number, n: number, d: number, c: number) => k * n + d + c;

// ---------------- Жиынтық ----------------
export function computeTasks(p: Params) {
  const S0 = roomArea(p.room.a, p.room.b);
  const lim = spreadLimit(p.room.a, p.room.b, p.spread.u);
  const spreadTable = [2, 4, 6, 8, 10].map((t) => spreadAt(p.spread.u, t, lim.rMax));
  const spreadNow = spreadAt(p.spread.u, p.spread.t, lim.rMax);

  const ar = p.arrival;
  const speed = avgSpeed(ar.L, ar.travel);
  const callToWater = ar.gather + ar.travel + ar.prep;
  const cases = [ar.delay, ar.delay2].map((d) => {
    const start = d + callToWater;
    return { delay: d, start, ...spreadAt(p.spread.u, start, lim.rMax) };
  });

  const e = p.evac2;
  const one = routeTime(e.N, e.t0, e.Lc, e.vc, e.Ls, e.vs, e.q);
  const [h1, h2] = splitEqual(e.N);
  const twoR = [routeTime(h1, e.t0, e.Lc, e.vc, e.Ls, e.vs, e.q), routeTime(h2, e.t0, e.Lc, e.vc, e.Ls, e.vs, e.q)];
  const two = { routes: twoR, T: maxOrNull(twoR.map((r) => r.T)) };

  const s = p.school;
  const N1 = s.equal ? splitEqual(s.N)[0] : Math.min(s.N, Math.max(0, Math.round(s.N1)));
  const N2 = s.N - N1;
  const dirs = [routeTime(N1, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q1), routeTime(N2, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q2)];
  const schoolT = maxOrNull(dirs.map((d) => d.T));
  const [e1, e2] = splitEqual(s.N);
  const eq = [routeTime(e1, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q1), routeTime(e2, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q2)];
  const eqT = maxOrNull(eq.map((d) => d.T));
  const walk = dirs[0].tWalk;
  const window = walk === null ? null : s.Tgoal - s.t0 - walk;
  const needQ = [N1, N2].map((n) => (window !== null && window > EPS ? n / window : null));
  const compare = [450, 590].map((N) => {
    const [a, b] = splitEqual(N);
    const r = [routeTime(a, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q1), routeTime(b, s.t0, s.Lc, s.vc, s.Ls, s.vs, s.q2)];
    return { N, per: [a, b], T: maxOrNull(r.map((x) => x.T)), needQ: [a, b].map((n) => (window !== null && window > EPS ? n / window : null)) };
  });

  const fireS = spreadAt(p.spread.u, p.flow.tFire, lim.rMax);
  const flowFire = flowNeed(p.flow.I, fireS.S, p.flow.qN);
  const flowRoom = flowNeed(p.flow.I, S0 ?? 0, p.flow.qN);

  const w = p.water;
  const vols = [{ id: 'ac5', name: 'КамАЗ АЦ-5', V: w.V5 }, { id: 'ac6', name: 'Урал АЦ-6', V: w.V6 }, { id: 'both', name: 'Екі машина', V: w.V5 + w.V6 }] as const;
  const qList = [3.5, 7, 14];
  const table = vols.map((v) => ({ ...v, T: qList.map((q) => supplyTime(v.V, q)) }));
  const chosen = vols.find((v) => v.id === w.use)!;
  const Tchosen = supplyTime(chosen.V, w.Q);
  const Vreq = volumeFor(w.Q, w.tWork);
  const diffs = vols.map((v) => ({ ...v, diff: v.V - Vreq }));

  const rf = p.refill;
  const ref = refill(rf.V0, rf.qOut, rf.qIn, rf.delay);

  const st = p.staff;
  const P = staffNeed(st.k, st.n, st.d, st.c);
  const examples = [[1, 1], [2, 1], [2, 2]].map(([k, d]) => ({ k, d, n: st.n, c: st.c, P: staffNeed(k, st.n, d, st.c) }));

  return {
    area: { S: S0 },
    spread: { ...lim, table: spreadTable, now: spreadNow },
    arrival: { ...speed, callToWater, cases },
    evac2: { one, two, half: [h1, h2] as const },
    school: { N1, N2, dirs, T: schoolT, eqT, diffVsEqual: schoolT !== null && eqT !== null ? schoolT - eqT : null, walk, window, needQ, compare },
    flow: { fire: { ...flowFire, t: p.flow.tFire, valid: fireS.valid, r: fireS.r }, room: flowRoom },
    water: { qList, table, chosen, T: Tchosen, Vreq, diffs },
    refill: ref,
    staff: { P, deficit: Math.max(0, P - st.avail), surplus: Math.max(0, st.avail - P), examples },
  };
}
export type Tasks = ReturnType<typeof computeTasks>;
