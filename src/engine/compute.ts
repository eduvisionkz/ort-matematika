// Бірыңғай есептеу модулі: 3D, графиктер, кестелер және есеп осыдан алады.
import { Params, TruckParams } from './types';
import { sanitize } from './sanitize';
import { segmentTime, segmentVariants, routesTime, requiredIntensity, SegmentResult, RoutesResult, EvacVariant } from './evacuation';
import {
  availableVolume, reserveVolume, simulateWater, waterStateAt, WaterSim, WaterState, supplyDuration, waterDeficit,
  requiredVolume, Supply,
} from './water';
import { staffTimeline, personHours, availableAt, requiredAt, assignment, staffDeficit } from './staff';
import { safeDiv } from './num';

export interface TruckTiming {
  id: string; name: string; participates: boolean;
  depart: number; arrival: number; ready: number;
  v0: number; vd: number; reserve: number; flow: number;
  tauReady: number | null;
}

export interface Results {
  params: Params;
  warnings: string[];
  evac: SegmentResult;
  evacVariants: EvacVariant[];
  routes: RoutesResult;
  intensity: { R: number | null; perExit: number | null; doc: { people: number; R: number | null; perExit: number | null }[] };
  response: { phases: { id: string; name: string; from: number; to: number }[]; supplyStartFirst: number; speed: number | null; speedTable: { t: number; v: number | null }[] };
  trucks: TruckTiming[];
  ts: number | null;
  tFirstArrival: number;
  water: WaterSim | null;
  waterSummary: {
    qReq: number; vdTotal: number; reserveTotal: number;
    durationAllStock: number | null;
    supported: number | null;
    req: number; deficitSimple: number; deficitPct: number | null; leftover: number;
  };
  staff: ReturnType<typeof personHours> & { initialReq: number; initialAvail: number; initialDeficit: number; control: { avail: number; deficit: number }[] };
  tEnd: number;
}

function truckTiming(p: Params, t: TruckParams): Omit<TruckTiming, 'tauReady'> {
  const r = p.response;
  const depart = r.msg + r.gather + t.extraDelayMin;
  const arrival = depart + r.travel;
  return {
    id: t.id, name: t.name, participates: t.participates,
    depart, arrival, ready: arrival + t.deployMin,
    v0: t.v0, vd: availableVolume(t.v0, t.reservePct), reserve: reserveVolume(t.v0, t.reservePct), flow: t.flowLps,
  };
}

export function computeAll(raw: unknown): Results {
  const { params: p, warnings } = sanitize(raw);
  const evac = segmentTime(p.evac);
  const evacVariants = segmentVariants(p.evac);
  const routes = routesTime(p.routes);
  const it = requiredIntensity(p.intensity.people, p.intensity.T, p.intensity.exits);
  const doc = [450, 590].map((n) => ({ people: n, ...requiredIntensity(n, p.intensity.T, p.intensity.exits) }));

  const r = p.response;
  const lead = p.trucks.find((t) => t.participates) ?? p.trucks[0];
  const phases = [
    { id: 'msg', name: 'Хабарлау', from: 0, to: r.msg },
    { id: 'gather', name: 'Жиналу', from: r.msg, to: r.msg + r.gather },
    { id: 'travel', name: 'Жол жүру', from: r.msg + r.gather, to: r.msg + r.gather + r.travel },
    { id: 'deploy', name: 'Су беруге дайындық', from: r.msg + r.gather + r.travel, to: r.msg + r.gather + r.travel + lead.deployMin },
  ];
  const speed = safeDiv(60 * r.distanceKm, r.travel);
  const speedTable = [1, 2, 3].map((t) => ({ t, v: safeDiv(60 * r.distanceKm, t) }));

  const tt = p.trucks.map((t) => truckTiming(p, t));
  const part = tt.filter((t) => t.participates);
  const ts = part.length ? Math.min(...part.map((t) => t.ready)) : null;
  const trucks: TruckTiming[] = tt.map((t) => ({ ...t, tauReady: t.participates && ts !== null ? t.ready - ts : null }));
  const tFirstArrival = part.length ? Math.min(...part.map((t) => t.arrival)) : Math.min(...tt.map((t) => t.arrival));
  if (!part.length) warnings.push('Сценарийге бірде-бір машина қатыспайды — су беру есептелмейді.');

  const qReq = part.reduce((a, t) => a + t.flow, 0);
  let water: WaterSim | null = null;
  if (ts !== null) {
    const supplies: Supply[] = trucks.filter((t) => t.participates).map((t) => ({ id: t.id, name: t.name, tauReady: t.tauReady!, vd: t.vd, reserve: t.reserve }));
    water = simulateWater({ supplies, qReq, demandMin: p.water.demandMin, hydrant: p.water.hydrant });
  }
  const vdTotal = part.reduce((a, t) => a + t.vd, 0);
  const reserveTotal = part.reduce((a, t) => a + t.reserve, 0);
  const wd = waterDeficit(vdTotal, qReq, p.water.demandMin);
  const supported = water ? (qReq <= 0 ? null : water.firstShortfall ?? water.T) : null;

  const ph = personHours(p.staff);
  const initialReq = requiredAt(p.staff.tasks, 0);
  const initialAvail = availableAt(p.staff, 0);
  const staff = {
    ...ph, initialReq, initialAvail, initialDeficit: staffDeficit(initialReq, initialAvail),
    control: [3, 6, 7].map((a) => ({ avail: a, deficit: staffDeficit(initialReq, a) })),
  };
  if (ph.cappedByTotal) warnings.push(`Келген адамдар саны (${ph.requested}) жалпы штаттан (${p.staff.total}) асады — жалпы штатпен шектелді.`);

  const ends = [5];
  if (Number.isFinite(evac.total)) ends.push(evac.total / 60);
  if (Number.isFinite(routes.total)) ends.push(routes.total / 60);
  part.forEach((t) => ends.push(t.ready));
  if (ts !== null) ends.push(ts + p.water.demandMin);
  const tEnd = Math.min(240, Math.ceil(Math.max(...ends) + 1));

  return {
    params: p, warnings, evac, evacVariants, routes,
    intensity: { R: it.R, perExit: it.perExit, doc },
    response: { phases, supplyStartFirst: phases[3].to, speed, speedTable },
    trucks, ts, tFirstArrival, water,
    waterSummary: {
      qReq, vdTotal, reserveTotal,
      durationAllStock: supplyDuration(vdTotal, qReq),
      supported,
      req: requiredVolume(qReq, p.water.demandMin), deficitSimple: wd.D, deficitPct: wd.Dpct, leftover: wd.leftover,
    },
    staff, tEnd,
  };
}

// ---------------- Уақыт сәтіндегі күй (кері айналдыру үшін детерминирленген) ----------------

export type EvacPhase = 'wait' | 'corridor' | 'stairs' | 'exit' | 'done' | 'blocked';
export interface Snapshot {
  t: number;
  tau: number | null;
  theta: number;
  evac: { phase: EvacPhase; frac: number; exited: number; N: number; sec: number };
  routes: { id: string; phase: EvacPhase; frac: number; exited: number; people: number }[];
  trucks: { id: string; participates: boolean; phase: 'station' | 'gather' | 'driving' | 'deploying' | 'ready'; frac: number }[];
  water: WaterState | null;
  staff: { avail: number; req: number; deficit: number; rows: ReturnType<typeof assignment>['rows']; idle: number };
}

function evacAt(sec: number, t0: number, tMove: number | null, tStair: number | null, N: number, q: number, feasible: boolean) {
  if (sec < t0) return { phase: 'wait' as EvacPhase, frac: t0 > 0 ? sec / t0 : 1, exited: 0 };
  if (tMove === null) return { phase: 'blocked' as EvacPhase, frac: 0, exited: 0 };
  const a = t0 + tMove;
  if (sec < a) return { phase: 'corridor' as EvacPhase, frac: tMove > 0 ? (sec - t0) / tMove : 1, exited: 0 };
  if (tStair === null) return { phase: 'blocked' as EvacPhase, frac: 1, exited: 0 };
  const b = a + tStair;
  if (sec < b) return { phase: 'stairs' as EvacPhase, frac: tStair > 0 ? (sec - a) / tStair : 1, exited: 0 };
  if (!feasible || q <= 0) return N === 0 ? { phase: 'done' as EvacPhase, frac: 1, exited: 0 } : { phase: 'blocked' as EvacPhase, frac: 1, exited: 0 };
  const exited = Math.min(N, Math.floor(q * (sec - b) + 1e-9));
  if (exited >= N) return { phase: 'done' as EvacPhase, frac: 1, exited: N };
  return { phase: 'exit' as EvacPhase, frac: N > 0 ? exited / N : 1, exited };
}

export function snapshotAt(R: Results, t: number): Snapshot {
  const p = R.params;
  const sec = t * 60;
  const e = R.evac;
  const ev = evacAt(sec, p.evac.t0, e.tCorr, e.tStair, p.evac.N, p.evac.q, e.feasible);
  const routes = R.routes.routes.map((r) => {
    if (!r.enabled) return { id: r.id, phase: 'blocked' as EvacPhase, frac: 0, exited: 0, people: 0 };
    let x;
    if (R.routes.mode === 'common') {
      const start = Math.max(0, ...R.routes.routes.filter((z) => z.enabled && z.people > 0).map((z) => z.t0 + z.travel));
      const qc = p.routes.qCommon;
      if (sec < r.t0) x = { phase: 'wait' as EvacPhase, frac: r.t0 > 0 ? sec / r.t0 : 1, exited: 0 };
      else if (sec < r.t0 + r.travel) x = { phase: 'corridor' as EvacPhase, frac: r.travel > 0 ? (sec - r.t0) / r.travel : 1, exited: 0 };
      else if (sec < start || qc <= 0) x = { phase: (qc <= 0 && r.people > 0 ? 'blocked' : 'stairs') as EvacPhase, frac: 1, exited: 0 };
      else {
        const all = Math.min(p.routes.N, Math.floor(qc * (sec - start) + 1e-9));
        const ex = p.routes.N > 0 ? Math.min(r.people, Math.floor((all * r.people) / p.routes.N)) : 0;
        x = { phase: (ex >= r.people ? 'done' : 'exit') as EvacPhase, frac: r.people ? ex / r.people : 1, exited: ex };
      }
    } else {
      x = evacAt(sec, r.t0, r.travel, 0, r.people, r.q, r.feasible);
    }
    return { id: r.id, ...x, people: r.people };
  });

  const trucks = R.trucks.map((tr) => {
    const gatherStart = p.response.msg;
    let phase: Snapshot['trucks'][0]['phase'] = 'station'; let frac = 0;
    if (!tr.participates) phase = 'station';
    else if (t < gatherStart) { phase = 'station'; frac = 0; }
    else if (t < tr.depart) { phase = 'gather'; frac = (t - gatherStart) / Math.max(1e-9, tr.depart - gatherStart); }
    else if (t < tr.arrival) { phase = 'driving'; frac = (t - tr.depart) / Math.max(1e-9, tr.arrival - tr.depart); }
    else if (t < tr.ready) { phase = 'deploying'; frac = (t - tr.arrival) / Math.max(1e-9, tr.ready - tr.arrival); }
    else { phase = 'ready'; frac = 1; }
    return { id: tr.id, participates: tr.participates, phase, frac };
  });

  const tau = R.ts === null ? null : t - R.ts;
  const water = R.water && tau !== null ? waterStateAt(R.water, tau) : null;
  const theta = t - R.tFirstArrival;
  const avail = availableAt(p.staff, theta);
  const req = requiredAt(p.staff.tasks, theta);
  const as = assignment(p.staff.tasks, avail, theta);
  return {
    t, tau, theta,
    evac: { ...ev, N: p.evac.N, sec },
    routes, trucks, water,
    staff: { avail, req, deficit: staffDeficit(req, avail), rows: as.rows, idle: as.idle },
  };
}

export { staffTimeline };
