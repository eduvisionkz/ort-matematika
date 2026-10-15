import { describe, it, expect } from 'vitest';
import { computeAll, snapshotAt, tanksAt } from './compute';
import { DEFAULT_PARAMS, PRESETS } from './types';
import { refill, refillLevel, flowNeed, routeTime, spreadAt } from './calc';
import { sanitize } from './sanitize';
import { fmt } from './num';

const R = computeAll(DEFAULT_PARAMS);
const T = R.tasks;
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

describe('бөлме және өрттің таралуы', () => {
  it('S = 8 × 6 = 48 м²', () => expect(T.area.S).toBe(48));
  it('тексеру мәндері 2…10 мин', () => {
    expect(T.spread.table.map((p) => [r2(p.r), r2(p.S)])).toEqual([[0.6, 1.13], [1.2, 4.52], [1.8, 10.17], [2.4, 18.09], [3, 28.26]]);
  });
  it('шеңберлік есеп 10 минутқа дейін (r = 3 м)', () => { expect(T.spread.rMax).toBe(3); expect(r2(T.spread.tLim)).toBe(10); });
  it('11-минутта шеңбер қабырғадан өтпейді (3D)', () => {
    const s = snapshotAt(R, 'fire', 11 * 60).fire!;
    expect(s.r).toBeCloseTo(3); expect(s.limited).toBe(true);
  });
});

describe('келу уақыты', () => {
  it('v = 0,7 / 0,05 = 14 км/сағ', () => { expect(T.arrival.Lkm).toBe(0.7); expect(T.arrival.th).toBeCloseTo(0.05); expect(T.arrival.v).toBeCloseTo(14); });
  it('қоңыраудан су беруге дейін 5 мин', () => expect(T.arrival.callToWater).toBe(5));
  it('қоңырау 1 мин → 6-мин, 10,17 м²; 2 мин → 7-мин, 13,85 м²', () => {
    expect(T.arrival.cases.map((c) => [c.start, r2(c.S)])).toEqual([[6, 10.17], [7, 13.85]]);
  });
  it('машина: 2-минутта шығады, 5-те келеді, 6-да су береді', () => {
    expect(snapshotAt(R, 'fire', 119).truck!.phase).toBe('gather');
    expect(snapshotAt(R, 'fire', 121).truck!.phase).toBe('driving');
    expect(snapshotAt(R, 'fire', 301).truck!.phase).toBe('prep');
    expect(snapshotAt(R, 'fire', 361).truck!.phase).toBe('water');
  });
});

describe('эвакуация', () => {
  it('2-қабат: tжол = 50 с, T = 140 с; екі бағыт 110 с', () => {
    expect(T.evac2.one.tWalk).toBeCloseTo(50); expect(T.evac2.one.T).toBeCloseTo(140); expect(T.evac2.two.T).toBeCloseTo(110);
  });
  it('450 адам: 225 + 225, 325 с; 590 адам: 395 с', () => {
    expect(T.school.walk).toBeCloseTo(70);
    expect(T.school.T).toBeCloseTo(325);
    expect(T.school.compare.map((c) => [c.N, c.per[0], r2(c.T)])).toEqual([[450, 225, 325], [590, 295, 395]]);
  });
  it('300 / 150: 400 с және 250 с, тең бөлуден 75 с ұзақ', () => {
    const t = computeAll(PRESETS.find((p) => p.id === 'split')!.apply(structuredClone(DEFAULT_PARAMS))).tasks.school;
    expect(t.dirs.map((d) => r2(d.T))).toEqual([400, 250]); expect(t.T).toBeCloseTo(400); expect(t.diffVsEqual).toBeCloseTo(75);
  });
  it('5 минутқа қажет қарқын: 1,125 және 1,475 адам/с', () => {
    expect(T.school.compare.map((c) => r2(c.needQ[0]))).toEqual([1.13, 1.48]);
    expect(T.school.compare[0].needQ[0]).toBeCloseTo(1.125); expect(T.school.compare[1].needQ[0]).toBeCloseTo(1.475);
  });
  it('3D: 100 с кейін есіктен өту басталады, 325 с — бәрі шықты', () => {
    const a = snapshotAt(R, 'evacAll', 150); expect(a.groups[0].exited).toBe(50); expect(a.groups[0].queue).toBe(175);
    const b = snapshotAt(R, 'evacAll', 325); expect(b.groups.every((g) => g.phase === 'done')).toBe(true);
  });
  it('нөлдік жылдамдық пен қарқын — нәтиже жоқ, қате сан шықпайды', () => {
    expect(routeTime(60, 30, 30, 0, 12, 0.6, 1).T).toBeNull();
    expect(routeTime(60, 30, 30, 1, 12, 0.6, 0).T).toBeNull();
    expect(routeTime(0, 30, 30, 1, 12, 0.6, 0).T).toBe(80);
  });
});

describe('су шығыны және қор', () => {
  it('28,26 м²: 2,826 л/с, 1 ствол, 3,5 л/с; 48 м²: 4,8 л/с, 2 ствол, 7 л/с', () => {
    expect([r2(T.flow.fire.S), T.flow.fire.Qreq.toFixed(3), T.flow.fire.n, T.flow.fire.Qact]).toEqual([28.26, '2.826', 1, 3.5]);
    expect([r2(T.flow.room.Qreq), T.flow.room.n, T.flow.room.Qact]).toEqual([4.8, 2, 7]);
  });
  it('ствол шығыны 0 болса — n анықталмайды', () => expect(flowNeed(0.1, 48, 0).n).toBeNull());
  it('T = V/(60Q) кестесі', () => {
    expect(T.water.table.map((r) => r.T.map((x) => fmt(x, 2)))).toEqual([['23,81', '11,9', '5,95'], ['28,57', '14,29', '7,14'], ['52,38', '26,19', '13,1']]);
  });
  it('7 л/с, 15 мин: 6300 л; айырма −1300, −300, +4700', () => {
    expect(T.water.Vreq).toBe(6300); expect(T.water.diffs.map((d) => d.diff)).toEqual([-1300, -300, 4700]);
  });
  it('екі машина кезекпен және қатар — жалпы уақыт бірдей', () => {
    const p = { ...structuredClone(DEFAULT_PARAMS), water: { ...DEFAULT_PARAMS.water, use: 'both' as const } };
    const end = 11000 / 420;
    expect(tanksAt(p, end).ac5.V + tanksAt(p, end).ac6.V).toBeCloseTo(0);
    expect(tanksAt(p, 5).ac5.V).toBeCloseTo(5000 - 2100); expect(tanksAt(p, 5).ac6.V).toBe(6000);
    const q = { ...p, water: { ...p.water, order: 'par' as const } };
    expect(tanksAt(q, 5).ac5.V).toBeCloseTo(5000 - 1050); expect(tanksAt(q, end).ac6.V).toBeCloseTo(0);
  });
  it('Q = 0 — уақыт анықталмайды', () => expect(computeAll({ ...DEFAULT_PARAMS, water: { ...DEFAULT_PARAMS.water, Q: 0 } }).tasks.water.T).toBeNull());
});

describe('толықтыру', () => {
  it('бірден: 41,67 мин; 5 мин кейін: 2100 л, 2900 л, 24,17 + 5 = 29,17 мин', () => {
    const r = T.refill;
    expect(r2(r.immediate.T)).toBe(41.67);
    expect([r.delayed.used, r.delayed.left, r2(r.delayed.tAfter), r2(r.delayed.total)]).toEqual([2100, 2900, 24.17, 29.17]);
  });
  it('кіріс ≥ шығыс: су азаймайды, нөлге бөлу жоқ', () => {
    const r = refill(5000, 7, 7, 5); expect(r.immediate.steady).toBe(true); expect(r.immediate.T).toBeNull(); expect(r.delayed.total).toBeNull();
    const r9 = refill(5000, 7, 9, 0); expect(r9.immediate.T).toBeNull();
  });
  it('толықтырудан бұрын таусылса — үзіліс', () => {
    const r = refill(1000, 7, 5, 5); expect(r.delayed.emptyAt).toBeCloseTo(1000 / 420); expect(r.delayed.gap).toBeCloseTo(5 - 1000 / 420);
    expect(refillLevel(1000, 7, 5, 5, 4).V).toBe(0); expect(refillLevel(1000, 7, 5, 5, 4).out).toBe(0); expect(refillLevel(1000, 7, 5, 5, 6).out).toBe(5);
  });
  it('3D деңгейі: 5-минутта 2900 л', () => expect(refillLevel(5000, 7, 5, 5, 5).V).toBeCloseTo(2900));
});

describe('қызметкерлер', () => {
  it('P = 4, 6, 7; 7 − 3 = 4', () => {
    expect(T.staff.examples.map((e) => e.P)).toEqual([4, 6, 7]); expect(T.staff.P).toBe(7); expect(T.staff.deficit).toBe(4);
  });
});

describe('енгізуді тексеру', () => {
  it('теріс және мәтін мәндер түзетіледі', () => {
    const s = sanitize({ ...DEFAULT_PARAMS, room: { a: -5, b: 'abc' }, water: { ...DEFAULT_PARAMS.water, Q: -3 } }).params;
    expect(s.room.a).toBe(0.5); expect(s.room.b).toBe(6); expect(s.water.Q).toBe(0);
  });
  it('7-минуттағы аудан: 3,14 × 2,1² = 13,8474 м²', () => expect(spreadAt(0.3, 7, 3).S).toBeCloseTo(13.8474));
});
