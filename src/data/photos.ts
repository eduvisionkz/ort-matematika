// Материалдар тізілімі: бастапқы файл атауы, не бейнеленген, модельдің қай бөлігінде қолданылады,
// фото бойынша не расталады. Түпнұсқалар өзгертілмейді: public/photos/original/<бума>/<файл>.

export type PhotoCat =
  | 'plans' | 'facade' | 'corridors' | 'classrooms' | 'library' | 'gym' | 'assembly' | 'canteen' | 'equipment' | 'station' | 'docs';

export const CAT_LABEL: Record<PhotoCat, string> = {
  plans: 'Эвакуация жоспарлары',
  facade: 'Қасбет және кіреберістер',
  corridors: 'Дәліздер мен баспалдақтар',
  classrooms: 'Кабинеттер',
  library: 'Кітапхана',
  gym: 'Спорт залы',
  assembly: 'Акт залы',
  canteen: 'Асхана',
  equipment: 'Өрт қауіпсіздігі жабдықтары',
  station: 'Өрт бөлімі және көліктер',
  docs: 'Ресімдеу талаптары (модельде қолданылмайды)',
};

export interface Photo {
  file: string;
  folder: string;
  cat: PhotoCat;
  title: string;
  shows: string;
  usedFor: string;
  confirms: string;
  /** Байланысты 3D нысандары */
  links?: string[];
  /** Оқуға ыңғайлы бұрылған көшірме бар ма */
  rotated?: boolean;
  people?: boolean;
}

const F = {
  plans: '01_Plany_evakuacii',
  station: '02_Pozharnaya_chast_i_tehnika',
  lib: '03_Biblioteka',
  gym: '04_Sportzal',
  school: '05_Shkola_pomesheniya_i_bezopasnost',
  docs: '06_Trebovaniya_k_rabote',
};

export const PHOTOS: Photo[] = [
  { file: '1000302672.jpg', folder: F.plans, cat: 'plans', rotated: true, title: '1-қабаттың эвакуация жоспары', shows: 'Фойе, вахта, гардероб, мұғалімдер бөлмесі, №5–№8, директор кабинеті, қосымша қанатта №1, екі асхана, акт залы; екі баспалдақ, ПГ белгілері, шығу бағыттары.', usedFor: '1-қабат бөлмелерінің реті, қанаттың орны, шығулар, баспалдақтар', confirms: 'Бөлмелердің өзара орналасуы және атаулары. Масштаб жоқ — өлшемдер шамамен.', links: ['floor-1'] },
  { file: '1000302671.jpg', folder: F.plans, cat: 'plans', rotated: true, title: '2-қабаттың эвакуация жоспары', shows: 'Кітапхана, №10–№15, зертхана, №17; қанатта спорт залы, №18, медбике кабинеті, гардеробтар, қойма; екі баспалдақ, ПГ.', usedFor: '2-қабат және оқу учаскесі (дәліз → баспалдақ)', confirms: 'Кітапхана мен спорт залының 2-қабатта екені, бөлмелер реті.', links: ['floor-2'] },
  { file: '1000302670.jpg', folder: F.plans, cat: 'plans', rotated: true, title: '3-қабаттың эвакуация жоспары', shows: '№19–№25, кабинет, зертхана; екі баспалдақ, ПГ.', usedFor: '3-қабат бөлмелерінің реті', confirms: '3-қабатта қосымша қанат көрсетілмеген.', links: ['floor-3'] },

  { file: '1000302673.jpg', folder: F.school, cat: 'facade', title: 'Басты қасбет', shows: 'Үш қабатты ғимарат, ашық түсті қаптама, қоңыр тік элементтер, күнқағар, әйнектелген орталық кіреберіс, пандус.', usedFor: 'Қасбет, кіреберіс, түстер', confirms: 'Қабат саны (3), орталық кіреберіс, қоңыр тік элементтер.', links: ['facade', 'f1-foyer'] },
  { file: '1000302674.jpg', folder: F.school, cat: 'facade', title: 'Басты қасбет (кеңірек көрініс)', shows: 'Терезелер қатары, орталық кіреберіс, баспалдақ және пандус.', usedFor: 'Терезелердің орналасуы', confirms: 'Терезелердің қабаттар бойынша қатарлары.', links: ['facade'] },
  { file: '1000302681.jpg', folder: F.school, cat: 'facade', title: 'Шеткі қабырға, екі жармалы есік', shows: 'Қоңыр екі жармалы есік, үстінде баспалдақ терезесі.', usedFor: 'Шеткі шығу (шартты орын)', confirms: 'Сыртқы есіктің бары. Қай шетте екені расталмаған.', links: ['exit-left'] },
  { file: '1000302684.jpg', folder: F.school, cat: 'facade', title: 'Бүйірдегі сыртқы есік', shows: 'Бетон баспалдақты сыртқы есік.', usedFor: 'Қосымша шығудың көрінісі', confirms: 'Есіктің бары; орны жоспармен сәйкестендірілмеген.' },
  { file: '1000302685.jpg', folder: F.school, cat: 'facade', title: 'Пандус және кіреберіс', shows: 'Ғимарат бойындағы пандус, кіреберіс күнқағары.', usedFor: 'Кіреберіс аймағы', confirms: 'Пандустың бары.', links: ['facade'] },

  { file: '1000302677.jpg', folder: F.school, cat: 'corridors', title: 'Дәліз', shows: 'Бір жағында терезелер, екінші жағында кабинет есіктері.', usedFor: 'Дәліз көрінісі', confirms: 'Дәліздің бір жақты орналасуы (жоспармен сәйкес). Қабаты белгісіз.', links: ['corridor'] },
  { file: '1000302680.jpg', folder: F.school, cat: 'corridors', title: 'Дәліз (терезе жағы)', shows: 'Ұзын дәліз, жасыл жалюзи.', usedFor: 'Дәліз көрінісі', confirms: 'Қабаты белгісіз.', links: ['corridor'] },
  { file: '1000303542.jpg', folder: F.school, cat: 'corridors', title: 'Дәліз және баспалдақ шарбағы', shows: 'Ұзын дәліз, баспалдақ қоршауы.', usedFor: 'Дәліз бен баспалдақтың түйісуі', confirms: 'Дәліз соңында баспалдақ бар (жоспармен сәйкес).', links: ['corridor', 'stair-left'] },
  { file: '1000303549.jpg', folder: F.school, cat: 'corridors', title: 'Дәліз', shows: 'Плиткалы кіреберіс бөлігі және дәліз.', usedFor: 'Дәліз көрінісі', confirms: 'Қабаты белгісіз.', links: ['corridor'] },
  { file: '1000302676.jpg', folder: F.school, cat: 'corridors', title: 'Баспалдақ алаңы және есік', shows: 'Баспалдақ, төмен қарай шығу есігі, «шығу» жарық белгісі.', usedFor: 'Баспалдақ торы', confirms: 'Баспалдақ торында есік бар.', links: ['exitsign', 'stair-left', 'stair-right'] },
  { file: '1000303543.jpg', folder: F.school, cat: 'corridors', title: 'Жоғары баспалдақ', shows: 'Бір маршты баспалдақ, терезе.', usedFor: 'Баспалдақ көрінісі', confirms: 'Баспалдақтың бары.', links: ['stair-left', 'stair-right'] },
  { file: '1000303550.jpg', folder: F.school, cat: 'corridors', title: 'Төмен баспалдақ', shows: 'Төмен түсетін баспалдақ, терезе.', usedFor: 'Баспалдақ көрінісі', confirms: 'Баспалдақтың бары.', links: ['stair-left', 'stair-right'] },
  { file: '1000302678.jpg', folder: F.school, cat: 'corridors', title: 'Фойе және турникет', shows: 'Кіреберіс фойесі, турникет, ою-өрнекті колонналар.', usedFor: 'Фойе (1-қабат)', confirms: 'Кіреберісте турникет бар.', links: ['f1-foyer'] },

  { file: '1000302689.jpg', folder: F.school, cat: 'classrooms', title: 'Оқу кабинеті', shows: 'Парталар, тақта, интерактивті панель.', usedFor: 'Кабинеттің жалпы көрінісі', confirms: 'Кабинет нөмірі мен қабаты белгісіз — нақты бөлмеге байланыстырылмаған.' },
  { file: '1000302690.jpg', folder: F.school, cat: 'classrooms', title: 'Оқу кабинеті', shows: 'Парталар, шкафтар, плакаттар.', usedFor: 'Кабинеттің жалпы көрінісі', confirms: 'Нөмірі белгісіз.' },
  { file: '1000303540.jpg', folder: F.school, cat: 'classrooms', title: 'Робототехника кабинеті', shows: 'Парталар, жалюзи, робототехника жазуы.', usedFor: 'Кабинеттің жалпы көрінісі', confirms: 'Нөмірі белгісіз.' },
  { file: '1000303541.jpg', folder: F.school, cat: 'classrooms', title: 'Оқу кабинеті', shows: 'Парталар қатары, тақта, терезелер.', usedFor: 'Кабинеттің жалпы көрінісі', confirms: 'Нөмірі белгісіз.' },

  { file: '1000304262.jpg', folder: F.lib, cat: 'library', title: 'Кітапхана: сөрелер', shows: 'Металл сөрелер, кітаптар, қабырға сөрелері.', usedFor: 'Кітапхана сөрелері мен кітаптар', confirms: 'Кітапхана жабдығы. Қабаты — жоспар бойынша 2-қабат.', links: ['f2-lib'] },
  { file: '1000304263.jpg', folder: F.lib, cat: 'library', title: 'Кітапхана: коворкинг қабырғасы', shows: 'Коворкинг стенді, жалюзи.', usedFor: 'Кітапхана композициясы', confirms: 'Кітапхананың бір бөлігі.', links: ['f2-lib'] },
  { file: '1000304264.jpg', folder: F.lib, cat: 'library', title: 'Кітапхана: үстелдер', shows: 'Тіктөртбұрыш құрап қойылған үстелдер, айнала сөрелер.', usedFor: 'Үстелдердің орналасуы', confirms: 'Үстелдер ортада, сөрелер қабырға бойында.', links: ['f2-lib'] },
  { file: '1000304265.jpg', folder: F.lib, cat: 'library', title: 'Кітапхана: көрме үстелі', shows: 'Қызыл матамен жабылған көрме үстелі, сөрелер.', usedFor: 'Көрме үстелі', confirms: '—', links: ['f2-lib'] },
  { file: '1000304266.jpg', folder: F.lib, cat: 'library', title: 'Кітапхана: есік және шкаф', shows: 'Есік, кітап шкафы.', usedFor: 'Кітапхана есігі', confirms: 'Есіктің бары; қай жаққа ашылатыны белгісіз.', links: ['f2-lib'] },

  { file: '1000304258.jpg', folder: F.gym, cat: 'gym', title: 'Спорт залы: терезелер мен орындықтар', shows: 'Бір қабырғадағы жоғарғы терезелер, волейбол торы, орындықтар, баскетбол қалқаны.', usedFor: 'Терезелер, тор, орындықтар', confirms: 'Спорт залы жабдығы. Қабаты — жоспар бойынша 2-қабат қанаты.', links: ['f2-gym'] },
  { file: '1000304259.jpg', folder: F.gym, cat: 'gym', title: 'Спорт залы: есіктер', shows: 'Ақ екі жармалы есік, баскетбол қалқаны, желдету құбыры.', usedFor: 'Есіктер, қалқан', confirms: 'Есіктердің бары.', links: ['f2-gym'] },
  { file: '1000304260.jpg', folder: F.gym, cat: 'gym', title: 'Спорт залы: шеткі қабырға', shows: 'Баскетбол қалқаны, қоңыр есік, тор.', usedFor: 'Қалқан және есік', confirms: '—', links: ['f2-gym'] },
  { file: '1000304261.jpg', folder: F.gym, cat: 'gym', title: 'Спорт залы: қорғаныс торы', shows: 'Терезе жағындағы қорғаныс торы, орындықтар.', usedFor: 'Тор және орындықтар', confirms: '—', links: ['f2-gym'] },

  { file: '1000303546.jpg', folder: F.school, cat: 'assembly', title: 'Акт залы: орындықтар', shows: 'Орындық қатарлары, перделі терезелер, сәндік ағаш.', usedFor: 'Орындықтар қатары', confirms: 'Акт залы. Қабаты — жоспар бойынша 1-қабат қанаты.', links: ['f1-hall'] },
  { file: '1000303547.jpg', folder: F.school, cat: 'assembly', title: 'Акт залы: сахна', shows: 'Перделі сахна, орындықтар.', usedFor: 'Сахна', confirms: 'Сахнаның бары.', links: ['f1-hall'], people: true },
  { file: '1000303548.jpg', folder: F.school, cat: 'assembly', title: 'Акт залы: терезелер', shows: 'Перделі терезелер, сәндік элементтер.', usedFor: 'Терезелер', confirms: '—', links: ['f1-hall'] },

  { file: '1000303544.jpg', folder: F.school, cat: 'canteen', title: 'Асхана', shows: 'Үстелдер мен орындықтар, жеміс суреттері.', usedFor: 'Асхана жиһазы', confirms: 'Асхана. Қабаты — жоспар бойынша 1-қабат қанаты.', links: ['f1-can1', 'f1-can2'] },
  { file: '1000303545.jpg', folder: F.school, cat: 'canteen', title: 'Асхана (басқа бұрыштан)', shows: 'Үстелдер қатары, орындықтар.', usedFor: 'Асхана жиһазы', confirms: '—', links: ['f1-can1', 'f1-can2'], people: true },

  { file: '1000302679.jpg', folder: F.school, cat: 'equipment', title: 'Өрт шкафы (ішкі)', shows: 'Өрт сөндіргіш және жең салынған шкаф, 101/112 жазуы.', usedFor: 'ПГ белгісінің көрінісі', confirms: 'Шкаф пен жабдықтың бары. Жұмыс қабілеті расталмаған.', links: ['pg'] },
  { file: '1000302686.jpg', folder: F.school, cat: 'equipment', title: 'Өрт шкафы (ашық)', shows: 'Жең мен өрт сөндіргіш, бағыт көрсеткіші.', usedFor: 'ПГ белгісінің көрінісі', confirms: 'Бары ғана; ақаусыздығы расталмаған.', links: ['pg'] },
  { file: '1000302675.jpg', folder: F.school, cat: 'equipment', title: 'Қолмен іске қосылатын хабарлағыш', shows: 'Қызыл қолмен хабарлағыш, сөндіргіш.', usedFor: 'Жабдықтар тізілімі', confirms: 'Бары ғана; жүйенің жұмысы тексерілмеген. 3D-де шартты орында көрсетілген.' , links: ['callpoint'] },
  { file: '1000302687.jpg', folder: F.school, cat: 'equipment', title: '«Шығу» белгісі бар есік', shows: 'Металл есік, «ШЫҒУ» белгісі, хабарлағыш.', usedFor: 'Шығу белгісі', confirms: 'Белгінің бары; есік орны белгісіз.' , links: ['exitsign'] },
  { file: '1000302688.jpg', folder: F.school, cat: 'equipment', title: 'Дәліздегі хабарлағыш', shows: 'Қабырғадағы қолмен хабарлағыш, есіктер.', usedFor: 'Жабдықтар тізілімі', confirms: 'Бары ғана.' , links: ['callpoint'] },
  { file: '1000302682.jpg', folder: F.school, cat: 'equipment', title: 'Сыртқы өрт қалқаны және «ПГ 50 м» белгісі', shows: 'Қызыл өрт қалқаны, «ПГ 50 м» көрсеткіші, бүйір есік.', usedFor: 'Шартты гидрант және өрт қалқаны', confirms: 'Белгі гидранттың 50 м қашықтықта екенін көрсетеді; гидранттың нақты орны мен өнімділігі расталмаған.', links: ['hydrant', 'shield'] },
  { file: '1000302683.jpg', folder: F.school, cat: 'equipment', title: 'Сыртқы өрт қалқаны', shows: 'Қабырғадағы қызыл өрт қалқаны.', usedFor: 'Өрт қалқаны', confirms: 'Бары ғана; толықтығы расталмаған.', links: ['shield'] },

  { file: '1000303538.jpg', folder: F.station, cat: 'station', title: 'Өрт бөлімінің ғимараты', shows: 'Кірпіш ғимарат, гараж қақпалары.', usedFor: 'Өрт бөлімінің шартты 3D моделі', confirms: 'Ғимараттың сыртқы түрі. Мекенжайы (Желтоқсан, 32) — мектеп өкілінің мәліметі.', links: ['station'] },
  { file: '1000303539.jpg', folder: F.station, cat: 'station', title: 'КАМАЗ (TUGYL 16) және Урал', shows: 'Екі өрт сөндіру автоцистернасы; КАМАЗ-да «TUGYL 16» жазуы.', usedFor: 'Екі машинаның шартты 3D модельдері', confirms: 'Екі машинаның бары. Бір мезгілде шығуы, цистерна көлемі және жабдығы расталмаған.', links: ['kamaz', 'ural'] },

  { file: '1000297076.jpg', folder: F.docs, cat: 'docs', title: 'Зерттеу жұмысын ресімдеу талаптары', shows: 'Байқау ережесінен үзінді: беттің пішімі, қаріп, құрылым.', usedFor: 'Ғимарат немесе жабдық ретінде қолданылмайды', confirms: 'Модельге қатысы жоқ.' },
];

export const photoUrl = (p: Photo, kind: 'web' | 'thumb' | 'original' = 'web', readable = false) => {
  const base = import.meta.env.BASE_URL;
  if (kind === 'original') return `${base}photos/original/${p.folder}/${p.file}`;
  const f = readable && p.rotated ? p.file.replace('.jpg', '_oqu.jpg') : p.file;
  return `${base}photos/${kind}/${f}`;
};

export const photosFor = (link: string) => PHOTOS.filter((p) => p.links?.includes(link));
export const PLAN_FOR_FLOOR: Record<number, string> = { 1: '1000302672.jpg', 2: '1000302671.jpg', 3: '1000302670.jpg' };
