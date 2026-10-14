import { useMemo, useState } from 'react';
import { useScenario } from '../state/store';
import { useUI } from '../state/ui';
import { formulaCards } from '../engine/formulas';
import { FormulaCardView } from '../components/FormulaCardView';
import { LineChart, Table, SERIES } from '../components/Chart';
import { Tag, Note, download, ARTIFACT_MODE } from '../components/ui';
import { fmt, fmtSec, fmtMin, fmtDateKk } from '../engine/num';
import { waterSeries, waterTable, staffSeries, compareScenarios, toCSV, metricsOf, METRIC_DEFS } from '../engine/tables';
import { SOURCE_ITEMS } from '../data/sourceData';
import { Params, Status } from '../engine/types';
import { Results as R_ } from '../engine/compute';

function paramRows(p: Params): [string, string, Status][] {
  const r: [string, string, Status][] = [
    ['L₁ / L₂', `${fmt(p.evac.L1)} м / ${fmt(p.evac.L2)} м`, 'model'],
    ['v₁ / v₂', `${fmt(p.evac.v1)} / ${fmt(p.evac.v2)} м/с`, 'model'],
    ['t₀, N, q', `${fmt(p.evac.t0)} с; ${p.evac.N} адам; ${fmt(p.evac.q)} адам/с`, 'model'],
    ['Маршруттар', p.routes.list.map((x) => `${x.name}: ${x.enabled ? `t₀ ${fmt(x.t0)} с, қозғалыс ${fmt(x.travel)} с, q ${fmt(x.q)}, үлес ${fmt(x.share, 1)} %` : 'өшірілген'}`).join('; ') + (p.routes.commonBottleneck ? `; ортақ тар учаске q = ${fmt(p.routes.qCommon)}` : ''), 'model'],
    ['Адам саны / T / шығулар', `${p.intensity.people} / ${fmt(p.intensity.T)} мин / ${p.intensity.exits}`, 'given'],
    ['Хабарлау, жиналу', `${fmt(p.response.msg)} мин, ${fmt(p.response.gather)} мин`, 'model'],
    ['Жол уақыты', `${fmt(p.response.travel)} мин (${p.response.travelSource === 'participant' ? 'мектеп өкілі' : p.response.travelSource === 'document' ? 'жедел жоспар' : 'модельдік'})`, p.response.travelSource === 'custom' ? 'model' : 'given'],
    ['Қашықтық', `${fmt(p.response.distanceKm, 3)} км`, 'given'],
    ...p.trucks.map((t) => [t.name, t.participates ? `қатысады; V₀ ${fmt(t.v0)} л; Vқ ${fmt(t.reservePct)} %; Qᵢ ${fmt(t.flowLps)} л/с; қосымша кідіріс ${fmt(t.extraDelayMin)} мин; жаю ${fmt(t.deployMin)} мин` : 'қатыспайды', 'model'] as [string, string, Status]),
    ['Су беру ұзақтығы T', `${fmt(p.water.demandMin)} мин`, 'model'],
    ['Гидрант', p.water.hydrant.enabled ? `қосылған; кідіріс ${fmt(p.water.hydrant.delayMin)} мин; Qкіріс ${fmt(p.water.hydrant.qIn)} л/с` : 'қосылмаған', 'model'],
    ['Жеке құрам', `штат ${p.staff.total}; алғашқы ${p.staff.initial}; қосымша: ${p.staff.extra.map((e) => `${e.count} адам θ = ${fmt(e.atMin)} мин`).join(', ') || 'жоқ'}`, 'given'],
    ['Міндеттер', p.staff.tasks.map((t) => `${t.name} — ${t.count}`).join('; '), 'model'],
    ['Жұмыс ұзақтығы', `${fmt(p.staff.workMin)} мин`, 'model'],
  ];
  return r;
}

const LIMITS = [
  'Бұл — оқу-зерттеу моделі. Нәтижелер енгізілген деректер мен модельдік шарттарға тәуелді; ол өрт қауіпсіздігі бойынша кәсіби қорытынды емес.',
  'Эвакуация уақыты — таңдалған модельдік учаскенің уақыты, мектептің толық эвакуация уақыты емес; кезеңдер тізбекті қосылады.',
  'R = N/T — талап етілетін орташа қарқын; шығулардың дәлелденген өткізу қабілеті емес.',
  'Су беру ұзақтығы өртті толық сөндіру уақыты емес. Сақталатын үлес Vқ = 10 % — модельдік шарт, норматив емес.',
  'Цистерна көлемдері 5000 және 6000 л — АЦ-5 және АЦ-6 атаулары бойынша есептік көлемдер.',
  'Гидранттан толықтыру шартты ағындармен (0; 5; 10; 14 л/с) зерттеледі; 55 л/с — жедел жоспардағы желі мәні.',
  'Жеке құрамның міндеттер матрицасы шартты; жалпы штат кезекшілер санына тең емес.',
  'Ғимараттың 3D моделі жоспар фотосуреттері бойынша схемалық; өлшемдер шамамен, жол 700 м масштабсыз.',
  'Фотосуреттегі жабдықтың бары оның ақаусыздығын растамайды.',
  'Су тапшылығы мен жеке құрам тапшылығы — әртүрлі шектеулер.',
];

export function exportAllCSV(R: R_) {
  const parts: string[] = [];
  const w = waterTable(R);
  if (w.rows.length) parts.push('Су қоры (τ қадамы 1 мин)\n' + toCSV(w.head, w.rows).slice(1));
  parts.push('Эвакуация нұсқалары\n' + toCSV(['Нұсқа', 'Өзгерген', 't, с', 'Айырма, с'], R.evacVariants.map((v) => [v.label, v.changed, v.result.feasible ? fmt(v.result.total, 2) : 'мүмкін емес', v.diff === null ? '' : fmt(v.diff, 2)])).slice(1));
  parts.push('Маршруттар\n' + toCSV(['Маршрут', 'Қосулы', 'Адам', 't, с'], R.routes.routes.map((r) => [r.name, r.enabled ? 'иә' : 'жоқ', r.people, Number.isFinite(r.total) ? fmt(r.total, 2) : 'мүмкін емес'])).slice(1));
  parts.push('Машиналар\n' + toCSV(['Машина', 'Қатысады', 'Келуі t, мин', 'Дайын t, мин', 'Vп, л', 'Vқ, л', 'Qᵢ, л/с'], R.trucks.map((t) => [t.name, t.participates ? 'иә' : 'жоқ', fmt(t.arrival, 2), fmt(t.ready, 2), fmt(t.vd, 1), fmt(t.reserve, 1), fmt(t.flow, 2)])).slice(1));
  parts.push('Жеке құрам және адам-сағат\n' + toCSV(['θ басы, мин', 'θ соңы, мин', 'Бар', 'Қажет', 'Тапшылық', 'N·Δt'], R.staff.steps.map((s) => [fmt(s.from, 2), fmt(s.to, 2), s.avail, s.req, s.deficit, fmt(s.avail * (s.to - s.from), 2)])).slice(1));
  const m = metricsOf(R);
  parts.push('Негізгі нәтижелер\n' + toCSV(['Көрсеткіш', 'Мәні', 'Бірлік'], METRIC_DEFS.map((d) => [d.name, m[d.key] === null ? '' : fmt(m[d.key] as number, 3), d.unit])).slice(1));
  return '﻿' + parts.join('\r\n\r\n');
}

export function Results() {
  const { results: R, params: p, slots } = useScenario();
  const { snapshotPNG } = useUI();
  const cards = useMemo(() => formulaCards(R), [R]);
  const [img, setImg] = useState<string | null>(null);
  const [created] = useState(() => new Date());
  const S = waterSeries(R); const SS = staffSeries(R); const wt = waterTable(R);
  const cmp = slots.A && slots.B ? compareScenarios(slots.A, slots.B) : null;
  const m = metricsOf(R);
  const w = R.water;
  return (
    <>
      <div className="seg no-print">
        {!ARTIFACT_MODE && <button className="btn primary" onClick={() => window.print()}>🖨 Басып шығару / PDF сақтау</button>}
        <button className="btn" onClick={() => download('ort-matematika-kesteler.csv', exportAllCSV(R), 'text/csv')}>Кестелер (CSV)</button>
        {wt.rows.length > 0 && <button className="btn" onClick={() => download('su-qory.csv', toCSV(wt.head, wt.rows), 'text/csv')}>Су қоры кестесі (CSV)</button>}
        <button className="btn" onClick={() => download('scenarij.json', JSON.stringify({ app: 'ort-sondiru-matematika', version: 1, params: p }, null, 2), 'application/json')}>Сценарий (JSON)</button>
        <button className="btn" onClick={() => setImg(snapshotPNG())}>3D көріністі есепке қосу</button>
      </div>
      <p className="muted small no-print">{ARTIFACT_MODE ? 'Бұл беттің онлайн нұсқасында басып шығару және файл жүктеу бұғатталған: CSV және JSON батырмалары мазмұнды алмасу буферіне көшіреді. PDF үшін жобаны жергілікті іске қосыңыз.' : 'PDF: браузердің басып шығару терезесінде «PDF ретінде сақтау» таңдаңыз.'}</p>

      <article className="report">
        <header className="report-head">
          <h1>«Өрт сөндіру ісіндегі математика»</h1>
          <p>Ш. Уәлиханов атындағы орта мектебі, Тұғыл ауылы · Сценарий: <b>{p.name}</b></p>
          <p className="muted">Есеп жасалған күні: {fmtDateKk(created)}</p>
          <p className="disclaimer">Бұл — оқу-зерттеу моделі. Нәтижелер енгізілген деректер мен модельдік шарттарға тәуелді.</p>
        </header>

        <h2>1. Негізгі нәтижелер</h2>
        <Table head={['Көрсеткіш', 'Мәні']} rows={[
          ['Модельдік учаскеден өту уақыты', R.evac.feasible ? fmtSec(R.evac.total) : 'өту мүмкін емес'],
          ['Бірнеше маршрут: tжалпы', R.routes.feasible ? fmtSec(R.routes.total) : 'өту мүмкін емес'],
          ['Талап етілетін қарқын R (450 / 590 адам)', R.intensity.doc.map((d) => `${fmt(d.R, 2)} адам/мин`).join(' / ')],
          ['Бірінші машинаның келуі', `t = ${fmtMin(R.tFirstArrival)}`],
          ['Су беру басы', R.ts === null ? '—' : `t = ${fmtMin(R.ts)}`],
          ['Жалпы шығын Q = ΣQᵢ', `${fmt(R.waterSummary.qReq)} л/с`],
          ['Қол жетімді су / Vқ', `${fmt(R.waterSummary.vdTotal)} л / ${fmt(R.waterSummary.reserveTotal)} л`],
          ['Берілген шығынның қамтылған ұзақтығы', R.waterSummary.supported === null ? '—' : `τ = ${fmtMin(R.waterSummary.supported)}${w?.firstShortfall != null && R.ts !== null ? ` (t = ${fmtMin(R.ts + w.firstShortfall)})` : ' (бүкіл кезең)'}`],
          ['Vқаж / ΔV (толықтырусыз)', `${fmt(R.waterSummary.req)} л / ${fmt(R.waterSummary.deficitSimple)} л`],
          ['Қамтылмаған көлем (уақыт моделі)', w ? `${fmt(w.totals.unmet)} л` : '—'],
          ['Жеке құрам: қажет / бар / тапшылық', `${R.staff.initialReq} / ${R.staff.initialAvail} / ${R.staff.initialDeficit}`],
          ['Адам-сағат', `${fmt(m.ph, 2)} (орташа ${fmt(R.staff.avg, 2)}, ең көбі ${R.staff.max})`],
        ]} />
        {R.warnings.length > 0 && <Note tone="warn">{R.warnings.join(' ')}</Note>}

        <h2>2. Параметрлер және олардың мәртебесі</h2>
        <div className="table-wrap"><table><thead><tr><th>Параметр</th><th>Мәні</th><th>Мәртебе</th></tr></thead>
          <tbody>{paramRows(p).map(([a, b, s]) => <tr key={a}><td>{a}</td><td>{b}</td><td><Tag s={s} /></td></tr>)}</tbody></table></div>

        <h2>3. Деректердің шығу тегі</h2>
        <div className="table-wrap"><table><thead><tr><th>Көрсеткіш</th><th>Мәні</th><th>Мәртебе</th><th>Қолданылуы</th></tr></thead>
          <tbody>{SOURCE_ITEMS.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.value}</td><td><Tag s={s.status} /></td><td>{s.usedIn}</td></tr>)}</tbody></table></div>

        {img && <><h2>3D көрініс</h2><img className="report-img" src={img} alt="3D модельдің көрінісі" /></>}

        <h2>4. Графиктер</h2>
        {S && w && <>
          <LineChart title="Қол жетімді су және сақталатын үлес Vқ" xLabel="τ, мин (су беру басынан)" yLabel="литр" xMax={w.T}
            series={[{ name: 'Қол жетімді V(τ)', color: SERIES.blue, points: S.V, area: true }, { name: 'Vқ', color: SERIES.gray, points: S.res, dash: '5 4' }]} />
          <LineChart title="Шығын" xLabel="τ, мин" yLabel="л/с" xMax={w.T} height={190}
            series={[{ name: 'Сұралған', color: SERIES.gray, points: S.qReq, dash: '6 4' }, { name: 'Нақты', color: SERIES.blue, points: S.qOut }, { name: 'Кіріс', color: SERIES.aqua, points: S.qIn }]} />
        </>}
        <LineChart title="Жеке құрам" xLabel="θ, мин" yLabel="адам" xMax={p.staff.workMin} height={190}
          series={[{ name: 'Бар', color: SERIES.blue, points: SS.avail }, { name: 'Қажет', color: SERIES.orange, points: SS.req, dash: '6 4' }]} />

        <h2>5. Кестелер</h2>
        <Table caption="Эвакуация нұсқалары" head={['Нұсқа', 'Өзгерген', 't, с', 'Айырма']} rows={R.evacVariants.map((v) => [v.label, v.changed, v.result.feasible ? fmt(v.result.total, 1) : 'мүмкін емес', v.diff === null ? '—' : fmt(v.diff, 1) + ' с'])} />
        {wt.rows.length > 0 && <Table caption="Су қоры (τ қадамы 1 мин)" head={wt.head} rows={wt.rows} />}
        <Table caption="Жеке құрам" head={['θ, мин', 'Бар', 'Қажет', 'Тапшылық']} rows={R.staff.steps.map((s) => [`${fmt(s.from)} – ${fmt(s.to)}`, String(s.avail), String(s.req), String(s.deficit)])} />

        <h2>6. Сценарийлерді салыстыру</h2>
        {cmp ? <Table caption={`А: ${slots.A!.name} · Б: ${slots.B!.name}`} head={['Көрсеткіш', 'А', 'Б', 'Б − А', '% (А-ға қатысты)']}
          rows={cmp.map((r) => [r.name, r.a === null ? '—' : `${fmt(r.a, 2)} ${r.unit}`, r.b === null ? '—' : `${fmt(r.b, 2)} ${r.unit}`, r.diff === null ? '—' : fmt(r.diff, 2), r.diffPct === null ? '—' : fmt(r.diffPct, 2) + ' %'])} />
          : <p className="muted">А және Б сценарийлері таңдалмаған («Сценарийлерді салыстыру» бөлімі).</p>}

        <h2>7. Формулалар және сандарды қою</h2>
        <div className="fgrid report-f">{cards.map((c) => <FormulaCardView key={c.id} c={c} />)}</div>

        <h2>8. Модельдік шарттар мен шектеулер</h2>
        <ul>{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
      </article>
    </>
  );
}
