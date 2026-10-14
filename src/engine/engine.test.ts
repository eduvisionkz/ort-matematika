import { describe, it, expect } from 'vitest';
import { segmentTime, segmentVariants, routesTime, requiredIntensity } from './evacuation';
import {
  supplyDuration, waterDeficit, simulateWater, delayedRefillDuration, supplyGap, sensitivity, piecewise, availableVolume,
  gapVariants, waterStateAt, refillDuration,
} from './water';
import { personHours, staffDeficit } from './staff';
import { computeAll, snapshotAt } from './compute';
import { DEFAULT_PARAMS, PRESETS } from './types';
import { safeDiv } from './num';


describe('Эвакуация', () => {
  const base = DEFAULT_PARAMS.evac;
  it('тізбекті мысал → 140 с', () => expect(segmentTime(base).total).toBeCloseTo(140, 9));
  it('салыстыру нұсқалары', () => {
    const v = Object.fromEntries(segmentVariants(base).map((x) => [x.id, x.result.total]));
    expect(v.t0).toBeCloseTo(170); expect(v.v).toBeCloseTo(157.5); expect(v.q).toBeCloseTo(160); expect(v.N).toBeCloseTo(170);
  });
  it('нөлдік жылдамдық/өткізу қабілеті → өту мүмкін емес', () => {
    expect(segmentTime({ ...base, v1: 0 }).feasible).toBe(false);
    expect(segmentTime({ ...base, q: 0 }).total).toBe(Infinity);
  });
  const rp = DEFAULT_PARAMS.routes;
  it('екі маршрут 30/30 → 110 с', () => expect(routesTime(rp).total).toBeCloseTo(110));
  it('40/20 → 120 с', () => {
    const l = rp.list.map((r, i) => ({ ...r, share: i === 0 ? 40 : 20 }));
    expect(routesTime({ ...rp, list: l }).total).toBeCloseTo(120);
  });
  it('бір маршрут → 140 с, өсім ≈ 27,27 %', () => {
    const l = rp.list.map((r, i) => ({ ...r, enabled: i === 0 }));
    const r = routesTime({ ...rp, list: l });
    expect(r.total).toBeCloseTo(140);
    expect(routesTime(rp).increasePct!).toBeCloseTo(27.2727, 3);
  });
  it('R = N/T', () => {
    expect(requiredIntensity(450, 5, 5)).toEqual({ R: 90, perExit: 18 });
    expect(requiredIntensity(590, 5, 5).perExit).toBeCloseTo(23.6);
  });
});

describe('Келу уақыты', () => {
  it('700 м 2 мин → 21 км/сағ', () => expect(safeDiv(60 * 0.7, 2)).toBeCloseTo(21));
  it('су беру басы 5 мин, келу 3,5 мин', () => {
    const R = computeAll(DEFAULT_PARAMS);
    expect(R.trucks[0].arrival).toBeCloseTo(3.5);
    expect(R.ts).toBeCloseTo(5);
  });
});

describe('Су қоры', () => {
  it('4500 л, 10 л/с → 7,5 мин', () => expect(supplyDuration(4500, 10)).toBeCloseTo(7.5));
  it('5, 15 л/с', () => { expect(supplyDuration(4500, 5)).toBeCloseTo(15); expect(supplyDuration(4500, 15)).toBeCloseTo(5); });
  it('Q = 0 → null', () => expect(supplyDuration(4500, 0)).toBeNull());
  it('5400 / 14 → 6,43; 9900 / 14 → 11,79', () => {
    expect(supplyDuration(availableVolume(6000, 10), 14)!).toBeCloseTo(6.4286, 3);
    expect(supplyDuration(availableVolume(5000, 10), 14)!).toBeCloseTo(5.357, 2);
    expect(supplyDuration(9900, 14)!).toBeCloseTo(11.786, 2);
  });
  it('тапшылық', () => {
    expect(waterDeficit(4500, 5, 10).D).toBe(0);
    expect(waterDeficit(4500, 10, 10).D).toBe(1500);
    expect(waterDeficit(4500, 15, 10).D).toBe(4500);
    expect(waterDeficit(4500, 15, 10).Dpct).toBeCloseTo(50);
  });
  it('кешіктірілген толықтыру → 15 мин (формула және уақыт моделі)', () => {
    expect(delayedRefillDuration(5400, 14, 3, 10).total).toBeCloseTo(15);
    const sim = simulateWater({ supplies: [{ id: 'u', name: 'U', tauReady: 0, vd: 5400, reserve: 600 }], qReq: 14, demandMin: 20, hydrant: { enabled: true, delayMin: 3, qIn: 10 } });
    expect(sim.firstShortfall!).toBeCloseTo(15);
    expect(waterStateAt(sim, 3).V).toBeCloseTo(2880);
    expect(sim.totals.unmet).toBeCloseTo(1200);
  });
  it('10-кесте: бірден толықтыру 5 → 10, 10 → 22,5 мин; 9-кесте толық қор 5,95 / 7,14 / 13,10', () => {
    expect(refillDuration(5400, 14, 5)!).toBeCloseTo(10);
    expect(refillDuration(5400, 14, 10)!).toBeCloseTo(22.5);
    expect(refillDuration(5400, 14, 14)).toBeNull();
    expect(supplyDuration(5000, 14)!).toBeCloseTo(5.952, 2);
    expect(supplyDuration(6000, 14)!).toBeCloseTo(7.143, 2);
    expect(supplyDuration(11000, 14)!).toBeCloseTo(13.095, 2);
    expect(waterDeficit(4500, 14, 10).D).toBe(3900);
    expect(supplyDuration(5000 * 0.8, 10)!).toBeCloseTo(6.667, 2);
  });
  it('толықтыру сыйымдылықтан аспайды', () => {
    const sim = simulateWater({ supplies: [{ id: 'u', name: 'U', tauReady: 0, vd: 1000, reserve: 0 }], qReq: 5, demandMin: 10, hydrant: { enabled: true, delayMin: 1, qIn: 20 } });
    expect(Math.max(...sim.segs.map((s) => s.V1))).toBeLessThanOrEqual(1000 + 1e-9);
    expect(sim.firstShortfall).toBeNull();
  });
  it('бос қор + аз кіріс → нақты беру = кіріс', () => {
    const sim = simulateWater({ supplies: [{ id: 'u', name: 'U', tauReady: 0, vd: 600, reserve: 0 }], qReq: 10, demandMin: 5, hydrant: { enabled: true, delayMin: 0, qIn: 4 } });
    const st = waterStateAt(sim, 4.9);
    expect(st.qOut).toBeCloseTo(4); expect(st.qReq).toBeCloseTo(10);
  });
  it('үзіліс: 9-минутта → 1,5 мин, 900 л', () => {
    expect(supplyGap(9, 7.5, 10)).toEqual({ G: 1.5, unsupplied: 900 });
    const g = gapVariants(4500, 10, [6, 7.5, 9, 12], 5400);
    expect(g.map((x) => x.G)).toEqual([0, 0, 1.5, 4.5]);
    expect(g[2].simUnmet).toBeCloseTo(900);
    const R = computeAll(PRESETS.find((p) => p.id === 'gap')!.apply(structuredClone(DEFAULT_PARAMS)));
    expect(R.water!.gaps[0].from).toBeCloseTo(7.5); expect(R.water!.gaps[0].to).toBeCloseTo(9);
    expect(R.water!.totals.unmet).toBeCloseTo(900);
  });
  it('туынды және сызықтық жуықтау', () => {
    const s = sensitivity(4500, 10, 11);
    expect(s.d).toBeCloseTo(-0.75); expect(s.T1!).toBeCloseTo(6.818, 2); expect(s.linear!).toBeCloseTo(6.75);
  });
  it('кесінді-тұрақты шығын → 3300 л, 1200 л, 9 мин', () => {
    const r = piecewise(4500, [{ durMin: 3, q: 5 }, { durMin: 4, q: 10 }]);
    expect(r.used).toBeCloseTo(3300); expect(r.left).toBeCloseTo(1200); expect(r.extra!).toBeCloseTo(2); expect(r.total!).toBeCloseTo(9);
  });
});

describe('Жеке құрам және адам-сағат', () => {
  it('тапшылық 7−3=4, 7−6=1, 7−7=0', () => {
    expect([3, 6, 7].map((a) => staffDeficit(7, a))).toEqual([4, 1, 0]);
  });
  it('20 мин × 3 + 40 мин × 6 → 5 адам-сағат', () => {
    const h = personHours(DEFAULT_PARAMS.staff);
    expect(h.H).toBeCloseTo(5); expect(h.avg!).toBeCloseTo(5); expect(h.max).toBe(6);
  });
});

describe('Біріккен сценарий', () => {
  const R = computeAll(PRESETS.find((p) => p.id === 'combined')!.apply(structuredClone(DEFAULT_PARAMS)));
  it('қор τ = 15 мин (t = 20) таусылады, 1200 л қосымша қажет, тапшылық 4 адам', () => {
    expect(R.ts).toBeCloseTo(5);
    expect(R.water!.firstShortfall!).toBeCloseTo(15);
    expect(R.ts! + R.water!.firstShortfall!).toBeCloseTo(20);
    expect(R.ts! + R.params.water.demandMin).toBeCloseTo(25);
    expect(R.water!.totals.unmet).toBeCloseTo(1200);
    expect(R.staff.initialDeficit).toBe(4);
  });
  it('кері айналдыру детерминирленген', () => {
    const a = snapshotAt(R, 17.3); snapshotAt(R, 3); const b = snapshotAt(R, 17.3);
    expect(a).toEqual(b);
  });
});
