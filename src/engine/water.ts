// Су қоры: қарапайым формулалар және оқиғаларға негізделген дәл уақыт моделі.
// Уақыт — минут, шығын — л/с, көлем — литр. 1 мин ішінде Q л/с шығын 60·Q литр береді.
import { safeDiv } from './num';

const EPS = 1e-9;

export const availableVolume = (v0: number, reservePct: number) => Math.max(0, v0 * (1 - reservePct / 100));
export const reserveVolume = (v0: number, reservePct: number) => Math.max(0, (v0 * reservePct) / 100);

/** T = Vп / (60Q). Q = 0 болса null («Су шығыны жоқ»). */
export const supplyDuration = (vd: number, q: number): number | null => (q <= 0 ? null : safeDiv(vd, 60 * q));

/** Vқалдық(t) = max(0; Vп − 60Qt) */
export const remainingAt = (vd: number, q: number, tMin: number) => Math.max(0, vd - 60 * q * tMin);

/** Vқаж = 60QT */
export const requiredVolume = (q: number, tMin: number) => 60 * q * tMin;

/** ΔV = max(0; Vқаж − Vп), D% = D / Vқаж · 100 % */
export function waterDeficit(vd: number, q: number, tMin: number) {
  const req = requiredVolume(q, tMin);
  const D = Math.max(0, req - vd);
  return { req, D, Dpct: req > 0 ? (D / req) * 100 : null, leftover: Math.max(0, vd - req) };
}

/** Үздіксіз толықтыру: Qшығу > Qкіріс болса T = Vп / [60(Qшығу − Qкіріс)], әйтпесе null (шартты баланс/өсу). */
export const refillDuration = (vd: number, qOut: number, qIn: number): number | null =>
  qOut > qIn ? vd / (60 * (qOut - qIn)) : null;

/** Кешіктіріліп қосылатын толықтыру (тексеру формуласы). */
export function delayedRefillDuration(vd: number, qOut: number, delayMin: number, qIn: number) {
  if (qOut <= 0) return { total: null as number | null, afterDelay: null as number | null, v1: vd };
  const v1 = vd - 60 * qOut * delayMin;
  if (v1 <= 0) return { total: vd / (60 * qOut), afterDelay: 0, v1: 0 };
  const after = refillDuration(v1, qOut, qIn);
  return { total: after === null ? null : delayMin + after, afterDelay: after, v1 };
}

/** G = max(0; tж − T), Vаралық = 60QG */
export function supplyGap(tReady: number, tReserve: number, q: number) {
  const G = Math.max(0, tReady - tReserve);
  return { G, unsupplied: 60 * q * G };
}

/** T(Q), T′(Q) = −Vп/(60Q²) және сызықтық жуықтау. */
export function sensitivity(vd: number, q0: number, q1: number) {
  const T0 = supplyDuration(vd, q0);
  const T1 = supplyDuration(vd, q1);
  const d = q0 > 0 ? -vd / (60 * q0 * q0) : null;
  const linear = T0 !== null && d !== null ? T0 + d * (q1 - q0) : null;
  return { T0, T1, d, linear, error: T1 !== null && linear !== null ? T1 - linear : null };
}

/** Кесінді-тұрақты шығын: кезеңдер, соңғы шығынмен жалғасады. Vпайд = 60∫Q(t)dt. */
export function piecewise(vd: number, pieces: { durMin: number; q: number }[]) {
  let V = vd; let t = 0; let used = 0;
  const rows: { from: number; to: number; q: number; used: number; left: number }[] = [];
  for (const pc of pieces) {
    if (pc.durMin <= 0) continue;
    const need = 60 * pc.q * pc.durMin;
    if (need <= V + EPS) {
      V -= need; used += need;
      rows.push({ from: t, to: t + pc.durMin, q: pc.q, used: need, left: V });
      t += pc.durMin;
    } else {
      const dt = pc.q > 0 ? V / (60 * pc.q) : 0;
      used += V;
      rows.push({ from: t, to: t + dt, q: pc.q, used: V, left: 0 });
      t += dt; V = 0;
      return { used, left: 0, extra: 0, total: t, exhaustedInPieces: true, rows, lastQ: pc.q };
    }
  }
  const last = [...pieces].reverse().find((x) => x.durMin > 0);
  const lastQ = last ? last.q : 0;
  const extra = lastQ > 0 ? V / (60 * lastQ) : null;
  if (extra !== null && extra > 0) rows.push({ from: t, to: t + extra, q: lastQ, used: V, left: 0 });
  return { used, left: V, extra, total: extra === null ? null : t + extra, exhaustedInPieces: false, rows, lastQ };
}

/** Келесі су көзінің дайындық нұсқалары (§17): әр нұсқа толық уақыт моделі арқылы есептеледі. */
export function gapVariants(vd: number, q: number, readyTimes: number[], nextVd: number) {
  return readyTimes.map((tr) => {
    const sim = simulateWater({
      supplies: [{ id: 'a', name: 'A', tauReady: 0, vd, reserve: 0 }, { id: 'b', name: 'B', tauReady: tr, vd: nextVd, reserve: 0 }],
      qReq: q, demandMin: Math.max(tr + 1, 12), hydrant: { enabled: false, delayMin: 0, qIn: 0 },
    });
    const g = supplyGap(tr, supplyDuration(vd, q) ?? Infinity, q);
    const simGap = sim.gaps.reduce((a, x) => a + (x.to - x.from), 0);
    const simUnmet = sim.gaps.filter((x) => x.from < tr + 1e-9).reduce((a, x) => a + x.unmet, 0);
    return { tReady: tr, G: Number.isFinite(g.G) ? g.G : 0, unsupplied: g.unsupplied, simGap, simUnmet };
  });
}

// ---------------- Уақыт бойынша дәл модель ----------------

export interface Supply { id: string; name: string; tauReady: number; vd: number; reserve: number }
export interface WaterSimInput { supplies: Supply[]; qReq: number; demandMin: number; hydrant: { enabled: boolean; delayMin: number; qIn: number } }

export interface WaterSeg {
  t0: number; t1: number;
  V0: number; V1: number; cap: number; reserve: number;
  qReq: number; qOut: number; qIn: number; qAccepted: number; qWasted: number;
  cum0: { delivered: number; unmet: number; inflow: number; wasted: number };
}
export interface WaterState {
  tau: number; V: number; cap: number; reserve: number;
  qReq: number; qOut: number; qIn: number;
  delivered: number; unmet: number; inflow: number; wasted: number;
  supplied: string[];
}
export interface Gap { from: number; to: number; unmet: number; full: boolean }
export interface WaterSim {
  segs: WaterSeg[];
  T: number;
  qReq: number;
  firstShortfall: number | null;
  exhaustedAt: number | null;
  gaps: Gap[];
  totals: { delivered: number; unmet: number; inflow: number; wasted: number; endV: number; totalAvailable: number };
  supplies: Supply[];
}

export function simulateWater(inp: WaterSimInput): WaterSim {
  const T = Math.max(0, inp.demandMin);
  const qReq = Math.max(0, inp.qReq);
  const supplies = [...inp.supplies].sort((a, b) => a.tauReady - b.tauReady);
  const hy = inp.hydrant;
  const events = new Set<number>([0, T]);
  supplies.forEach((s) => s.tauReady > 0 && s.tauReady < T && events.add(s.tauReady));
  if (hy.enabled && hy.delayMin > 0 && hy.delayMin < T) events.add(hy.delayMin);
  const ev = [...events].sort((a, b) => a - b);

  let V = 0, cap = 0, reserve = 0, t = 0;
  const cum = { delivered: 0, unmet: 0, inflow: 0, wasted: 0 };
  const added = new Set<string>();
  const segs: WaterSeg[] = [];
  let guard = 0;

  while (t < T - EPS && guard++ < 10000) {
    for (const s of supplies) if (!added.has(s.id) && s.tauReady <= t + EPS) { added.add(s.id); V += s.vd; cap += s.vd; reserve += s.reserve; }
    const next = ev.find((e) => e > t + EPS) ?? T;
    const qIn = hy.enabled && t >= hy.delayMin - EPS ? Math.max(0, hy.qIn) : 0;
    let qOut: number, qAcc: number, qWaste = 0, end = next;
    if (V > EPS || qIn >= qReq) {
      qOut = qReq;
      const r = 60 * (qIn - qReq);
      if (r < -EPS) {
        qAcc = qIn;
        const tE = t + V / -r;
        if (tE < end - EPS) end = tE;
      } else if (r > EPS) {
        if (V >= cap - EPS) { qAcc = qReq; qWaste = qIn - qReq; }
        else { qAcc = qIn; const tF = t + (cap - V) / r; if (tF < end - EPS) end = tF; }
      } else qAcc = qIn;
    } else {
      // Қол жетімді қор бос, кіріс талаптан аз: нақты беру = кіріс
      qOut = qIn; qAcc = qIn;
    }
    const dt = end - t;
    const V1 = Math.min(cap, Math.max(0, V + 60 * (qAcc - qOut) * dt));
    segs.push({ t0: t, t1: end, V0: V, V1, cap, reserve, qReq, qOut, qIn, qAccepted: qAcc, qWasted: qWaste, cum0: { ...cum } });
    cum.delivered += 60 * qOut * dt;
    cum.unmet += 60 * Math.max(0, qReq - qOut) * dt;
    cum.inflow += 60 * qAcc * dt;
    cum.wasted += 60 * qWaste * dt;
    V = Math.abs(V1) < 1e-7 ? 0 : V1;
    t = end;
  }

  // Үзілістер мен алғашқы жетіспеушілік
  const gaps: Gap[] = [];
  let firstShortfall: number | null = null;
  let exhaustedAt: number | null = null;
  for (const s of segs) {
    if (exhaustedAt === null && s.V1 <= EPS && s.V0 > EPS && s.qOut > s.qAccepted) exhaustedAt = s.t1;
    if (qReq > 0 && s.qOut < s.qReq - 1e-9) {
      if (firstShortfall === null) firstShortfall = s.t0;
      const un = 60 * (s.qReq - s.qOut) * (s.t1 - s.t0);
      const last = gaps[gaps.length - 1];
      const full = s.qOut <= 1e-9;
      if (last && Math.abs(last.to - s.t0) < 1e-9 && last.full === full) { last.to = s.t1; last.unmet += un; }
      else gaps.push({ from: s.t0, to: s.t1, unmet: un, full });
    }
  }
  return {
    segs, T, qReq, firstShortfall, exhaustedAt, gaps,
    totals: { ...cum, endV: V, totalAvailable: supplies.reduce((a, s) => a + s.vd, 0) },
    supplies,
  };
}

export function waterStateAt(sim: WaterSim, tau: number): WaterState {
  const supplied = sim.supplies.filter((s) => s.tauReady <= tau + 1e-9).map((s) => s.id);
  if (sim.segs.length === 0 || tau < 0) {
    return { tau, V: 0, cap: 0, reserve: 0, qReq: tau < 0 ? 0 : sim.qReq, qOut: 0, qIn: 0, delivered: 0, unmet: 0, inflow: 0, wasted: 0, supplied: tau < 0 ? [] : supplied };
  }
  const last = sim.segs[sim.segs.length - 1];
  if (tau >= last.t1) {
    return { tau, V: last.V1, cap: last.cap, reserve: last.reserve, qReq: 0, qOut: 0, qIn: 0, ...sim.totals, supplied };
  }
  const s = sim.segs.find((x) => tau >= x.t0 - 1e-12 && tau < x.t1) ?? last;
  const dt = Math.max(0, tau - s.t0);
  const f = s.t1 > s.t0 ? dt / (s.t1 - s.t0) : 0;
  return {
    tau,
    V: s.V0 + (s.V1 - s.V0) * f,
    cap: s.cap, reserve: s.reserve,
    qReq: s.qReq, qOut: s.qOut, qIn: s.qIn,
    delivered: s.cum0.delivered + 60 * s.qOut * dt,
    unmet: s.cum0.unmet + 60 * Math.max(0, s.qReq - s.qOut) * dt,
    inflow: s.cum0.inflow + 60 * s.qAccepted * dt,
    wasted: s.cum0.wasted + 60 * s.qWasted * dt,
    supplied,
  };
}
