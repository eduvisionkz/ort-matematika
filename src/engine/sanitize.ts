import { DEFAULT_PARAMS, Params } from './types';
import { safeNum, clone } from './num';

/**
 * Кез келген (импортталған/өңделген) объектіні дұрыс Params түріне келтіру.
 * Жарамсыз сандар бастапқы мәнге ауыстырылады, теріс көлем/сан нөлге қысылады.
 */
export function sanitize(raw: unknown): { params: Params; warnings: string[] } {
  const w: string[] = [];
  const d = clone(DEFAULT_PARAMS);
  const r: any = raw && typeof raw === 'object' ? raw : {};
  const n = (v: unknown, def: number, min: number, max: number, label: string) => {
    const out = safeNum(v, def, min, max);
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v !== out)) {
      if (typeof v === 'number' && Number.isFinite(v)) w.push(`«${label}» мәні [${min}; ${max}] аралығына келтірілді: ${out}`);
      else w.push(`«${label}» мәні жарамсыз — бастапқы мән алынды: ${def}`);
    }
    return out;
  };
  const b = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

  const p: Params = clone(d);
  p.name = typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 80) : d.name;

  const e = r.evac ?? {};
  p.evac = {
    L1: n(e.L1, d.evac.L1, 0, 1000, 'L₁'),
    L2: n(e.L2, d.evac.L2, 0, 1000, 'L₂'),
    v1: n(e.v1, d.evac.v1, 0, 10, 'v₁'),
    v2: n(e.v2, d.evac.v2, 0, 10, 'v₂'),
    t0: n(e.t0, d.evac.t0, 0, 3600, 't₀'),
    N: Math.round(n(e.N, d.evac.N, 0, 5000, 'N')),
    q: n(e.q, d.evac.q, 0, 100, 'q'),
  };

  const ro = r.routes ?? {};
  p.routes.N = Math.round(n(ro.N, d.routes.N, 0, 5000, 'Маршруттар: N'));
  p.routes.commonBottleneck = b(ro.commonBottleneck, d.routes.commonBottleneck);
  p.routes.qCommon = n(ro.qCommon, d.routes.qCommon, 0, 100, 'Ортақ өткізу қабілеті');
  p.routes.list = d.routes.list.map((def, i) => {
    const x = Array.isArray(ro.list) ? ro.list[i] ?? {} : {};
    return {
      ...def,
      enabled: b(x.enabled, def.enabled),
      t0: n(x.t0, def.t0, 0, 3600, `${def.name}: t₀`),
      travel: n(x.travel, def.travel, 0, 3600, `${def.name}: қозғалыс`),
      q: n(x.q, def.q, 0, 100, `${def.name}: q`),
      share: n(x.share, def.share, 0, 100, `${def.name}: үлес`),
    };
  });

  const it = r.intensity ?? {};
  p.intensity = {
    people: Math.round(n(it.people, d.intensity.people, 0, 10000, 'Адам саны')),
    T: n(it.T, d.intensity.T, 0, 600, 'T'),
    exits: Math.round(n(it.exits, d.intensity.exits, 0, 50, 'Шығулар саны')),
  };

  const rs = r.response ?? {};
  p.response = {
    msg: n(rs.msg, d.response.msg, 0, 120, 'Хабарлау'),
    gather: n(rs.gather, d.response.gather, 0, 120, 'Жиналу'),
    travel: n(rs.travel, d.response.travel, 0, 120, 'Жол'),
    distanceKm: n(rs.distanceKm, d.response.distanceKm, 0, 100, 'Қашықтық'),
    travelSource: ['participant', 'document', 'custom'].includes(rs.travelSource) ? rs.travelSource : d.response.travelSource,
  };

  p.trucks = d.trucks.map((def, i) => {
    const x = Array.isArray(r.trucks) ? r.trucks[i] ?? {} : {};
    return {
      ...def,
      participates: b(x.participates, def.participates),
      extraDelayMin: n(x.extraDelayMin, def.extraDelayMin, 0, 240, `${def.name}: қосымша кідіріс`),
      deployMin: n(x.deployMin, def.deployMin, 0, 120, `${def.name}: дайындалу`),
      v0: n(x.v0, def.v0, 0, 100000, `${def.name}: V₀`),
      reservePct: n(x.reservePct, def.reservePct, 0, 100, `${def.name}: резерв`),
      flowLps: n(x.flowLps, def.flowLps, 0, 500, `${def.name}: Qᵢ`),
    };
  });

  const wa = r.water ?? {};
  const hy = wa.hydrant ?? {};
  p.water = {
    demandMin: n(wa.demandMin, d.water.demandMin, 0, 600, 'Су беру ұзақтығы'),
    hydrant: {
      enabled: b(hy.enabled, d.water.hydrant.enabled),
      delayMin: n(hy.delayMin, d.water.hydrant.delayMin, 0, 600, 'Қосылу кідірісі'),
      qIn: n(hy.qIn, d.water.hydrant.qIn, 0, 500, 'Qкіріс'),
    },
  };

  const st = r.staff ?? {};
  p.staff.total = Math.round(n(st.total, d.staff.total, 0, 500, 'Жалпы штат'));
  p.staff.initial = Math.round(n(st.initial, d.staff.initial, 0, 500, 'Алғашқы экипаж'));
  p.staff.workMin = n(st.workMin, d.staff.workMin, 0, 1440, 'Жұмыс ұзақтығы');
  if (Array.isArray(st.extra)) {
    p.staff.extra = st.extra.slice(0, 6).map((x: any, i: number) => ({
      atMin: n(x?.atMin, 20, 0, 1440, `Қосымша топ ${i + 1}: уақыт`),
      count: Math.round(n(x?.count, 0, 0, 500, `Қосымша топ ${i + 1}: саны`)),
    }));
  }
  if (Array.isArray(st.tasks)) {
    p.staff.tasks = st.tasks.slice(0, 10).map((x: any, i: number) => ({
      id: typeof x?.id === 'string' ? x.id : `t${i}`,
      name: typeof x?.name === 'string' ? x.name.slice(0, 60) : `Міндет ${i + 1}`,
      count: Math.round(n(x?.count, 1, 0, 100, `Міндет ${i + 1}: саны`)),
      fromMin: n(x?.fromMin, 0, 0, 1440, `Міндет ${i + 1}: басталуы`),
    }));
  }

  const re = r.research ?? {};
  p.research.vd = n(re.vd, d.research.vd, 0, 100000, 'Vп (зерттеу)');
  p.research.q0 = n(re.q0, d.research.q0, 0, 500, 'Q₀');
  p.research.q1 = n(re.q1, d.research.q1, 0, 500, 'Q₁');
  if (Array.isArray(re.pieces)) {
    p.research.pieces = re.pieces.slice(0, 8).map((x: any, i: number) => ({
      durMin: n(x?.durMin, 1, 0, 600, `Кезең ${i + 1}: ұзақтық`),
      q: n(x?.q, 0, 0, 500, `Кезең ${i + 1}: Q`),
    }));
  }

  const sc = r.scene ?? {};
  p.scene = {
    fireRoomId: typeof sc.fireRoomId === 'string' || sc.fireRoomId === null ? sc.fireRoomId : d.scene.fireRoomId,
    mode: sc.mode === 'routes' ? 'routes' : 'segment',
  };
  return { params: p, warnings: w };
}
