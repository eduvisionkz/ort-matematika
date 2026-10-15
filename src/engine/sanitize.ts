// Енгізілген мәндерді тексеру: теріс, бос, мәтін немесе шектен тыс мәндер бастапқы мәнге не шекке ауысады.
import { DEFAULT_PARAMS, Params } from './types';
import { safeNum, clone } from './num';

type Lim = [min: number, max: number, integer?: boolean];
const LIMITS: { [G in keyof Params]?: { [K in keyof Params[G]]?: Lim } } = {
  room: { a: [0.5, 60], b: [0.5, 60] },
  spread: { u: [0, 5], t: [0, 120] },
  arrival: { L: [0, 50000], travel: [0, 120], gather: [0, 60], prep: [0, 60], delay: [0, 60], delay2: [0, 60] },
  evac2: { N: [0, 2000, true], Lc: [0, 500], vc: [0, 5], Ls: [0, 200], vs: [0, 5], t0: [0, 3600], q: [0, 20] },
  school: { N: [0, 3000, true], N1: [0, 3000, true], t0: [0, 3600], Lc: [0, 500], vc: [0, 5], Ls: [0, 200], vs: [0, 5], q1: [0, 20], q2: [0, 20], Tgoal: [0, 7200] },
  flow: { I: [0, 2], qN: [0, 50], tFire: [0, 120] },
  water: { V5: [0, 50000], V6: [0, 50000], Q: [0, 200], tWork: [0, 600] },
  refill: { V0: [0, 50000], qOut: [0, 200], qIn: [0, 200], delay: [0, 600] },
  staff: { k: [0, 20, true], n: [0, 20, true], d: [0, 10, true], c: [0, 10, true], avail: [0, 100, true] },
};

export function sanitize(raw: unknown): { params: Params; warnings: string[] } {
  const warnings: string[] = [];
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const p = clone(DEFAULT_PARAMS);
  if (src.version !== 2) { if (raw && Object.keys(src).length) warnings.push('Ескі нұсқадағы сценарий: бастапқы мәндер қолданылды.'); return { params: p, warnings }; }
  p.name = typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, 80) : p.name;
  for (const g of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const lim = LIMITS[g] as Record<string, Lim>; const tgt = p[g] as Record<string, any>; const s = (src[g] ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(lim)) {
      const [mn, mx, int] = lim[k]; const def = tgt[k] as number;
      let v = safeNum(s[k], def, mn, mx);
      if (int) v = Math.round(v);
      if (s[k] !== undefined && v !== Number(String(s[k]).replace(',', '.'))) warnings.push(`${g}.${k}: мән ${v} болып түзетілді`);
      tgt[k] = v;
    }
  }
  p.evac2.two = typeof src.evac2?.two === 'boolean' ? src.evac2.two : p.evac2.two;
  p.school.equal = typeof src.school?.equal === 'boolean' ? src.school.equal : p.school.equal;
  if (p.school.N1 > p.school.N) p.school.N1 = p.school.N;
  p.water.use = ['ac5', 'ac6', 'both'].includes(src.water?.use) ? src.water.use : p.water.use;
  p.water.order = ['seq', 'par'].includes(src.water?.order) ? src.water.order : p.water.order;
  return { params: p, warnings };
}
