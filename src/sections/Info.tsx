// Бастапқы деректер, есептеу шарттары және жиынтық нәтижелер.
import { useState } from 'react';
import { useScenario } from '../state/store';
import { useUI } from '../state/ui';
import { Section, Note, download, ARTIFACT_MODE } from '../components/ui';
import { Table } from '../components/Chart';
import { n, u, secText } from '../components/Task';
import { PHOTOS, photoUrl } from '../data/photos';
import { fmtDateKk } from '../engine/num';
import { Results as R_ } from '../engine/compute';

const DATA: [string, string][] = [
  ['Зерттеу нысаны', 'Тұғыл ауылындағы Ш. Уәлиханов атындағы орта мектеп'],
  ['Мекенжайы', 'Желтоқсан көшесі, 32'],
  ['Мектеп', 'үш қабатты'],
  ['Өрт бөлімінен мектепке дейінгі қашықтық', '700 м'],
  ['Есепте қабылданған жол жүру уақыты', '3 минут'],
  ['Мектептегі адамдар санының негізгі нұсқасы', '450 адам'],
  ['Салыстыру нұсқасы', '590 адам'],
  ['КамАЗ АЦ-5 үшін есепке алынатын су', '5000 л'],
  ['Урал АЦ-6 үшін есепке алынатын су', '6000 л'],
  ['Екі машинаның жалпы су қоры', '11 000 л'],
  ['Алғашқы экипаж', '3 адам'],
  ['Бөлімнің жалпы құрамы туралы берілген мәлімет', '14 адам'],
];

const SHOW = ['1000302673.jpg', '1000303539.jpg', '1000303538.jpg', '1000302682.jpg'];

export function DataSection() {
  const { openPhoto } = useUI();
  return (
    <>
      <Section title="Негізгі деректер">
        <Table head={['Дерек', 'Мәні']} rows={DATA.map(([a, b]) => [a, <b key={a}>{b}</b>])} />
        <Note>14 адам — бөлімнің жалпы құрамы. Оқиға орнына алдымен 3 адамдық экипаж шығады; 14 қызметкердің бәрі бірден келеді деп есептелмейді.</Note>
        <p className="muted small">Өрт бөлімі сайтта «Тұғыл өрт бөлімі» деп аталады. Стадион маңындағы гидрант су толықтыру орны ретінде көрсетіледі.</p>
      </Section>
      <Section title="Фотосуреттер">
        <div className="thumbs">
          {SHOW.map((f) => { const p = PHOTOS.find((x) => x.file === f); return p ? (
            <button key={f} className="thumb" onClick={() => openPhoto(f)}><img src={photoUrl(p, 'thumb', true)} alt={p.title} loading="lazy" /><span>{p.title}</span></button>
          ) : null; })}
        </div>
      </Section>
      <Section title="Есептердің реті">
        <ol className="plain-list">
          <li>Бөлме ауданы: S = a × b</li>
          <li>Өрттің таралуы: r = u × t, S = π × r²</li>
          <li>Келу уақыты: v = L / t және уақыт жолағы</li>
          <li>2-қабаттан эвакуация: T = tдайындық + tжол + N / q</li>
          <li>450 және 590 адамның эвакуациясы, қажетті өткізу қарқыны</li>
          <li>Су шығыны: Q = I × S, стволдар саны</li>
          <li>Су қорының жету уақыты: T = V / (60 × Q); қажетті су: V = Q × 60 × t</li>
          <li>Су қорын толықтыру</li>
          <li>Қызметкерлерді міндеттерге бөлу: P = k × n + d + c</li>
        </ol>
      </Section>
    </>
  );
}

export function ConditionsSection() {
  const { params: p, resetDefaults } = useScenario();
  const rows: [string, string][] = [
    ['Бөлменің өлшемдері', `${n(p.room.a)} × ${n(p.room.b)} м — есепке қабылданған; фотосуреттен өлшенбеген`],
    ['Өрттің таралу жылдамдығы', `u = ${n(p.spread.u)} м/мин; π = 3,14`],
    ['Өрттің пішіні', 'бөлменің ортасынан шеңбер; есеп өрт жақын қабырғаға жеткенге дейін ғана қолданылады'],
    ['Келу кезеңдері', `қабылдау және жиналу — ${n(p.arrival.gather)} мин; жол — ${n(p.arrival.travel)} мин; су беруге дайындалу — ${n(p.arrival.prep)} мин`],
    ['Қоңырау уақыты', `тұтанудан ${n(p.arrival.delay)} мин және ${n(p.arrival.delay2)} мин кейін (екі нұсқа)`],
    ['2-қабат дәлізі', `${p.evac2.N} адам; дәліз ${n(p.evac2.Lc)} м, ${n(p.evac2.vc)} м/с; баспалдақ ${n(p.evac2.Ls)} м, ${n(p.evac2.vs)} м/с; дайындалу ${n(p.evac2.t0)} с; ${n(p.evac2.q)} адам/с`],
    ['Мектеп бойынша эвакуация', `екі тәуелсіз бағыт; дайындалу ${n(p.school.t0)} с; ең ұзақ жол ${n(p.school.Lc)} м / ${n(p.school.vc)} м/с + ${n(p.school.Ls)} м / ${n(p.school.vs)} м/с; әр бағыт ${n(p.school.q1)} және ${n(p.school.q2)} адам/с`],
    ['Эвакуация уақыты', 'дайындалу, жүру және есіктен өту уақыттарының қосындысы; нақты өткізілген эвакуацияның нәтижесі емес'],
    ['Өткізу қарқыны', '5 минутқа сәйкес есептік мән; есіктің тексерілген өткізу қабілеті емес'],
    ['Су беру қарқындылығы', `I = ${n(p.flow.I)} л/(с·м²) — есепке алынған мән, міндетті норматив емес`],
    ['Бір стволдың шығыны', `${n(p.flow.qN)} л/с`],
    ['Су шығыны нәтижесі', 'есептік шығынды көрсетеді; осы су берілсе өрт міндетті түрде сөнеді деген қорытынды жасалмайды'],
    ['Су қорының жету уақыты', 'өрттің толық сөну уақыты емес; сөну уақытын есептеуге дерек жеткіліксіз'],
    ['Екі машинаның суы', 'кезекпен (алдымен АЦ-5) немесе қатар (әрқайсысы Q/2) пайдаланылады — есеп шарты'],
    ['Толықтыру ағыны', `${n(p.refill.qIn)} л/с — есепке қабылданған ағын; гидранттың өлшенген шығыны емес`],
    ['Қызметкерлер есебі', `бір топқа ${p.staff.n} адам, басқаруға ${p.staff.c} адам — міндеттерді бөлуге арналған оқу есебі; норматив емес. Бір адам бір мезгілде бір міндетке ғана саналады`],
    ['3D көрініс', 'ғимарат жоспарлар мен фотосуреттер бойынша; өлшемдері шамамен, 700 м жол масштабсыз. Есептік бөлме мектептің жанында бөлек көрсетіледі. Бір адам белгісі бірнеше адамды білдіруі мүмкін — саны жазылады'],
  ];
  return (
    <>
      <Section title="Есептеу шарттары" right={<button className="btn small" onClick={resetDefaults}>↺ Барлық бастапқы мәнді қайтару</button>}>
        <p>Төмендегі мәндер мектепте өлшенген жоқ: оларды есептеу үшін біз қабылдадық. Әр бөлімде оларды өзгертіп, нәтижені салыстыруға болады.</p>
        <Table head={['Шама', 'Есепте']} rows={rows.map(([a, b]) => [a, b])} />
      </Section>
    </>
  );
}

function summary(R: R_): [string, string][] {
  const t = R.tasks; const p = R.params;
  return [
    ['Бөлме ауданы', u(t.area.S, 'м²')],
    [`Өрт ауданы, ${n(p.spread.t)} мин`, t.spread.now.valid ? `r = ${n(t.spread.now.r)} м; S = ${n(t.spread.now.S)} м²` : 'шеңберлік есеп қолданылмайды'],
    ['Орташа жылдамдық', u(t.arrival.v, 'км/сағ')],
    ['Қоңыраудан су беруге дейін', u(t.arrival.callToWater, 'мин')],
    ...t.arrival.cases.map((c, i) => [`${i + 1}-нұсқа: су беру басы`, `${n(c.start)}-мин; S ${c.valid ? '≈ ' + n(c.S) + ' м²' : '— қолданылмайды'}`] as [string, string]),
    [`2-қабат: ${p.evac2.N} адам, бір бағыт`, secText(t.evac2.one.T)],
    ['2-қабат: екі бағыт', secText(t.evac2.two.T)],
    ...t.school.compare.map((c) => [`${c.N} адам, тең бөлу`, secText(c.T)] as [string, string]),
    [`Қазіргі нұсқа: ${t.school.N1} / ${t.school.N2}`, secText(t.school.T)],
    ...t.school.compare.map((c) => [`5 минутқа қажет қарқын, ${c.per[0]} адам`, u(c.needQ[0], 'адам/с', 3)] as [string, string]),
    ...(t.flow.fire.valid ? [[`Су шығыны, ${n(t.flow.fire.S)} м²`, `${n(t.flow.fire.Qreq, 3)} л/с → ${t.flow.fire.n} ствол, ${u(t.flow.fire.Qact, 'л/с')}`] as [string, string]] : []),
    [`Су шығыны, ${n(t.flow.room.S)} м²`, `${n(t.flow.room.Qreq, 3)} л/с → ${t.flow.room.n ?? '—'} ствол, ${u(t.flow.room.Qact, 'л/с')}`],
    [`Су қоры: ${t.water.chosen.name}, ${n(p.water.Q)} л/с`, u(t.water.T, 'мин')],
    [`${n(p.water.Q)} л/с, ${n(p.water.tWork)} мин үшін су`, `${n(t.water.Vreq)} л`],
    ['Толықтыру бірден', t.refill.immediate.steady ? 'су қоры азаймайды' : u(t.refill.immediate.T, 'мин')],
    [`Толықтыру ${n(p.refill.delay)} мин кейін`, t.refill.delayed.emptyAt !== null ? `су ${n(t.refill.delayed.emptyAt)}-минутта таусылады` : t.refill.delayed.steady ? 'су қоры азаймайды' : u(t.refill.delayed.total, 'мин')],
    ['Қажетті адамдар, P', `${t.staff.P} адам; алғашқы экипажбен айырма ${t.staff.deficit}`],
  ];
}

export function exportCSV(R: R_) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['Көрсеткіш', 'Нәтиже'], ...summary(R)];
  const water = [['Су көлемі', ...R.tasks.water.qList.map((q) => `${n(q)} л/с, мин`)], ...R.tasks.water.table.map((r) => [`${n(r.V)} л`, ...r.T.map((x) => n(x))])];
  return '﻿' + [...rows, [], ...water].map((r) => r.map((c) => esc(String(c))).join(';')).join('\r\n');
}

export function ResultsSection() {
  const { results: R, params: p } = useScenario();
  const { snapshotPNG } = useUI();
  const [img, setImg] = useState<string | null>(null);
  const [created] = useState(() => new Date());
  return (
    <>
      <div className="seg no-print">
        {!ARTIFACT_MODE && <button className="btn primary" onClick={() => window.print()}>🖨 Басып шығару / PDF</button>}
        <button className="btn" onClick={() => download('ort-matematika-natizheler.csv', exportCSV(R), 'text/csv')}>Нәтижелер (CSV)</button>
        <button className="btn" onClick={() => download('ort-matematika-mander.json', JSON.stringify({ app: 'ort-sondiru-matematika', version: 2, params: p }, null, 2), 'application/json')}>Мәндер (JSON)</button>
        <button className="btn" onClick={() => setImg(snapshotPNG())}>3D көріністі қосу</button>
      </div>
      <div className="report">
        <h2 className="print-only">Өрт сөндіру ісіндегі математика — нәтижелер</h2>
        <p className="muted small">{fmtDateKk(created)} · Ш. Уәлиханов атындағы орта мектеп, Тұғыл ауылы · нұсқа: {p.name}</p>
        <Table head={['Көрсеткіш', 'Нәтиже']} rows={summary(R).map(([a, b]) => [a, <b key={a}>{b}</b>])} />
        <Table head={['Су көлемі', ...R.tasks.water.qList.map((q) => `${n(q)} л/с`)]} rows={R.tasks.water.table.map((r) => [`${n(r.V)} л`, ...r.T.map((x) => u(x, 'мин'))])} caption="Су қорының жету уақыты" />
        {img && <img className="report-img" src={img} alt="3D көрініс" />}
        <Note>Нәтижелер «Есептеу шарттары» бөліміндегі мәндерге тәуелді.</Note>
      </div>
    </>
  );
}
