// Есептер: әр бөлім «Бастапқы деректер → Формула → Есептеу → Нәтиже» ретімен.
import { useScenario } from '../state/store';
import { NumField, Toggle } from '../components/ui';
import { Task, n, u, secText } from '../components/Task';
import { LineChart, Gantt, Table, SERIES } from '../components/Chart';
import { PI, routeTime, splitEqual } from '../engine/calc';
import { tanksAt } from '../engine/compute';
import { refillLevel } from '../engine/calc';
import { SceneMode } from '../engine/types';

const useCursor = (mode: SceneMode, unit: 'min' | 'sec') => {
  const { mode: cur } = useScenario();
  return (t: number) => (cur === mode ? (unit === 'min' ? t / 60 : t) : null);
};

// ---------------- 1. Бөлме ауданы ----------------
export function AreaTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const S = R.tasks.area.S;
  return (
    <Task title="Бөлме ауданы" goal="есептік бөлменің еденінің ауданы."
      onReset={() => resetGroup('room')} on3D={() => setMode('fire')}
      inputs={<>
        <NumField label="Ұзындығы, a" unit="м" value={p.room.a} min={0.5} max={60} step={0.5} onChange={(v) => update((q) => { q.room.a = v; })} />
        <NumField label="Ені, b" unit="м" value={p.room.b} min={0.5} max={60} step={0.5} onChange={(v) => update((q) => { q.room.b = v; })} />
      </>}
      formula={['S = a × b']}
      legend={[['S', 'бөлме ауданы', 'м²'], ['a', 'ұзындығы', 'м'], ['b', 'ені', 'м']]}
      steps={[<>S = {n(p.room.a)} × {n(p.room.b)} = <b>{n(S)} м²</b></>]}
      result={<>S = {n(S)} м²</>}
      explain="Ұзындықты енге көбейтеміз. 3D-дегі есептік бөлменің пішіні осы өлшемдерге сай өзгереді."
    />
  );
}

// ---------------- 2. Өрттің таралуы ----------------
export function SpreadTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const sp = R.tasks.spread; const now = sp.now;
  const cursor = useCursor('fire', 'min');
  const tl = sp.tLim ?? 0;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 50; i++) { const t = (tl * i) / 50; const r = p.spread.u * t; pts.push([t, PI * r * r]); }
  return (
    <Task title="Өрттің таралуы" goal="өрт бөлменің ортасынан шеңбер түрінде таралса, t минутта қанша ауданды қамтиды."
      onReset={() => resetGroup('spread')} on3D={() => setMode('fire')}
      inputs={<>
        <NumField label="Таралу жылдамдығы, u" unit="м/мин" value={p.spread.u} min={0} max={5} step={0.05} onChange={(v) => update((q) => { q.spread.u = v; })} />
        <NumField label="Тұтанудан кейінгі уақыт, t" unit="мин" value={p.spread.t} min={0} max={120} step={1} onChange={(v) => update((q) => { q.spread.t = v; })} />
        <p className="muted small">Бөлме: {n(p.room.a)} × {n(p.room.b)} м («Бөлме ауданы» бөлімінде өзгертіледі).</p>
      </>}
      formula={['r = u × t', 'S = π × r²']}
      legend={[['r', 'таралу радиусы', 'м'], ['u', 'есепке алынған таралу жылдамдығы', 'м/мин'], ['t', 'тұтанудан кейінгі уақыт', 'мин'], ['S', 'қамтылған аудан', 'м²'], ['π', '3,14']]}
      steps={[
        <>r = {n(p.spread.u)} × {n(p.spread.t)} = <b>{n(now.r)} м</b></>,
        <>S = 3,14 × {n(now.r)}² = <b>{n(now.S)} м²</b></>,
        <>Шек: орталықтан жақын қабырғаға дейін {n(Math.min(p.room.a, p.room.b))} : 2 = {n(sp.rMax)} м, {sp.tLim === null ? 'u = 0 болса, өрт таралмайды' : <>t ≤ {n(sp.rMax)} : {n(p.spread.u)} = {n(sp.tLim)} мин</>}</>,
      ]}
      result={now.valid ? <>t = {n(p.spread.t)} мин: r = {n(now.r)} м, S ≈ {n(now.S)} м²</> : <>t = {n(p.spread.t)} мин үшін шеңберлік есеп қолданылмайды</>}
      explain={now.valid ? 'Радиус уақытқа тура пропорционал, ал аудан радиустың квадратына пропорционал: уақыт екі есе өссе, аудан төрт есе өседі.' : undefined}
      warn={now.valid ? undefined : <>r = {n(now.r)} м — қабырғаға дейінгі {n(sp.rMax)} м-ден артық. Өрт қабырғаға {n(sp.tLim)}-минутта жетеді; одан кейін шеңбер формуласымен аудан есептелмейді.</>}
      extra={<>
        <Table head={['t, мин', 'r, м', 'S, м²']} rows={sp.table.map((x) => [n(x.t), n(x.r), x.valid ? n(x.S) : 'қолданылмайды'])} caption={`Тексеру мәндері (u = ${n(p.spread.u)} м/мин)`} />
        {sp.tLim !== null && sp.tLim > 0 && <LineChart title="S(t) = 3,14 × (u × t)²" series={[{ name: 'S, м²', color: SERIES.red, points: pts, area: true }]} xLabel="t, мин" yLabel="S, м²" xMax={tl} timeToX={(t) => { const x = cursor(t); return x === null ? null : Math.min(x, tl); }} />}
      </>}
    />
  );
}

// ---------------- 3. Келу уақыты ----------------
export function ArrivalTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const a = R.tasks.arrival; const ar = p.arrival;
  const cursor = useCursor('fire', 'min');
  const xMax = Math.max(...a.cases.map((c) => c.start)) + 1;
  const rows = a.cases.map((c, i) => ({
    label: `${i + 1}-нұсқа`,
    bars: [
      { from: 0, to: c.delay, color: '#f2c14e', text: 'қоңырауға дейін' },
      { from: c.delay, to: c.delay + ar.gather, color: '#f4a261', text: 'жиналу' },
      { from: c.delay + ar.gather, to: c.delay + ar.gather + ar.travel, color: '#0f8b8d', text: 'жол' },
      { from: c.delay + ar.gather + ar.travel, to: c.start, color: '#c8261c', text: 'дайындық' },
    ],
  }));
  return (
    <Task title="Өрт бөлімінің келу уақыты" goal="700 м жолдағы орташа жылдамдық және қоңыраудан су бере бастағанға дейінгі уақыт."
      onReset={() => resetGroup('arrival')} on3D={() => setMode('fire')}
      inputs={<>
        <NumField label="Қашықтық, L" unit="м" value={ar.L} min={0} max={50000} step={50} onChange={(v) => update((q) => { q.arrival.L = v; })} />
        <NumField label="Жол жүру уақыты" unit="мин" value={ar.travel} min={0} max={120} step={0.5} onChange={(v) => update((q) => { q.arrival.travel = v; })} />
        <NumField label="Шақыртуды қабылдау және жиналу" unit="мин" value={ar.gather} min={0} max={60} step={0.5} onChange={(v) => update((q) => { q.arrival.gather = v; })} />
        <NumField label="Су беруге дайындалу" unit="мин" value={ar.prep} min={0} max={60} step={0.5} onChange={(v) => update((q) => { q.arrival.prep = v; })} />
        <NumField label="1-нұсқа: тұтанудан қоңырауға дейін" unit="мин" value={ar.delay} min={0} max={60} step={0.5} onChange={(v) => update((q) => { q.arrival.delay = v; })} />
        <NumField label="2-нұсқа: тұтанудан қоңырауға дейін" unit="мин" value={ar.delay2} min={0} max={60} step={0.5} onChange={(v) => update((q) => { q.arrival.delay2 = v; })} />
      </>}
      formula={['v = L / t', 'tсу = tжиналу + tжол + tдайындық']}
      legend={[['v', 'орташа жылдамдық', 'км/сағ'], ['L', 'қашықтық', 'км'], ['t', 'жол жүру уақыты', 'сағ'], ['tсу', 'қоңыраудан су бере бастағанға дейінгі уақыт', 'мин']]}
      steps={[
        <>{n(ar.L)} м = {n(a.Lkm, 3)} км; {n(ar.travel)} мин = {n(ar.travel)} : 60 = {n(a.th, 4)} сағ</>,
        <>v = {n(a.Lkm, 3)} : {n(a.th, 4)} = <b>{a.v === null ? 'есептелмейді (t = 0)' : `${n(a.v)} км/сағ`}</b></>,
        <>tсу = {n(ar.gather)} + {n(ar.travel)} + {n(ar.prep)} = <b>{n(a.callToWater)} мин</b></>,
        ...a.cases.map((c, i) => <>{i + 1}-нұсқа: су беру {n(c.delay)} + {n(a.callToWater)} = {n(c.start)}-минутта; S = 3,14 × ({n(p.spread.u)} × {n(c.start)})² {c.valid ? <>≈ <b>{n(c.S)} м²</b></> : '— шеңберлік есеп қолданылмайды'}</>),
      ]}
      result={<>v = {u(a.v, 'км/сағ')}; қоңыраудан су беруге дейін {n(a.callToWater)} мин</>}
      explain={<>{n(a.callToWater)} минут — тек жол жүру емес: оған шақыртуды қабылдау мен жиналу және келгеннен кейін су беруге дайындалу кіреді. Қоңырау {n(Math.abs(ar.delay2 - ar.delay))} мин кешіксе, су беру де сонша кешігеді, ал есептік аудан {n(a.cases[0].S)} м²-ден {n(a.cases[1].S)} м²-ге өзгереді.</>}
      extra={<>
        <Table head={['Нұсқа', 'Қоңырау', 'Су беру басы', 'Есептік аудан']} rows={a.cases.map((c, i) => [`${i + 1}`, `${n(c.delay)}-мин`, `${n(c.start)}-мин`, c.valid ? `${n(c.S)} м²` : 'қолданылмайды'])} caption="Уақыт тұтану сәтінен есептеледі" />
        <Gantt rows={rows} xMax={xMax} xLabel="тұтанудан кейінгі уақыт, мин" timeToX={cursor} />
      </>}
    />
  );
}

// ---------------- 4. 2-қабаттан эвакуация ----------------
export function EvacTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const e = p.evac2; const one = R.tasks.evac2.one; const two = R.tasks.evac2.two; const [h1, h2] = R.tasks.evac2.half;
  return (
    <Task title="Екінші қабаттан эвакуация" goal="адамдардың 2-қабат дәлізімен және баспалдақпен шығуына кететін есептік уақыт."
      onReset={() => resetGroup('evac2')} on3D={() => setMode('evac2')}
      inputs={<>
        <NumField label="Адамдар саны, N" unit="адам" integer value={e.N} min={0} max={2000} step={1} onChange={(v) => update((q) => { q.evac2.N = v; })} />
        <NumField label="Шығуға дайындалу, tдайындық" unit="с" value={e.t0} min={0} max={3600} step={5} onChange={(v) => update((q) => { q.evac2.t0 = v; })} />
        <NumField label="Дәліздегі жол, Lдәліз" unit="м" value={e.Lc} min={0} max={500} step={1} onChange={(v) => update((q) => { q.evac2.Lc = v; })} />
        <NumField label="Дәліздегі жылдамдық, vдәліз" unit="м/с" value={e.vc} min={0} max={5} step={0.1} onChange={(v) => update((q) => { q.evac2.vc = v; })} />
        <NumField label="Баспалдақтағы жол, Lбаспалдақ" unit="м" value={e.Ls} min={0} max={200} step={1} onChange={(v) => update((q) => { q.evac2.Ls = v; })} />
        <NumField label="Баспалдақтағы жылдамдық, vбаспалдақ" unit="м/с" value={e.vs} min={0} max={5} step={0.1} onChange={(v) => update((q) => { q.evac2.vs = v; })} />
        <NumField label="Бір бағыттың өткізу қарқыны, q" unit="адам/с" value={e.q} min={0} max={20} step={0.1} onChange={(v) => update((q) => { q.evac2.q = v; })} />
        <Toggle label={`Екі тәуелсіз бағытқа бөлу (${h1} + ${h2} адам)`} checked={e.two} onChange={(v) => update((q) => { q.evac2.two = v; })} />
      </>}
      formula={['tжол = Lдәліз / vдәліз + Lбаспалдақ / vбаспалдақ', 'tөту = N / q', 'T = tдайындық + tжол + tөту']}
      legend={[['L', 'жол ұзындығы', 'м'], ['v', 'қозғалу жылдамдығы', 'м/с'], ['N', 'адамдар саны', 'адам'], ['q', 'бір секундта өтетін адамдар саны', 'адам/с'], ['tдайындық', 'шығуға дайындалу уақыты', 'с'], ['T', 'есептік жалпы уақыт', 'с']]}
      steps={[
        <>tжол = {n(e.Lc)} / {n(e.vc)} + {n(e.Ls)} / {n(e.vs)} = {n(one.tCorr)} + {n(one.tStair)} = <b>{u(one.tWalk, 'с')}</b></>,
        <>Бір бағыт: T = {n(e.t0)} + {n(one.tWalk)} + {e.N} / {n(e.q)} = <b>{secText(one.T)}</b></>,
        <>Екі бағыт ({h1} адамнан): T = {n(e.t0)} + {n(one.tWalk)} + {h1} / {n(e.q)} = <b>{secText(two.T)}</b></>,
      ]}
      result={<>{e.two ? 'Екі бағыт' : 'Бір бағыт'}: T = {secText(e.two ? two.T : one.T)}</>}
      explain={one.T === null ? 'Жылдамдық не өткізу қарқыны нөлге тең болса, уақыт есептелмейді.' : <>Алдымен адамдар шығуға дайындалады, сосын дәліз бен баспалдақты жүріп өтеді, соңында есіктен кезекпен өтеді — үш уақыт ретімен қосылады. Екі бағытқа бөлгенде кезек қысқарады: {secText(one.T)} орнына {secText(two.T)}.</>}
    />
  );
}

// ---------------- 5. 450 және 590 адам ----------------
export function SchoolTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const s = p.school; const t = R.tasks.school;
  const [d1, d2] = t.dirs;
  const uneven = [300, 150].map((N, i) => routeTime(N, s.t0, s.Lc, s.vc, s.Ls, s.vs, i ? s.q2 : s.q1).T);
  const unevenT = uneven.some((x) => x === null) ? null : Math.max(...(uneven as number[]));
  const eq450 = t.compare[0].T;
  return (
    <>
      <Task title="450 және 590 адамның эвакуациясы" goal="адамдар екі тәуелсіз бағытқа бөлінгенде мектептен шығуға кететін есептік уақыт."
        onReset={() => resetGroup('school')} on3D={() => setMode('evacAll')}
        inputs={<>
          <div className="seg"><span className="field-label">Адамдар саны:</span>
            {[450, 590].map((N) => <button key={N} className={`btn small ${s.N === N ? 'primary' : ''}`} onClick={() => update((q) => { q.school.N = N; q.school.N1 = splitEqual(N)[0]; })}>{N} адам</button>)}
          </div>
          <NumField label="Адамдар саны, N" unit="адам" integer value={s.N} min={0} max={3000} step={1} onChange={(v) => update((q) => { q.school.N = v; if (q.school.N1 > v) q.school.N1 = v; })} />
          <Toggle label="Екі бағытқа тең бөлу" checked={s.equal} onChange={(v) => update((q) => { q.school.equal = v; if (v) q.school.N1 = splitEqual(q.school.N)[0]; })} />
          {!s.equal && <NumField label="1-бағыттағы адамдар, N₁" unit="адам" integer value={s.N1} min={0} max={s.N} step={10} onChange={(v) => update((q) => { q.school.N1 = v; })} hint={`2-бағытта: ${s.N - Math.min(s.N, s.N1)} адам`} />}
          <NumField label="Шығуға дайындалу" unit="с" value={s.t0} min={0} max={3600} step={5} onChange={(v) => update((q) => { q.school.t0 = v; })} />
          <NumField label="Дәліздегі жол" unit="м" value={s.Lc} min={0} max={500} step={1} onChange={(v) => update((q) => { q.school.Lc = v; })} />
          <NumField label="Дәліздегі жылдамдық" unit="м/с" value={s.vc} min={0} max={5} step={0.1} onChange={(v) => update((q) => { q.school.vc = v; })} />
          <NumField label="Баспалдақтағы жол" unit="м" value={s.Ls} min={0} max={200} step={1} onChange={(v) => update((q) => { q.school.Ls = v; })} />
          <NumField label="Баспалдақтағы жылдамдық" unit="м/с" value={s.vs} min={0} max={5} step={0.1} onChange={(v) => update((q) => { q.school.vs = v; })} />
          <NumField label="1-бағыттың қарқыны, q₁" unit="адам/с" value={s.q1} min={0} max={20} step={0.1} onChange={(v) => update((q) => { q.school.q1 = v; })} />
          <NumField label="2-бағыттың қарқыны, q₂" unit="адам/с" value={s.q2} min={0} max={20} step={0.1} onChange={(v) => update((q) => { q.school.q2 = v; })} />
        </>}
        formula={['tжол = Lдәліз / vдәліз + Lбаспалдақ / vбаспалдақ', 'Tᵢ = tдайындық + tжол + Nᵢ / qᵢ', 'T = max(T₁; T₂)']}
        legend={[['Nᵢ', 'i-бағыттағы адамдар саны', 'адам'], ['qᵢ', 'i-бағыттың өткізу қарқыны', 'адам/с'], ['tжол', 'ең ұзақ жолды жүріп өту уақыты', 'с'], ['Tᵢ', 'i-бағыттың уақыты', 'с'], ['T', 'мектеп бойынша жалпы уақыт — екі бағыттың үлкені', 'с']]}
        steps={[
          <>tжол = {n(s.Lc)} / {n(s.vc)} + {n(s.Ls)} / {n(s.vs)} = <b>{u(t.walk, 'с')}</b></>,
          <>Бағыттарға бөлу: {t.N1} + {t.N2} = {s.N} адам</>,
          <>T₁ = {n(s.t0)} + {n(t.walk)} + {t.N1} / {n(s.q1)} = <b>{secText(d1.T)}</b></>,
          <>T₂ = {n(s.t0)} + {n(t.walk)} + {t.N2} / {n(s.q2)} = <b>{secText(d2.T)}</b></>,
          <>T = max({n(d1.T)}; {n(d2.T)}) = <b>{secText(t.T)}</b></>,
        ]}
        result={<>{s.N} адам: T = {secText(t.T)}</>}
        explain={t.diffVsEqual !== null && Math.abs(t.diffVsEqual) > 1e-9 ? <>Тең бөлгенде {secText(t.eqT)} болар еді. Тең емес бөлу уақытты {secText(t.diffVsEqual)} ұзартады: көп адам жіберілген бағыттың кезегі ұзарады.</> : 'Екі бағыт бірдей жүктелгенде олар бір мезгілде аяқталады, сондықтан жалпы уақыт ең аз болады.'}
        extra={<Table head={['Нұсқа', '1-бағыт', '2-бағыт', 'Жалпы уақыт']} caption="Салыстыру (қазіргі жол мен қарқын мәндерімен)" rows={[
          ['450 адам, тең', '225', '225', secText(eq450)],
          ['590 адам, тең', '295', '295', secText(t.compare[1].T)],
          ['450 адам, 300 / 150', secText(uneven[0]), secText(uneven[1]), <>{secText(unevenT)}{unevenT !== null && eq450 !== null ? ` (+${n(unevenT - eq450)} с)` : ''}</>],
        ]} />}
      />
      <Task title="5 минутта шығу үшін қажет өткізу қарқыны" goal="әр бағыттағы адамдар 5 минутта (300 с) шығуы үшін бір секундта қанша адам өтуі керек."
        onReset={() => resetGroup('school')} on3D={() => setMode('evacAll')}
        inputs={<>
          <NumField label="Мақсатты уақыт, Tмақсат" unit="с" value={s.Tgoal} min={0} max={7200} step={10} onChange={(v) => update((q) => { q.school.Tgoal = v; })} />
          <p className="muted small">tдайындық = {n(s.t0)} с, tжол = {u(t.walk, 'с')} — жоғарыдағы есептен.</p>
        </>}
        formula={['q = Nбағыт / (Tмақсат − tдайындық − tжол)']}
        legend={[['q', 'қажетті өткізу қарқыны', 'адам/с'], ['Nбағыт', 'бір бағыттағы адамдар саны', 'адам'], ['Tмақсат', 'мақсатты уақыт', 'с']]}
        steps={[
          <>Өтуге қалатын уақыт: {n(s.Tgoal)} − {n(s.t0)} − {n(t.walk)} = <b>{u(t.window, 'с')}</b></>,
          ...t.compare.map((c) => <>{c.N} адам ({c.per[0]} адамнан): q = {c.per[0]} / {n(t.window)} = <b>{u(c.needQ[0], 'адам/с', 3)}</b></>),
        ]}
        result={t.window !== null && t.window > 0 ? <>{t.compare.map((c) => `${c.per[0]} адам — ${n(c.needQ[0], 3)} адам/с`).join('; ')}</> : 'Мақсатты уақыт дайындалу мен жүруге жетпейді — қарқын есептелмейді'}
        explain="Бұл — 5 минутқа сәйкес келетін есептік қарқын. Ол есіктің тексерілген өткізу қабілеті де, қауіпсіздік кепілдігі де емес."
      />
    </>
  );
}

// ---------------- 6. Су шығыны ----------------
export function FlowTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const f = R.tasks.flow; const fl = p.flow;
  const one = (label: string, x: typeof f.room) => <>{label}: Qқажет = {n(fl.I)} × {n(x.S)} = {n(x.Qreq, 3)} л/с; n = ⌈{n(x.Qreq, 3)} / {n(fl.qN)}⌉ = <b>{x.n ?? '—'}</b>; Qнақты = {x.n ?? '—'} × {n(fl.qN)} = <b>{u(x.Qact, 'л/с')}</b></>;
  return (
    <Task title="Су шығыны және стволдар саны" goal="есептік ауданға қажетті су шығыны және оны беретін стволдар саны."
      onReset={() => resetGroup('flow')} on3D={() => setMode('fire')}
      inputs={<>
        <NumField label="Су беру қарқындылығы, I" unit="л/(с·м²)" value={fl.I} min={0} max={2} step={0.01} onChange={(v) => update((q) => { q.flow.I = v; })} />
        <NumField label="Бір стволдың шығыны, qствол" unit="л/с" value={fl.qN} min={0} max={50} step={0.5} onChange={(v) => update((q) => { q.flow.qN = v; })} />
        <NumField label="Өрт ауданы алынатын уақыт" unit="мин" value={fl.tFire} min={0} max={120} step={1} onChange={(v) => update((q) => { q.flow.tFire = v; })} />
      </>}
      formula={['Qқажет = I × S', 'n = ⌈Qқажет / qствол⌉', 'Qнақты = n × qствол']}
      legend={[['Qқажет', 'есептік қажетті су шығыны', 'л/с'], ['I', 'бір шаршы метрге қабылданған су беру қарқындылығы', 'л/(с·м²)'], ['S', 'есепке алынған аудан', 'м²'], ['n', 'су беру стволдарының саны'], ['qствол', 'бір стволдың су шығыны', 'л/с'], ['Qнақты', 'таңдалған стволдардың жиынтық шығыны', 'л/с'], ['⌈ ⌉', 'нәтижені жоғары қарай бүтін санға дөңгелектеу']]}
      steps={[
        f.fire.valid ? one(`Өрт ауданы (${n(fl.tFire)} мин, S = ${n(f.fire.S)} м²)`, f.fire) : <>{n(fl.tFire)}-минутта өрт қабырғаға жеткен — шеңбер ауданы есепке алынбайды</>,
        one(`Бөлме ауданы (S = ${n(f.room.S)} м²)`, f.room),
      ]}
      result={<>{f.fire.valid && <>{n(f.fire.S)} м² — {f.fire.n} ствол, {u(f.fire.Qact, 'л/с')}; </>}{n(f.room.S)} м² — {f.room.n ?? '—'} ствол, {u(f.room.Qact, 'л/с')}</>}
      explain="Ствол саны бөлшек бола алмайды, сондықтан нәтиже жоғары қарай дөңгелектеледі. Сол себепті Qнақты әрдайым Qқажет-тен кем емес."
      extra={<Table head={['Аудан', 'Qқажет, л/с', 'n', 'Qнақты, л/с']} rows={[
        ...(f.fire.valid ? [[`${n(f.fire.S)} м² (өрт, ${n(fl.tFire)} мин)`, n(f.fire.Qreq, 3), String(f.fire.n ?? '—'), n(f.fire.Qact)]] : []),
        [`${n(f.room.S)} м² (бөлме)`, n(f.room.Qreq, 3), String(f.room.n ?? '—'), n(f.room.Qact)],
      ]} />}
    />
  );
}

// ---------------- 7–8. Су қоры ----------------
export function WaterTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const w = p.water; const W = R.tasks.water;
  const cursor = useCursor('water', 'min');
  const Tend = W.T ?? 0;
  const pts5: [number, number][] = [], pts6: [number, number][] = [];
  for (let i = 0; i <= 80 && Tend > 0; i++) { const t = (Tend * i) / 80; const s = tanksAt(p, t); if (s.ac5.used) pts5.push([t, s.ac5.V]); if (s.ac6.used) pts6.push([t, s.ac6.V]); }
  const series = [...(pts5.length ? [{ name: 'КамАЗ АЦ-5', color: SERIES.blue, points: pts5 }] : []), ...(pts6.length ? [{ name: 'Урал АЦ-6', color: SERIES.orange, points: pts6 }] : [])];
  const machines = [['ac5', 'КамАЗ АЦ-5'], ['ac6', 'Урал АЦ-6'], ['both', 'Екі машина']] as const;
  return (
    <>
      <Task title="Су қорының жету уақыты" goal="цистернадағы су таңдалған шығынмен қанша минутқа жетеді."
        onReset={() => resetGroup('water')} on3D={() => setMode('water')}
        inputs={<>
          <div className="seg">{machines.map(([id, name]) => <button key={id} className={`btn small ${w.use === id ? 'primary' : ''}`} onClick={() => update((q) => { q.water.use = id; })}>{name}</button>)}</div>
          {w.use === 'both' && <div className="seg"><span className="field-label">Екі машинаның суы:</span>
            <button className={`btn small ${w.order === 'seq' ? 'primary' : ''}`} onClick={() => update((q) => { q.water.order = 'seq'; })}>кезекпен</button>
            <button className={`btn small ${w.order === 'par' ? 'primary' : ''}`} onClick={() => update((q) => { q.water.order = 'par'; })}>қатар</button></div>}
          <NumField label="Су шығыны, Q" unit="л/с" value={w.Q} min={0} max={200} step={0.5} onChange={(v) => update((q) => { q.water.Q = v; })} />
          <div className="seg">{W.qList.map((q) => <button key={q} className={`btn small ${w.Q === q ? 'primary' : ''}`} onClick={() => update((x) => { x.water.Q = q; })}>{n(q)} л/с</button>)}</div>
          <NumField label="КамАЗ АЦ-5 суы" unit="л" value={w.V5} min={0} max={50000} step={100} onChange={(v) => update((q) => { q.water.V5 = v; })} />
          <NumField label="Урал АЦ-6 суы" unit="л" value={w.V6} min={0} max={50000} step={100} onChange={(v) => update((q) => { q.water.V6 = v; })} />
        </>}
        formula={['T = V / (60 × Q)']}
        legend={[['T', 'су қорының жету уақыты', 'мин'], ['V', 'су көлемі', 'л'], ['Q', 'су шығыны', 'л/с'], ['60', 'секундты минутқа ауыстыру коэффициенті']]}
        steps={[
          <>{W.chosen.name}: V = {n(W.chosen.V)} л</>,
          <>T = {n(W.chosen.V)} / (60 × {n(w.Q)}) = {n(W.chosen.V)} / {n(60 * w.Q)} = <b>{u(W.T, 'мин')}</b></>,
        ]}
        result={W.T === null ? 'Q = 0: су жұмсалмайды, уақыт есептелмейді' : <>{W.chosen.name}, {n(w.Q)} л/с: {n(W.T)} мин</>}
        explain={<>Шығын екі есе өссе, су екі есе тез таусылады. Бұл — су қорының жету уақыты, өрттің толық сөну уақыты емес.{w.use === 'both' && (w.order === 'seq' ? ' Есеп шарты: алдымен АЦ-5 суы, сосын АЦ-6 суы пайдаланылады.' : ' Есеп шарты: екі машина қатар, әрқайсысы Q/2 береді; біреуі таусылса, екіншісі толық Q береді.')}</>}
        extra={<>
          <Table head={['Су көлемі', ...W.qList.map((q) => `${n(q)} л/с`)]} rows={W.table.map((r) => [`${n(r.V)} л (${r.name})`, ...r.T.map((x) => u(x, 'мин'))])} caption="T = V / (60 × Q), мин" />
          {series.length > 0 && <LineChart title="Цистернадағы су" series={series} xLabel="су беру басынан, мин" yLabel="V, л" xMax={Tend} timeToX={cursor} />}
        </>}
      />
      <Task title="Белгілі уақытқа қажетті су" goal="таңдалған шығынмен t минут жұмыс істеу үшін қанша су керек және қорлар жете ме."
        onReset={() => resetGroup('water')} on3D={() => setMode('water')}
        inputs={<>
          <NumField label="Су шығыны, Q" unit="л/с" value={w.Q} min={0} max={200} step={0.5} onChange={(v) => update((q) => { q.water.Q = v; })} />
          <NumField label="Жұмыс уақыты, t" unit="мин" value={w.tWork} min={0} max={600} step={1} onChange={(v) => update((q) => { q.water.tWork = v; })} />
        </>}
        formula={['Vқажет = Q × 60 × t', 'Айырма = V − Vқажет']}
        legend={[['Vқажет', 't минутқа қажетті су', 'л'], ['Q', 'су шығыны', 'л/с'], ['t', 'жұмыс уақыты', 'мин'], ['V', 'машинадағы су', 'л']]}
        steps={[
          <>Vқажет = {n(w.Q)} × 60 × {n(w.tWork)} = <b>{n(W.Vreq)} л</b></>,
          ...W.diffs.map((d) => <>{d.name}: {n(d.V)} − {n(W.Vreq)} = <b className={d.diff < 0 ? 'neg' : 'posv'}>{d.diff < 0 ? '−' : '+'}{n(Math.abs(d.diff))} л</b></>),
        ]}
        result={<>{n(W.Vreq)} л керек</>}
        explain={<>{W.diffs.map((d) => `${d.name}: ${d.diff < 0 ? `${n(-d.diff)} л жетіспейді` : d.diff > 0 ? `${n(d.diff)} л қалады` : 'дәл жетеді'}`).join('; ')}.</>}
      />
    </>
  );
}

// ---------------- 9. Толықтыру ----------------
export function RefillTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const r = p.refill; const f = R.tasks.refill; const d = f.delayed;
  const cursor = useCursor('refill', 'min');
  const end = (d.total ?? Math.max(r.delay, d.emptyAt ?? 0) + 15) + 1;
  const pts: [number, number][] = []; const ptsI: [number, number][] = [];
  for (let i = 0; i <= 120; i++) { const t = (end * i) / 120; pts.push([t, refillLevel(r.V0, r.qOut, r.qIn, r.delay, t).V]); ptsI.push([t, refillLevel(r.V0, r.qOut, r.qIn, 0, t).V]); }
  return (
    <Task title="Су қорын толықтыру" goal="су сыртқа беріліп, сонымен бірге толықтырылғанда цистернадағы су қанша уақытқа жетеді."
      onReset={() => resetGroup('refill')} on3D={() => setMode('refill')}
      inputs={<>
        <NumField label="Бастапқы су, V" unit="л" value={r.V0} min={0} max={50000} step={100} onChange={(v) => update((q) => { q.refill.V0 = v; })} />
        <NumField label="Сыртқа берілетін су, Qшығыс" unit="л/с" value={r.qOut} min={0} max={200} step={0.5} onChange={(v) => update((q) => { q.refill.qOut = v; })} />
        <NumField label="Толықтыру ағыны (есепке), Qкіріс" unit="л/с" value={r.qIn} min={0} max={200} step={0.5} onChange={(v) => update((q) => { q.refill.qIn = v; })} />
        <NumField label="Толықтыру басталатын уақыт" unit="мин" value={r.delay} min={0} max={600} step={1} onChange={(v) => update((q) => { q.refill.delay = v; })} />
      </>}
      formula={['Qазаю = Qшығыс − Qкіріс', 'T = V / (60 × Qазаю)', 'Vжұмсалған = Qшығыс × 60 × tкідіріс']}
      legend={[['Qазаю', 'судың таза азаю жылдамдығы', 'л/с'], ['Qшығыс', 'сыртқа берілетін су', 'л/с'], ['Qкіріс', 'толықтыру ағыны', 'л/с'], ['V', 'цистернадағы су', 'л'], ['T', 'судың жету уақыты', 'мин'], ['tкідіріс', 'толықтыру басталғанға дейінгі уақыт', 'мин']]}
      steps={[
        <>Qазаю = {n(r.qOut)} − {n(r.qIn)} = <b>{n(f.net)} л/с</b>{f.immediate.steady ? ' — кіріс шығыстан кем емес' : ''}</>,
        <>Толықтыру бірден басталса: {f.immediate.steady ? <b>су қоры азаймайды</b> : <>T = {n(r.V0)} / (60 × {n(f.net)}) = <b>{u(f.immediate.T, 'мин')}</b></>}</>,
        ...(d.emptyAt !== null ? [
          <>Толықтыру {n(r.delay)}-минутта басталса: су {n(r.V0)} / (60 × {n(r.qOut)}) = <b>{n(d.emptyAt)} мин</b> өткенде таусылады</>,
          <>Үзіліс: {n(d.emptyAt)} → {n(r.delay)} мин, <b>{n(d.gap)} мин</b> су берілмейді; толықтыру басталғаннан кейін {f.immediate.steady ? 'цистерна қайта толады' : `тек ${n(r.qIn)} л/с беріледі`}</>,
        ] : [
          <>Алғашқы {n(r.delay)} минутта жұмсалған су: {n(r.qOut)} × 60 × {n(r.delay)} = <b>{n(d.used)} л</b></>,
          <>Қалған су: {n(r.V0)} − {n(d.used)} = <b>{n(d.left)} л</b></>,
          d.steady ? <>Толықтыру басталғаннан кейін <b>су қоры азаймайды</b></> : <>Кейінгі уақыт: {n(d.left)} / (60 × {n(f.net)}) = <b>{u(d.tAfter, 'мин')}</b>; жалпы: {n(r.delay)} + {n(d.tAfter)} = <b>{u(d.total, 'мин')}</b></>,
        ])]}
      result={<>Бірден: {f.immediate.steady ? 'азаймайды' : u(f.immediate.T, 'мин')}; {n(r.delay)} мин кейін: {d.emptyAt !== null ? `су ${n(d.emptyAt)}-минутта таусылады, ${n(d.gap)} мин үзіліс` : d.steady ? 'азаймайды' : u(d.total, 'мин')}</>}
      explain={f.immediate.steady ? 'Кіріс ағыны шығысқа тең немесе одан үлкен: осы шарттарда су қоры азаймайды.' : 'Толықтыру су таусылуын баяулатады, ал оның кешігуі жалпы уақытты қысқартады — толықтыру басталатын сәт маңызды.'}
      extra={<LineChart title="Цистернадағы су" series={[{ name: `толықтыру ${n(r.delay)}-минутта`, color: SERIES.blue, points: pts, area: true }, { name: 'толықтыру бірден', color: SERIES.gray, points: ptsI, dash: '5 4' }]} xLabel="уақыт, мин" yLabel="V, л" xMax={end} markers={[{ x: r.delay, label: 'толықтыру' }]} timeToX={cursor} />}
    />
  );
}

// ---------------- 10. Қызметкерлер ----------------
export function StaffTask() {
  const { params: p, results: R, update, resetGroup, setMode } = useScenario();
  const s = p.staff; const t = R.tasks.staff;
  return (
    <Task title="Қызметкерлерді міндеттерге бөлу" goal="міндеттерді орындауға қанша адам керек және алғашқы экипажбен салыстырғанда айырма қандай."
      onReset={() => resetGroup('staff')} on3D={() => setMode('staff')}
      inputs={<>
        <NumField label="Су беру топтарының саны, k" integer value={s.k} min={0} max={20} step={1} onChange={(v) => update((q) => { q.staff.k = v; })} />
        <NumField label="Бір топтағы адамдар, n" unit="адам" integer value={s.n} min={0} max={20} step={1} onChange={(v) => update((q) => { q.staff.n = v; })} />
        <NumField label="Жүргізушілер, d" unit="адам" integer value={s.d} min={0} max={10} step={1} onChange={(v) => update((q) => { q.staff.d = v; })} />
        <NumField label="Басқару міндеті, c" unit="адам" integer value={s.c} min={0} max={10} step={1} onChange={(v) => update((q) => { q.staff.c = v; })} />
        <NumField label="Алғашқы экипаж" unit="адам" integer value={s.avail} min={0} max={100} step={1} onChange={(v) => update((q) => { q.staff.avail = v; })} />
      </>}
      formula={['P = k × n + d + c', 'Айырма = P − алғашқы экипаж']}
      legend={[['P', 'есеп бойынша қажетті адамдар саны', 'адам'], ['k', 'су беру топтарының саны'], ['n', 'бір топқа есепке алынған адамдар саны', 'адам'], ['d', 'жүргізушілер саны', 'адам'], ['c', 'бөлек басқару міндетіне бөлінген адамдар саны', 'адам']]}
      steps={[
        <>P = {s.k} × {s.n} + {s.d} + {s.c} = <b>{t.P}</b></>,
        <>{t.P} − {s.avail} = <b>{t.P - s.avail}</b>{t.P - s.avail > 0 ? ' адам жетіспейді' : t.P - s.avail < 0 ? ' (адам артық)' : ''}</>,
      ]}
      result={<>Қажет: {t.P} адам; алғашқы экипаж {s.avail} адам; {t.deficit > 0 ? `айырма ${t.deficit} адам` : 'адам жеткілікті'}</>}
      explain="Әр адам бір мезгілде бір ғана міндетке саналады. Бұл — міндеттерді бөлуге арналған оқу есебі."
      extra={<Table head={['Топ, k', 'Жүргізуші, d', 'Басқару, c', 'P']} caption={`Мысалдар (n = ${s.n})`} rows={t.examples.map((e) => [String(e.k), String(e.d), String(e.c), `${e.k} × ${e.n} + ${e.d} + ${e.c} = ${e.P}`])} />}
    />
  );
}

