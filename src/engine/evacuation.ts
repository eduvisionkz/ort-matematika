// Эвакуация: тізбекті (кезеңдер қосылатын) оқу моделі және бірнеше тәуелсіз маршрут.
import { Params } from './types';
import { safeDiv, pct } from './num';

export interface SegmentInput { L1: number; L2: number; v1: number; v2: number; t0: number; N: number; q: number }

export interface SegmentResult {
  feasible: boolean;
  reason: string | null;
  /** Кезеңдер, с: [кідіріс, дәліз, баспалдақ, тар учаскеден өту] */
  t0: number;
  tCorr: number | null;
  tStair: number | null;
  tPass: number | null;
  /** Жалпы уақыт, с; мүмкін болмаса Infinity */
  total: number;
  /** Кезең шекаралары (жалпы шкала бойынша, с) */
  bounds: [number, number, number, number];
}

/** t = t₀ + L₁/v₁ + L₂/v₂ + N/q */
export function segmentTime(e: SegmentInput): SegmentResult {
  const tCorr = e.L1 === 0 ? 0 : safeDiv(e.L1, e.v1);
  const tStair = e.L2 === 0 ? 0 : safeDiv(e.L2, e.v2);
  const tPass = e.N === 0 ? 0 : safeDiv(e.N, e.q);
  const reasons: string[] = [];
  if (tCorr === null) reasons.push('дәліздегі жылдамдық v₁ = 0');
  if (tStair === null) reasons.push('баспалдақтағы жылдамдық v₂ = 0');
  if (tPass === null) reasons.push('өткізу қабілеті q = 0');
  const feasible = reasons.length === 0;
  const total = feasible ? e.t0 + tCorr! + tStair! + tPass! : Infinity;
  const b1 = e.t0;
  const b2 = tCorr === null ? Infinity : b1 + tCorr;
  const b3 = tStair === null ? Infinity : b2 + tStair;
  return {
    feasible,
    reason: feasible ? null : `Таңдалған модельде өту мүмкін емес: ${reasons.join('; ')}`,
    t0: e.t0, tCorr, tStair, tPass, total,
    bounds: [b1, b2, b3, total],
  };
}

export interface EvacVariant { id: string; label: string; changed: string; input: SegmentInput; result: SegmentResult; diff: number | null; diffPct: number | null }

/** Әр нұсқада бастапқы нұсқадан тек бір параметр өзгереді. */
export function segmentVariants(base: SegmentInput): EvacVariant[] {
  const b = segmentTime(base);
  const mk = (id: string, label: string, changed: string, patch: Partial<SegmentInput>): EvacVariant => {
    const input = { ...base, ...patch };
    const result = segmentTime(input);
    const diff = b.feasible && result.feasible ? result.total - b.total : null;
    return { id, label, changed, input, result, diff, diffPct: diff === null ? null : pct(diff, b.total) };
  };
  return [
    mk('base', 'Бастапқы нұсқа', '—', {}),
    mk('t0', 'Кідіріс 60 с', 't₀: 30 → 60 с', { t0: 60 }),
    mk('v', 'Жылдамдық 0,8 және 0,4 м/с', 'v₁ = 0,8; v₂ = 0,4 м/с', { v1: 0.8, v2: 0.4 }),
    mk('q', 'Өткізу қабілеті 0,75 адам/с', 'q: 1 → 0,75 адам/с', { q: 0.75 }),
    mk('N', 'Топ 90 адам', 'N: 60 → 90 адам', { N: 90 }),
  ];
}

export interface RouteRes {
  id: string; name: string; enabled: boolean; people: number; t0: number; travel: number; q: number;
  tPass: number | null; total: number; feasible: boolean;
}
export interface RoutesResult {
  routes: RouteRes[];
  total: number; feasible: boolean; reason: string | null; mode: 'independent' | 'common';
  /** Бір маршрутпен салыстыру (барлық адам бір маршрутта) */
  singleRouteTotal: number;
  increasePct: number | null;
}

/** Адамдарды қосылған маршруттарға үлес бойынша бөлу (бүтін сандармен, қосындысы N). */
export function distribute(N: number, shares: number[], enabled: boolean[]): number[] {
  const w = shares.map((s, i) => (enabled[i] ? Math.max(0, s) : 0));
  let sum = w.reduce((a, b) => a + b, 0);
  const act = enabled.map((e) => e);
  if (sum <= 0) {
    // Үлес көрсетілмесе — қосылған маршруттарға тең бөлу
    const k = act.filter(Boolean).length;
    if (k === 0) return shares.map(() => 0);
    w.forEach((_, i) => (w[i] = act[i] ? 1 : 0));
    sum = k;
  }
  const raw = w.map((x) => (N * x) / sum);
  const out = raw.map(Math.floor);
  let rest = N - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; if (w[i] > 0) { out[i]++; rest--; } }
  return out;
}

/** tобщ = max(t₁, t₂, …), tᵢ = t₀ᵢ + қозғалысᵢ + Nᵢ/qᵢ. Ортақ тар учаске болса: max(t₀ᵢ + қозғалысᵢ) + N/qортақ. */
export function routesTime(p: Params['routes']): RoutesResult {
  const enabled = p.list.map((r) => r.enabled);
  const people = distribute(p.N, p.list.map((r) => r.share), enabled);
  const routes: RouteRes[] = p.list.map((r, i) => {
    const n = people[i];
    const tPass = n === 0 ? 0 : safeDiv(n, r.q);
    const feasible = r.enabled ? tPass !== null : true;
    const total = !r.enabled || n === 0 ? (r.enabled ? r.t0 + r.travel : 0) : feasible ? r.t0 + r.travel + tPass! : Infinity;
    return { id: r.id, name: r.name, enabled: r.enabled, people: n, t0: r.t0, travel: r.travel, q: r.q, tPass, total, feasible };
  });
  const active = routes.filter((r) => r.enabled && r.people > 0);
  let total: number; let feasible: boolean; let reason: string | null = null;
  if (p.N > 0 && active.length === 0) {
    total = Infinity; feasible = false; reason = 'Қолжетімді маршрут жоқ — таңдалған модельде шығу мүмкін емес';
  } else if (p.commonBottleneck) {
    const pass = p.N === 0 ? 0 : safeDiv(p.N, p.qCommon);
    feasible = pass !== null;
    total = feasible ? Math.max(0, ...active.map((r) => r.t0 + r.travel)) + pass! : Infinity;
    if (!feasible) reason = 'Ортақ тар учаскенің өткізу қабілеті 0 — өту мүмкін емес';
  } else {
    feasible = active.every((r) => r.feasible);
    total = feasible ? Math.max(0, ...active.map((r) => r.total)) : Infinity;
    if (!feasible) reason = 'Кемінде бір қосылған маршруттың өткізу қабілеті 0 — өту мүмкін емес';
  }
  // Барлық адам бір (бірінші қосылған) маршрутпен шыққандағы уақыт
  const ref = p.list.find((r) => r.enabled) ?? p.list[0];
  const sp = p.N === 0 ? 0 : safeDiv(p.N, ref.q);
  const singleRouteTotal = sp === null ? Infinity : ref.t0 + ref.travel + sp;
  const increasePct = Number.isFinite(total) && Number.isFinite(singleRouteTotal) ? pct(singleRouteTotal - total, total) : null;
  return { routes, total, feasible, reason, mode: p.commonBottleneck ? 'common' : 'independent', singleRouteTotal, increasePct };
}

/** Құжаттағы нұсқалар үшін талап етілетін орташа қарқын R = N/T. */
export function requiredIntensity(people: number, Tmin: number, exits: number) {
  const R = safeDiv(people, Tmin);
  const perExit = R === null ? null : safeDiv(R, exits);
  return { R, perExit };
}
