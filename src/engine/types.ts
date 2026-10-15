// Есептеу параметрлері, бастапқы мәндер және дайын мысалдар.

/** Фотосуреттер мен жоспарлар тізіліміндегі дерек түрі. */
export type Status = 'given' | 'photo' | 'clarify' | 'model' | 'result';
export const STATUS_LABEL: Record<Status, string> = {
  given: 'Берілген мәлімет',
  photo: 'Фотосуретте көрінеді',
  clarify: 'Нақтылауды қажет етеді',
  model: 'Есептеу шарты',
  result: 'Есептеу нәтижесі',
};

/** 3D көріністің қай есепті көрсететіні. */
export type SceneMode = 'overview' | 'fire' | 'evac2' | 'evacAll' | 'water' | 'refill' | 'staff';

export type WaterUse = 'ac5' | 'ac6' | 'both';

export interface Params {
  version: 2;
  name: string;
  /** Бөлме: ұзындығы a, ені b, м */
  room: { a: number; b: number };
  /** Өрттің таралуы: жылдамдық u, м/мин; тексерілетін уақыт t, мин */
  spread: { u: number; t: number };
  /** Келу: қашықтық L, м; жол t, мин; қабылдау+жиналу, мин; дайындық, мин; тұтанудан қоңырауға дейін (екі нұсқа), мин */
  arrival: { L: number; travel: number; gather: number; prep: number; delay: number; delay2: number };
  /** 2-қабат дәлізі: адам, дәліз L/v, баспалдақ L/v, дайындық, өткізу қарқыны, екі бағыт */
  evac2: { N: number; Lc: number; vc: number; Ls: number; vs: number; t0: number; q: number; two: boolean };
  /** Мектеп бойынша: N, 1-бағыттағы адам, тең бөлу, жол, қарқындар, мақсатты уақыт (с) */
  school: { N: number; N1: number; equal: boolean; t0: number; Lc: number; vc: number; Ls: number; vs: number; q1: number; q2: number; Tgoal: number };
  /** Су шығыны: қарқындылық I, л/(с·м²); бір стволдың шығыны, л/с; өрт ауданы алынатын уақыт, мин */
  flow: { I: number; qN: number; tFire: number };
  /** Су қоры: АЦ-5, АЦ-6 көлемі, л; шығын Q, л/с; машина; екі машина режимі; жұмыс уақыты, мин */
  water: { V5: number; V6: number; Q: number; use: WaterUse; order: 'seq' | 'par'; tWork: number };
  /** Толықтыру: бастапқы су, шығыс, кіріс, л/с; толықтыру басталатын уақыт, мин */
  refill: { V0: number; qOut: number; qIn: number; delay: number };
  /** Қызметкерлер: топ саны k, топтағы адам n, жүргізуші d, басқару c, бар адам */
  staff: { k: number; n: number; d: number; c: number; avail: number };
}

export const DEFAULT_PARAMS: Params = {
  version: 2,
  name: 'Негізгі нұсқа',
  room: { a: 8, b: 6 },
  spread: { u: 0.3, t: 10 },
  arrival: { L: 700, travel: 3, gather: 1, prep: 1, delay: 1, delay2: 2 },
  evac2: { N: 60, Lc: 30, vc: 1, Ls: 12, vs: 0.6, t0: 30, q: 1, two: false },
  school: { N: 450, N1: 225, equal: true, t0: 30, Lc: 30, vc: 1, Ls: 24, vs: 0.6, q1: 1, q2: 1, Tgoal: 300 },
  flow: { I: 0.1, qN: 3.5, tFire: 10 },
  water: { V5: 5000, V6: 6000, Q: 7, use: 'ac5', order: 'seq', tWork: 15 },
  refill: { V0: 5000, qOut: 7, qIn: 5, delay: 5 },
  staff: { k: 2, n: 2, d: 2, c: 1, avail: 3 },
};

/** Әр бөлімнің бастапқы мәндерін бөлек қайтару үшін. */
export type ParamGroup = Exclude<keyof Params, 'version' | 'name'>;

export interface Preset { id: string; name: string; note: string; apply: (p: Params) => Params }
export const PRESETS: Preset[] = [
  { id: 'base', name: 'Негізгі нұсқа', note: 'Барлық бастапқы мән', apply: () => JSON.parse(JSON.stringify(DEFAULT_PARAMS)) },
  { id: 'p590', name: '590 адам', note: 'Мектеп эвакуациясы: 590 адам, тең бөлу', apply: (p) => ({ ...p, name: '590 адам', school: { ...p.school, N: 590, N1: 295, equal: true } }) },
  { id: 'split', name: '450 адам: 300 / 150', note: 'Адамдар бағыттарға тең бөлінбейді', apply: (p) => ({ ...p, name: '450 адам: 300 / 150', school: { ...p.school, N: 450, N1: 300, equal: false } }) },
  { id: 'two', name: '60 адам: екі бағыт', note: '2-қабат дәлізі, 30 + 30 адам', apply: (p) => ({ ...p, name: '60 адам: екі бағыт', evac2: { ...p.evac2, two: true } }) },
  { id: 'late', name: 'Қоңырау 2 минутта', note: 'Су беру 7-минутта басталады', apply: (p) => ({ ...p, name: 'Қоңырау 2 минутта', arrival: { ...p.arrival, delay: 2 } }) },
  { id: 'both', name: 'Екі машина, 7 л/с', note: '11 000 л, кезекпен', apply: (p) => ({ ...p, name: 'Екі машина, 7 л/с', water: { ...p.water, use: 'both', Q: 7 } }) },
  { id: 'refill0', name: 'Толықтыру бірден', note: '5000 л, 7 л/с, кіріс 5 л/с, кідіріссіз', apply: (p) => ({ ...p, name: 'Толықтыру бірден', refill: { ...p.refill, delay: 0 } }) },
];
