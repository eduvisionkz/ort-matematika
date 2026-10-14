// Сценарий параметрлері, бастапқы мәндер және дайын мысалдар.

export type Status = 'given' | 'photo' | 'clarify' | 'model' | 'result';

export const STATUS_LABEL: Record<Status, string> = {
  given: 'Берілген мәлімет',
  photo: 'Фотосуретте көрінеді',
  clarify: 'Нақтылауды қажет етеді',
  model: 'Модельдік шарт',
  result: 'Есептеу нәтижесі',
};

export type TruckId = 'kamaz' | 'ural';

export interface TruckParams {
  id: TruckId;
  name: string;
  participates: boolean;
  /** Ортақ кезеңдерден (хабарлау+жинал+жол) кейінгі қосымша кідіріс, мин */
  extraDelayMin: number;
  /** Келгеннен кейін су беруге дайындалу (жайып орналастыру), мин */
  deployMin: number;
  /** Цистернадағы бастапқы көлем V₀, л */
  v0: number;
  /** Есептік сақталатын үлес Vқ, % */
  reservePct: number;
  /** Осы машинаға бекітілген желілердің шығыны Qᵢ, л/с */
  flowLps: number;
}

export interface RouteParams {
  id: 'r1' | 'r2';
  name: string;
  enabled: boolean;
  /** Қозғалыс басталғанға дейінгі кідіріс, с */
  t0: number;
  /** Маршрут бойынша қозғалыс уақыты, с */
  travel: number;
  /** Шығу есігінің өткізу қабілеті, адам/с */
  q: number;
  /** Адамдардың үлесі, % */
  share: number;
}

export interface StaffTask {
  id: string;
  name: string;
  count: number;
  /** θ бойынша басталуы, мин (θ = 0 — бірінші экипаждың келуі) */
  fromMin: number;
}

export interface Params {
  version: 1;
  name: string;
  evac: { L1: number; L2: number; v1: number; v2: number; t0: number; N: number; q: number };
  routes: { N: number; list: RouteParams[]; commonBottleneck: boolean; qCommon: number };
  intensity: { people: number; T: number; exits: number };
  response: { msg: number; gather: number; travel: number; distanceKm: number; travelSource: 'participant' | 'document' | 'custom' };
  trucks: TruckParams[];
  water: {
    /** Су берудің заданная ұзақтығы T, мин (τ бойынша) */
    demandMin: number;
    hydrant: { enabled: boolean; delayMin: number; qIn: number };
  };
  staff: {
    total: number;
    initial: number;
    extra: { atMin: number; count: number }[];
    tasks: StaffTask[];
    workMin: number;
  };
  research: { vd: number; q0: number; q1: number; pieces: { durMin: number; q: number }[] };
  scene: { fireRoomId: string | null; mode: 'segment' | 'routes' };
}

export const DEFAULT_PARAMS: Params = {
  version: 1,
  name: 'Негізгі сценарий',
  evac: { L1: 30, L2: 12, v1: 1, v2: 0.6, t0: 30, N: 60, q: 1 },
  routes: {
    N: 60,
    list: [
      { id: 'r1', name: '1-маршрут (сол жақ баспалдақ)', enabled: true, t0: 30, travel: 50, q: 1, share: 50 },
      { id: 'r2', name: '2-маршрут (оң жақ баспалдақ)', enabled: true, t0: 30, travel: 50, q: 1, share: 50 },
    ],
    commonBottleneck: false,
    qCommon: 1,
  },
  intensity: { people: 450, T: 5, exits: 5 },
  response: { msg: 0.5, gather: 1, travel: 2, distanceKm: 0.7, travelSource: 'participant' },
  trucks: [
    { id: 'kamaz', name: 'КАМАЗ АЦ-5', participates: true, extraDelayMin: 0, deployMin: 1.5, v0: 5000, reservePct: 10, flowLps: 10 },
    { id: 'ural', name: 'Урал АЦ-6', participates: false, extraDelayMin: 0, deployMin: 1.5, v0: 6000, reservePct: 10, flowLps: 0 },
  ],
  water: { demandMin: 10, hydrant: { enabled: false, delayMin: 3, qIn: 10 } },
  staff: {
    total: 14,
    initial: 3,
    extra: [{ atMin: 20, count: 3 }],
    tasks: [
      { id: 'coord', name: 'Басқару және байланыс', count: 1, fromMin: 0 },
      { id: 'drivers', name: 'Екі автомобильді басқару', count: 2, fromMin: 0 },
      { id: 'a', name: 'А әрекет тобы', count: 2, fromMin: 0 },
      { id: 'b', name: 'Б әрекет тобы', count: 2, fromMin: 0 },
    ],
    workMin: 60,
  },
  research: { vd: 4500, q0: 10, q1: 11, pieces: [{ durMin: 3, q: 5 }, { durMin: 4, q: 10 }] },
  scene: { fireRoomId: 'f2-corr', mode: 'segment' },
};

export interface Preset {
  id: string;
  name: string;
  note: string;
  apply: (p: Params) => Params;
}

const withTrucks = (p: Params, k: Partial<TruckParams>, u: Partial<TruckParams>): Params => ({
  ...p,
  trucks: [{ ...p.trucks[0], ...k }, { ...p.trucks[1], ...u }],
});

export const PRESETS: Preset[] = [
  {
    id: 'base',
    name: 'Негізгі сценарий',
    note: 'КАМАЗ, V₀ = 5000 л, Vқ = 10 %, Q = 10 л/с, T = 10 мин (2-сценарий: 2-қабат дәлізі).',
    apply: () => JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
  },
  ...([['sc1', '1-сценарий: акт залы (5 л/с)', 5, 'f1-hall'], ['sc2', '2-сценарий: 2-қабат дәлізі (10 л/с)', 10, 'f2-corr'], ['sc3', '3-сценарий: № 24 кабинет (15 л/с)', 15, 'f3-24']] as const).map(([id, name, q, room]) => ({
    id, name,
    note: `V₀ = 5000 л, Vқ = 500 л, Vп = 4500 л, Q = ${q} л/с, салыстыру уақыты 10 мин, толықтыру жоқ (2.4–2.6-бөлімдер).`,
    apply: (p: Params): Params => ({
      ...withTrucks(p, { participates: true, v0: 5000, reservePct: 10, flowLps: q, extraDelayMin: 0 }, { participates: false, flowLps: 0 }),
      name,
      water: { demandMin: 10, hydrant: { enabled: false, delayMin: 3, qIn: 10 } },
      scene: { ...p.scene, fireRoomId: room },
    }),
  })),
  {
    id: 'combined',
    name: 'Біріккен сценарий (§21)',
    note: 'Урал: қол жетімді 5400 л, Q = 14 л/с, толықтыру 10 л/с су беру басталғаннан 3 мин кейін, T = 20 мин, қажет 7 адам, бар 3 адам.',
    apply: (p) => ({
      ...withTrucks(p, { participates: false, flowLps: 0 }, { participates: true, v0: 6000, reservePct: 10, flowLps: 14, extraDelayMin: 0, deployMin: 1.5 }),
      name: 'Біріккен сценарий',
      water: { demandMin: 20, hydrant: { enabled: true, delayMin: 3, qIn: 10 } },
    }),
  },
  {
    id: 'two',
    name: 'Екі машина, 14 л/с',
    note: 'Екі машина бір мезгілде дайын: 4500 + 5400 = 9900 л, Qобщ = 14 л/с (құжаттағы 4 оқпан сценарийі).',
    apply: (p) => ({
      ...withTrucks(p, { participates: true, flowLps: 7, extraDelayMin: 0 }, { participates: true, flowLps: 7, extraDelayMin: 0 }),
      name: 'Екі машина, 14 л/с',
      water: { demandMin: 15, hydrant: { enabled: false, delayMin: 3, qIn: 10 } },
    }),
  },
  {
    id: 'gap',
    name: 'Су берудегі үзіліс (§17)',
    note: 'КАМАЗ 4500 л, Q = 10 л/с; Урал суы τ = 9 мин дайын (жалпы t = 14 мин). Лезде толықтыру — жеңілдету.',
    apply: (p) => ({
      ...withTrucks(p, { participates: true, flowLps: 10, extraDelayMin: 0 }, { participates: true, flowLps: 0, extraDelayMin: 9, deployMin: 1.5 }),
      name: 'Су берудегі үзіліс',
      water: { demandMin: 12, hydrant: { enabled: false, delayMin: 3, qIn: 10 } },
    }),
  },
  {
    id: 'delayed',
    name: 'Кешіктірілген толықтыру (§16)',
    note: 'Қол жетімді 5400 л, Qшығу = 14 л/с, алғашқы 3 мин Qкіріс = 0, кейін 10 л/с.',
    apply: (p) => ({
      ...withTrucks(p, { participates: false, flowLps: 0 }, { participates: true, flowLps: 14, extraDelayMin: 0 }),
      name: 'Кешіктірілген толықтыру',
      water: { demandMin: 15, hydrant: { enabled: true, delayMin: 3, qIn: 10 } },
    }),
  },
];
