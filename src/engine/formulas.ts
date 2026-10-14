// Формула карточкалары: бастапқы деректер → мәртебе → формула → сандарды қою → нәтиже → шектеулер.
import { Results } from './compute';
import { Status } from './types';
import { fmt, fmtSec, fmtMin } from './num';
import { sensitivity, piecewise, delayedRefillDuration, supplyGap, supplyDuration, availableVolume } from './water';

export interface FormulaCard {
  id: string;
  section: string;
  title: string;
  inputs: { name: string; value: string; status: Status }[];
  formula: string;
  legend: string;
  substitution: string;
  result: string;
  limits: string;
}

export function formulaCards(R: Results): FormulaCard[] {
  const p = R.params;
  const e = p.evac;
  const c: FormulaCard[] = [];
  const ev = R.evac;

  c.push({
    id: 'evac', section: 'Эвакуация', title: 'Модельдік учаскеден өту уақыты',
    inputs: [
      { name: 'L₁ — дәліз ұзындығы', value: `${fmt(e.L1)} м`, status: 'model' },
      { name: 'L₂ — баспалдақ бойымен жол ұзындығы (қабат биіктігі емес)', value: `${fmt(e.L2)} м`, status: 'model' },
      { name: 'v₁, v₂ — жылдамдықтар', value: `${fmt(e.v1)} және ${fmt(e.v2)} м/с`, status: 'model' },
      { name: 't₀ — қозғалыс басталғанға дейінгі кідіріс', value: `${fmt(e.t0)} с`, status: 'model' },
      { name: 'N — топтағы адам саны', value: `${e.N} адам`, status: 'model' },
      { name: 'q — өткізу қабілеті', value: `${fmt(e.q)} адам/с`, status: 'model' },
    ],
    formula: 't = t₀ + L₁/v₁ + L₂/v₂ + N/q',
    legend: 't — учаскеден өту уақыты (с); кезеңдер бірінен соң бірі қосылады.',
    substitution: ev.feasible
      ? `t = ${fmt(e.t0)} + ${fmt(e.L1)}/${fmt(e.v1)} + ${fmt(e.L2)}/${fmt(e.v2)} + ${e.N}/${fmt(e.q)} = ${fmt(e.t0)} + ${fmt(ev.tCorr!)} + ${fmt(ev.tStair!)} + ${fmt(ev.tPass!)}`
      : `Бөлгіштердің бірі нөлге тең: ${ev.reason}`,
    result: ev.feasible ? `t = ${fmtSec(ev.total)}` : 'Өту мүмкін емес (шекті уақыт жоқ)',
    limits: 'Бұл — таңдалған модельдік учаскенің (2-қабат дәлізі → баспалдақ) уақыты, мектептің толық эвакуация уақыты емес. Кезеңдер қабаттаспайды деп алынған; барлық маршруттар, ағындар мен жағдайлар белгісіз.',
  });

  const ro = R.routes;
  c.push({
    id: 'routes', section: 'Эвакуация', title: 'Бірнеше тәуелсіз маршрут',
    inputs: ro.routes.map((r) => ({ name: r.name, value: r.enabled ? `${r.people} адам, t₀ = ${fmt(r.t0)} с, қозғалыс ${fmt(r.travel)} с, q = ${fmt(r.q)} адам/с` : 'шартты түрде өшірілген', status: 'model' as Status })),
    formula: ro.mode === 'common' ? 'tжалпы = max(t₀ᵢ + қозғалысᵢ) + N/qортақ' : 'tжалпы = max(t₁, t₂, …),  tᵢ = t₀ᵢ + қозғалысᵢ + Nᵢ/qᵢ',
    legend: ro.mode === 'common' ? 'Ағындар бір есікке жиналады — ортақ өткізу қабілеті ескеріледі.' : 'Маршруттарда ортақ тар учаске жоқ деп алынады.',
    substitution: ro.mode === 'common'
      ? `tжалпы = ${fmt(Math.max(0, ...ro.routes.filter((r) => r.enabled && r.people > 0).map((r) => r.t0 + r.travel)))} + ${p.routes.N}/${fmt(p.routes.qCommon)}`
      : `tжалпы = max(${ro.routes.filter((r) => r.enabled).map((r) => fmt(r.total)).join('; ')})`,
    result: ro.feasible ? `tжалпы = ${fmtSec(ro.total)}; бір маршрутпен: ${fmtSec(ro.singleRouteTotal)}; өсім ${ro.increasePct === null ? '—' : fmt(ro.increasePct, 2) + ' %'}` : ro.reason ?? 'Өту мүмкін емес',
    limits: 'Маршрутты шартты өшіру — тек математикалық салыстыру. Ортақ тар учаске болса, тәуелсіздік шарты орындалмайды.',
  });

  const it = R.intensity;
  c.push({
    id: 'intensity', section: 'Эвакуация', title: 'Талап етілетін орташа шығу қарқыны',
    inputs: [
      { name: 'N — күндізгі адам саны (450 немесе 590)', value: `${p.intensity.people} адам`, status: 'given' },
      { name: 'T — жедел жоспарда эвакуацияға берілген уақыт', value: `${fmt(p.intensity.T)} мин`, status: 'given' },
      { name: 'Шығулар саны (4 негізгі + 1 қосалқы)', value: `${p.intensity.exits}`, status: 'given' },
    ],
    formula: 'R = N/T;  Rшығу = R/шығулар саны',
    legend: 'R — уақыт бірлігінде шығуы тиіс адамдардың орташа саны (адам/мин).',
    substitution: `R = ${p.intensity.people}/${fmt(p.intensity.T)}; бір шығуға: R/${p.intensity.exits}`,
    result: `R = ${fmt(it.R, 2)} адам/мин; бір шығуға ${fmt(it.perExit, 2)} адам/мин`,
    limits: 'Бұл берілген уақытқа сәйкес талап етілетін орташа қарқын ғана. Шығулардың нақты өткізу қабілеті дәлелденбеген және 5 минутта эвакуациялау мүмкіндігін растамайды. Біркелкі бөлу — шартты.',
  });

  const r = p.response;
  c.push({
    id: 'start', section: 'Келу уақыты', title: 'Су беру басталатын сәт',
    inputs: [
      { name: 'Tхабар — хабарлау', value: fmtMin(r.msg), status: 'model' },
      { name: 'Tжинал — жиналу', value: fmtMin(r.gather), status: 'model' },
      { name: 'Tжол — жол жүру', value: fmtMin(r.travel), status: r.travelSource === 'custom' ? 'model' : 'given' },
      { name: 'Tдайын — су беруге дайындық', value: fmtMin(R.response.phases[3].to - R.response.phases[2].to), status: 'model' },
    ],
    formula: 'Tсу беру басы = Tхабар + Tжинал + Tжол + Tдайын',
    legend: 'Есеп басы: t = 0 — сценарийдегі хабарлаудың басталуы.',
    substitution: `T = ${fmt(r.msg)} + ${fmt(r.gather)} + ${fmt(r.travel)} + ${fmt(R.response.phases[3].to - R.response.phases[2].to)}`,
    result: `Келу: t = ${fmtMin(R.response.phases[2].to)}; су беру басы: t = ${fmtMin(R.response.supplyStartFirst)}`,
    limits: '3 мин — құжаттық сценарий, 1–2 мин — мектеп өкілінің бағалауы. Кезеңдердің ұзақтығы — модельдік; 3 минутта келу 3 минутта су беру дегенді білдірмейді.',
  });

  c.push({
    id: 'speed', section: 'Келу уақыты', title: 'Орташа жылдамдық',
    inputs: [
      { name: 'L — бөлімнен мектепке дейінгі қашықтық', value: `${fmt(r.distanceKm, 3)} км`, status: 'given' },
      { name: 't — жол уақыты', value: fmtMin(r.travel), status: 'model' },
    ],
    formula: 'v = 60L/t',
    legend: 'L — км, t — мин, v — км/сағ.',
    substitution: `v = 60 × ${fmt(r.distanceKm, 3)} / ${fmt(r.travel)}`,
    result: R.response.speed === null ? 'Жол уақыты 0 — жылдамдық анықталмайды' : `v = ${fmt(R.response.speed, 2)} км/сағ`,
    limits: 'Бұл — математикалық сәйкестік, қозғалыс жылдамдығына ұсыныс емес. 700 м жол схемалық түрде көрсетілген.',
  });

  const ws = R.waterSummary;
  const part = R.trucks.filter((t) => t.participates);
  c.push({
    id: 'vd', section: 'Су қоры', title: 'Қол жетімді су көлемі',
    inputs: part.flatMap((t) => [
      { name: `${t.name}: V₀ (есептік көлем)`, value: `${fmt(t.v0)} л`, status: 'model' as Status },
      { name: `${t.name}: есептік сақталатын үлес Vқ`, value: `${fmt(t.reserve)} л`, status: 'model' as Status },
    ]),
    formula: 'Vп = V₀ − Vқ',
    legend: 'Vқ — өзгертуге болатын модельдік шарт, міндетті норматив емес.',
    substitution: part.map((t) => `${fmt(t.v0)} − ${fmt(t.reserve)} = ${fmt(t.vd)} л`).join('; ') || 'Қатысатын машина жоқ',
    result: `Барлығы Vп = ${fmt(ws.vdTotal)} л; сақталатын үлесте ${fmt(ws.reserveTotal)} л`,
    limits: 'Екінші машинаның суы ол дайын болғанға дейін ортақ қорға қосылмайды. Машиналар суы ортақ қор ретінде қарастырылады — модельдік шарт.',
  });

  c.push({
    id: 'dur', section: 'Су қоры', title: 'Су берудің ұзақтығы (толықтырусыз)',
    inputs: [
      { name: 'Vп — қол жетімді көлем', value: `${fmt(ws.vdTotal)} л`, status: 'result' },
      { name: 'Q = ΣQᵢ — жалпы шығын', value: `${fmt(ws.qReq)} л/с`, status: 'model' },
    ],
    formula: 'T = Vп/(60Q);  Vқалдық(t) = max(0; Vп − 60Qt)',
    legend: 'T — мин, Q — л/с; 60 — секундты минутқа ауыстыру коэффициенті.',
    substitution: ws.qReq > 0 ? `T = ${fmt(ws.vdTotal)} / (60 × ${fmt(ws.qReq)})` : 'Q = 0',
    result: ws.qReq > 0 ? `T = ${fmtMin(ws.durationAllStock)}` : 'Су шығыны жоқ',
    limits: 'Бұл — қол жетімді судың берілген шығынға жететін уақыты, өртті толық сөндіру уақыты емес.',
  });

  c.push({
    id: 'deficit', section: 'Су қоры', title: 'Қажетті көлем және тапшылық',
    inputs: [
      { name: 'Q', value: `${fmt(ws.qReq)} л/с`, status: 'model' },
      { name: 'T — су берудің берілген ұзақтығы', value: fmtMin(p.water.demandMin), status: 'model' },
      { name: 'Vп', value: `${fmt(ws.vdTotal)} л`, status: 'result' },
    ],
    formula: 'Vқаж = 60QT;  ΔV = max(0; Vқаж − Vп);  ΔV% = ΔV/Vқаж × 100 %',
    legend: 'D — толықтырусыз жетіспейтін көлем.',
    substitution: `Vқаж = 60 × ${fmt(ws.qReq)} × ${fmt(p.water.demandMin)} = ${fmt(ws.req)} л; ΔV = max(0; ${fmt(ws.req)} − ${fmt(ws.vdTotal)})`,
    result: `ΔV = ${fmt(ws.deficitSimple)} л${ws.deficitPct !== null ? ` (${fmt(ws.deficitPct, 2)} %)` : ''}${ws.leftover > 0 ? `; қалдық ${fmt(ws.leftover)} л` : ''}`,
    limits: 'Теріс тапшылық көрсетілмейді. Құжаттағы 4 оқпан мен 14 л/с — құжаттық сценарий; 3,5 л/с әр оқпанның әмбебап шығыны емес.',
  });

  const hy = p.water.hydrant;
  const lead = part[0];
  const dr = lead ? delayedRefillDuration(ws.vdTotal, ws.qReq, hy.delayMin, hy.qIn) : null;
  c.push({
    id: 'refill', section: 'Су қоры', title: 'Су көзінен толықтыру',
    inputs: [
      { name: 'Гидрант (стадион маңы, 50 м — мектеп өкілінің мәліметі; орны нақтыланбаған)', value: hy.enabled ? 'қосылған' : 'қосылмаған', status: 'given' },
      { name: 'Qкіріс — нақты кіріс шығыны', value: `${fmt(hy.qIn)} л/с`, status: 'model' },
      { name: 'Қосылу кідірісі (τ бойынша)', value: fmtMin(hy.delayMin), status: 'model' },
    ],
    formula: 'ΔV = 60(Qкіріс − Qшығу)Δt;  Qшығу > Qкіріс болса T = Vп/[60(Qшығу − Qкіріс)]',
    legend: 'V сыйымдылықтан аспайды; артық ағын көлемді шексіз арттырмайды.',
    substitution: dr && hy.enabled
      ? `Алғашқы ${fmt(hy.delayMin)} мин: ${fmt(ws.vdTotal)} − 60 × ${fmt(ws.qReq)} × ${fmt(hy.delayMin)} = ${fmt(dr.v1)} л; кейін ${fmt(dr.v1)} / [60 × (${fmt(ws.qReq)} − ${fmt(hy.qIn)})]`
      : 'Гидрант сценарийге қосылмаған',
    result: hy.enabled
      ? dr?.total === null || dr === null
        ? 'Qкіріс ≥ Qшығу: үздіксіз сумен жабдықтау кезіндегі шартты баланс (шексіз сөндіру уәде етілмейді)'
        : `Берілген шығынды ұстап тұру: ${fmtMin(dr.total)} (τ бойынша)`
      : '—',
    limits: 'Qкір — шартты ағын (0; 5; 10; 14 л/с). 55 л/с — жедел жоспардағы желі мәні, гидранттан цистернаға түсетін ағынмен теңестірілмейді. Гидрант 3D-де схемалық орында.',
  });

  const tRes = supplyDuration(availableVolume(5000, 10), 10) ?? 0;
  const g = supplyGap(9, tRes, 10);
  c.push({
    id: 'gap', section: 'Су қоры', title: 'Су берудегі үзіліс',
    inputs: [
      { name: 'T — қордың жету уақыты (4500 л, 10 л/с)', value: fmtMin(tRes), status: 'result' },
      { name: 'tж — келесі су көзінің дайындығы', value: '9 мин (τ)', status: 'model' },
    ],
    formula: 'G = max(0; tж − T);  Vаралық = 60QG',
    legend: 'Машинаның келуі мен суының пайдалануға дайындығы ажыратылады.',
    substitution: `G = max(0; 9 − ${fmt(tRes)}) = ${fmt(g.G)} мин; V = 60 × 10 × ${fmt(g.G)}`,
    result: `G = ${fmtMin(g.G)}; қамтылмаған көлем ${fmt(g.unsupplied)} л`,
    limits: 'Келесі машина суын лезде қосу — жеңілдету; гидранттан үздіксіз берумен араластырылмайды.',
  });

  const rs = p.research;
  const s = sensitivity(rs.vd, rs.q0, rs.q1);
  c.push({
    id: 'deriv', section: 'Су қоры', title: 'Туынды және сезімталдық',
    inputs: [
      { name: 'Vп', value: `${fmt(rs.vd)} л`, status: 'model' },
      { name: 'Q₀ → Q₁', value: `${fmt(rs.q0)} → ${fmt(rs.q1)} л/с`, status: 'model' },
    ],
    formula: 'T(Q) = Vп/(60Q);  T′(Q) = −Vп/(60Q²);  T(Q₁) ≈ T(Q₀) + T′(Q₀)(Q₁ − Q₀)',
    legend: 'T′ — шығын 1 л/с өскенде ұзақтықтың жуық өзгерісі (мин/(л/с)).',
    substitution: `T′(${fmt(rs.q0)}) = −${fmt(rs.vd)}/(60 × ${fmt(rs.q0)}²)`,
    result: `T′ = ${fmt(s.d, 3)} мин/(л/с); дәл T(${fmt(rs.q1)}) = ${fmtMin(s.T1)}; сызықтық баға ${fmtMin(s.linear)}`,
    limits: 'Сызықтық жуықтау тек бастапқы нүктеге жақын жерде дәл; T(Q) — қисық сызық, сондықтан дәл есептеу мен жуықтау ерекшеленеді.',
  });

  const pw = piecewise(rs.vd, rs.pieces);
  c.push({
    id: 'piece', section: 'Су қоры', title: 'Кесінді-тұрақты шығын',
    inputs: rs.pieces.map((x, i) => ({ name: `${i + 1}-кезең`, value: `${fmt(x.durMin)} мин × ${fmt(x.q)} л/с`, status: 'model' as Status })),
    formula: 'Vпайд = 60∫Q(t)dt = 60Σ(Qᵢ·Δtᵢ)',
    legend: 'Уақыт — мин, шығын — л/с.',
    substitution: `Vпайд = 60 × (${rs.pieces.map((x) => `${fmt(x.durMin)} × ${fmt(x.q)}`).join(' + ')}) = ${fmt(pw.used)} л`,
    result: pw.exhaustedInPieces ? `Қор кезеңдер ішінде таусылады: ${fmtMin(pw.total)}` : `Қалдық ${fmt(pw.left)} л → тағы ${fmtMin(pw.extra)}; барлығы ${fmtMin(pw.total)}`,
    limits: 'Соңғы кезеңдегі шығын одан әрі өзгермейді деп алынған.',
  });

  const st = R.staff;
  c.push({
    id: 'staff', section: 'Жеке құрам', title: 'Жеке құрам тапшылығы',
    inputs: [
      { name: 'Жалпы штат (4 өрт сөндіруші, 4 бөлімше командирі, 5 жүргізуші, 1 басшы)', value: `${p.staff.total} адам`, status: 'given' },
      { name: 'Алғашқы экипаж', value: `${p.staff.initial} адам`, status: 'given' },
      ...p.staff.tasks.map((t) => ({ name: t.name, value: `${t.count} адам`, status: 'model' as Status })),
    ],
    formula: 'Nқажет(t) = Σ бір мезгілдегі міндеттер;  Dадам(t) = max(0; Nқажет(t) − Nбар(t))',
    legend: 'Бір қызметкерге бір мезгілде тек бір міндет бекітіледі.',
    substitution: `ΔV = max(0; ${st.initialReq} − ${st.initialAvail})`,
    result: `Бастапқы тапшылық: ${st.initialDeficit} адам`,
    limits: 'Міндеттерді бөлу — математикалық зерттеуге арналған шартты матрица, өрт бөлімшесінің нормативтік құрамы емес. 14 − 3 айырмасы 11 адамның бірден шығуға дайын екенін дәлелдемейді.',
  });

  c.push({
    id: 'ph', section: 'Адам-сағат', title: 'Адам-сағат',
    inputs: st.steps.map((x) => ({ name: `θ ∈ [${fmt(x.from)}; ${fmt(x.to)}] мин`, value: `${x.avail} адам`, status: 'model' as Status })),
    formula: 'H = Σ(Nᵢ·Δtᵢ)/60 = (1/60)∫N(t)dt',
    legend: 'Δtᵢ — минут; θ = 0 — бірінші экипаждың келуі.',
    substitution: `H = (${st.steps.map((x) => `${x.avail} × ${fmt(x.to - x.from)}`).join(' + ')})/60`,
    result: `H = ${fmt(st.H, 2)} адам-сағат; орташа ${fmt(st.avg, 2)}; ең көбі ${st.max} адам`,
    limits: 'Ақшалай шығын тарифсіз есептелмейді. Қызметкерлерді екі есе көбейту сөндіруді екі есе қысқартады деп айтылмайды.',
  });

  if (R.water && R.ts !== null) {
    const w = R.water;
    c.push({
      id: 'combined', section: 'Біріккен', title: 'Су беру уақыты бойынша нәтиже (ағымдағы сценарий)',
      inputs: [
        { name: 'Су беру басы (жалпы шкала)', value: `t = ${fmtMin(R.ts)}`, status: 'result' },
        { name: 'Қол жетімді қор', value: `${fmt(ws.vdTotal)} л`, status: 'result' },
        { name: 'Талап етілетін шығын', value: `${fmt(ws.qReq)} л/с`, status: 'model' },
        { name: 'Берілген ұзақтық', value: fmtMin(p.water.demandMin), status: 'model' },
      ],
      formula: 'τ = t − tсу беру басы;  Vаралық = 60∫(Qсұралған − Qнақты)dτ',
      legend: 'τ = 0 — су беру басы; t = 0 — хабарлау басы.',
      substitution: w.firstShortfall === null ? 'Берілген шығын бүкіл кезеңде қамтылады' : `Алғашқы жетіспеушілік τ = ${fmt(w.firstShortfall)} мин → t = ${fmt(R.ts + w.firstShortfall)} мин`,
      result: `Қамтылмаған көлем: ${fmt(w.totals.unmet)} л; су беру t = ${fmtMin(R.ts + p.water.demandMin)} дейін созылуы тиіс`,
      limits: 'Су тапшылығы мен жеке құрам тапшылығы — әртүрлі шектеулер: біреуін жою екіншісін жоймайды.',
    });
  }
  void fmtSec;
  return c;
}
