// Ғимараттың схемалық орналасуы — эвакуация жоспарларының фотосуреттерінен ШАМАМЕН алынған.
// Жоспарларда масштаб жоқ: метрлер — модельдік мәндер. x — ғимарат бойымен (−35…35 м),
// z — терендігі (+7 — басты қасбет, теріс мәндер — артқы жақ). Жалпы өлшемдер ауданды есептеуге қолданылмайды.
import { Status } from '../engine/types';

export const FLOOR_H = 3.6; // модельдік қабат биіктігі, м
export const FRONT_Z = 7;
export const CORR = { z0: -3, z1: 0 };

export type RoomKind = 'room' | 'corridor' | 'stair' | 'library' | 'gym' | 'hall' | 'canteen' | 'foyer' | 'service';

export interface Room {
  id: string;
  floor: 1 | 2 | 3;
  name: string;
  kind: RoomKind;
  x: [number, number];
  z: [number, number];
  status: Status;
  note?: string;
  photoLink?: string;
}

const front = (floor: 1 | 2 | 3, list: [string, string, number, number, RoomKind?, string?][]): Room[] =>
  list.map(([id, name, x0, x1, kind, photoLink]) => ({
    id, floor, name, kind: kind ?? 'room', x: [x0, x1], z: [0, FRONT_Z], status: 'photo',
    note: 'Атауы мен реті эвакуация жоспарының фотосуреті бойынша; өлшемдері шамамен.', photoLink,
  }));

const common = (f: 1 | 2 | 3): Room[] => [
  { id: `f${f}-corr`, floor: f, name: `${f}-қабат дәлізі`, kind: 'corridor', x: [-28.4, 35], z: [CORR.z0, CORR.z1], status: 'photo', photoLink: 'corridor', note: 'Жоспар бойынша бір жақты дәліз; ені шамамен.' },
  { id: `f${f}-stairL`, floor: f, name: 'Сол жақ баспалдақ торы', kind: 'stair', x: [-35, -28.4], z: [CORR.z0, CORR.z1], status: 'photo', photoLink: 'stair-left', note: 'Жоспарда көрсетілген; ішкі өлшемдері шамамен.' },
  { id: `f${f}-stairR`, floor: f, name: 'Оң жақ баспалдақ торы', kind: 'stair', x: [28.4, 35], z: [-8, CORR.z0], status: 'photo', photoLink: 'stair-right', note: 'Жоспарда көрсетілген; ішкі өлшемдері шамамен.' },
];

export const ROOMS: Room[] = [
  ...front(1, [
    ['f1-dir', 'Директордың кабинеті', -35, -28.4],
    ['f1-r0', 'Бөлме (атауы жоспарда жоқ)', -28.4, -23.5],
    ['f1-cab1', 'Кабинет', -23.5, -19.3],
    ['f1-foyer', 'Фойе (вахта)', -19.3, -6.5, 'foyer', 'f1-foyer'],
    ['f1-gard', 'Гардероб', -6.5, -2.8, 'service'],
    ['f1-teach', 'Мұғалімдер бөлмесі', -2.8, 2.9],
    ['f1-5', '№ 5', 2.9, 9.6], ['f1-6', '№ 6', 9.6, 16.6], ['f1-7', '№ 7', 16.6, 23.6], ['f1-8', '№ 8', 23.6, 28.9],
    ['f1-cab2', 'Кабинет', 28.9, 35],
  ]),
  ...common(1),
  { id: 'f1-back', floor: 1, name: 'Қосалқы бөлмелер', kind: 'service', x: [19.7, 28.4], z: [-8, -3], status: 'photo', note: 'Жоспарда атауы көрсетілмеген.' },
  { id: 'f1-1', floor: 1, name: '№ 1', kind: 'room', x: [-23.6, -16], z: [-8, -3], status: 'photo', note: 'Жоспар бойынша.' },
  { id: 'f1-can1', floor: 1, name: 'Асхана', kind: 'canteen', x: [-23.6, -16], z: [-13, -8], status: 'photo', photoLink: 'f1-can1', note: 'Жоспарда екі «Асхана» бөлмесі. Жиһаз — фотосурет бойынша.' },
  { id: 'f1-can2', floor: 1, name: 'Асхана', kind: 'canteen', x: [-23.6, -16], z: [-21, -13], status: 'photo', photoLink: 'f1-can2', note: 'Фотосуреттің қай бөлмеде түсірілгені нақтыланбаған.' },
  { id: 'f1-wcorr', floor: 1, name: 'Қанат дәлізі', kind: 'corridor', x: [-16, -10.5], z: [-21, -3], status: 'photo' },
  { id: 'f1-hall', floor: 1, name: 'Акт залы', kind: 'hall', x: [-10.5, -3.6], z: [-21, -3], status: 'photo', photoLink: 'f1-hall', note: 'Жоспар бойынша 1-қабат қанатында; сахна мен орындықтар — фотосурет бойынша.' },

  ...front(2, [
    ['f2-lib', 'Кітапхана', -35, -25.3, 'library', 'f2-lib'],
    ['f2-10', '№ 10', -25.3, -16.5], ['f2-11', '№ 11', -16.5, -10.7], ['f2-12', '№ 12', -10.7, -5.4],
    ['f2-13', '№ 13', -5.4, 2.8], ['f2-14', '№ 14', 2.8, 10.5], ['f2-15', '№ 15', 10.5, 18.4],
    ['f2-lab', 'Зертхана', 18.4, 23.3], ['f2-17', '№ 17', 23.3, 35],
  ]),
  ...common(2),
  { id: 'f2-back', floor: 2, name: 'Қосалқы бөлмелер', kind: 'service', x: [19.7, 28.4], z: [-8, -3], status: 'photo', note: 'Жоспарда атауы көрсетілмеген.' },
  { id: 'f2-gym', floor: 2, name: 'Спорт залы', kind: 'gym', x: [-23.6, -14.6], z: [-21, -3], status: 'photo', photoLink: 'f2-gym', note: 'Жоспар бойынша 2-қабат қанатында. Залдың нақты биіктігі белгісіз.' },
  { id: 'f2-wcorr', floor: 2, name: 'Қанат дәлізі', kind: 'corridor', x: [-14.6, -12.4], z: [-21, -3], status: 'photo' },
  { id: 'f2-g1', floor: 2, name: 'Гардероб', kind: 'service', x: [-12.4, -3.6], z: [-5.6, -3], status: 'photo' },
  { id: 'f2-g2', floor: 2, name: 'Гардероб', kind: 'service', x: [-12.4, -3.6], z: [-8.2, -5.6], status: 'photo' },
  { id: 'f2-med', floor: 2, name: 'Медбике кабинеті', kind: 'room', x: [-12.4, -3.6], z: [-10.9, -8.2], status: 'photo' },
  { id: 'f2-18', floor: 2, name: '№ 18', kind: 'room', x: [-12.4, -3.6], z: [-16.1, -10.9], status: 'photo' },
  { id: 'f2-store', floor: 2, name: 'Қойма', kind: 'service', x: [-12.4, -3.6], z: [-18.8, -16.1], status: 'photo' },
  { id: 'f2-g3', floor: 2, name: 'Гардероб', kind: 'service', x: [-12.4, -3.6], z: [-21, -18.8], status: 'photo' },

  ...front(3, [
    ['f3-19', '№ 19', -35, -25], ['f3-20', '№ 20', -25, -19.3], ['f3-21', '№ 21', -19.3, -13.3],
    ['f3-cab', 'Кабинет', -13.3, -9.5], ['f3-22', '№ 22', -9.5, -0.7], ['f3-23', '№ 23', -0.7, 7.7],
    ['f3-24', '№ 24', 7.7, 17], ['f3-lab', 'Зертхана', 17, 21.9], ['f3-25', '№ 25', 21.9, 35],
  ]),
  ...common(3),
  { id: 'f3-back', floor: 3, name: 'Кабинет', kind: 'room', x: [19.7, 28.4], z: [-8, -3], status: 'photo', note: 'Жоспарда баспалдақ жанындағы «Кабинет».' },
];

/** Өрт гидранттары (ішкі өрт шкафтары) — жоспардағы «ПГ» белгілері бойынша, шамамен. */
export const PG_MARKERS: { floor: 1 | 2 | 3; x: number }[] = [
  { floor: 1, x: -8 }, { floor: 1, x: 14 },
  { floor: 2, x: -7.6 }, { floor: 2, x: 15 },
  { floor: 3, x: -14 }, { floor: 3, x: 15 },
];

/** Жоспардағы шығу бағыттары (1-қабат, схемалық). */
export const EXITS = [
  { id: 'main', name: 'Басты кіреберіс (фойе)', x: -12.9, z: 10.2, status: 'photo' as Status },
  { id: 'exit-left', name: 'Сол жақ шеткі шығу', x: -35.6, z: -1.5, status: 'photo' as Status },
  { id: 'exit-right', name: 'Оң жақ шеткі шығу', x: 35.6, z: -1.5, status: 'photo' as Status },
  { id: 'exit-back', name: 'Оң жақ баспалдақ торынан шығу', x: 31.5, z: -8.6, status: 'photo' as Status },
  { id: 'exit-hall', name: 'Акт залынан төтенше шығу', x: -3, z: -14, status: 'photo' as Status },
];

/** Модельдік оқу учаскесі: 2-қабат дәлізі (L₁) → сол жақ баспалдақ (L₂) → 1-қабат шеткі есік. */
export const SEGMENT_START_X = -28.4 + 30; // L₁ = 30 м
// y — қабат деңгейі (0 — 1-қабат едені, 1 — 2-қабат едені).
export const ROUTE_PATHS: Record<'r1' | 'r2', { corridor: [number, number, number][]; stairs: [number, number, number][]; door: [number, number, number] }> = {
  r1: {
    corridor: [[SEGMENT_START_X, 1, -1.5], [-28.4, 1, -1.5]],
    stairs: [[-28.4, 1, -1.5], [-33.6, 0.75, -0.8], [-34.4, 0.5, -1.5], [-33.6, 0.5, -2.3], [-29.2, 0.1, -2.3], [-29.2, 0, -1.5], [-34.6, 0, -1.5]],
    door: [-35.6, 0, -1.5],
  },
  r2: {
    corridor: [[SEGMENT_START_X + 1, 1, -1.5], [30, 1, -1.5]],
    stairs: [[30, 1, -1.5], [30, 1, -3.8], [34, 0.75, -4.2], [34.2, 0.5, -6.8], [29.5, 0.25, -6.8], [29.5, 0, -7.4], [31.5, 0, -7.6]],
    door: [31.5, 0, -8.6],
  },
};
