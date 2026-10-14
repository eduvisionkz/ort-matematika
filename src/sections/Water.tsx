import { useState } from 'react';
import { useScenario, useTime } from '../state/store';
import { Section, NumField, Metric, Note, Toggle } from '../components/ui';
import { LineChart, Table, SERIES } from '../components/Chart';
import { fmt, fmtMin } from '../engine/num';
import { supplyDuration, waterDeficit, sensitivity, piecewise, availableVolume, refillDuration, delayedRefillDuration } from '../engine/water';
import { waterSeries, tqCurve, sensitivityTable, currentGapVariants } from '../engine/tables';
import { snapshotAt } from '../engine/compute';
import { FormulaBtn } from './common';

export function Water() {
  const { params: p, results: R, update, applyPreset } = useScenario();
  const time = useTime();
  const snap = snapshotAt(R, time.t);
  const ws = R.waterSummary;
  const S = waterSeries(R);
  const w = R.water;
  const tauNow = (t: number) => (R.ts === null ? null : t - R.ts);
  const [vols, setVols] = useState('2700, 4500, 7200');
  const [qs, setQs] = useState('5, 10, 15');
  const parseList = (s: string) => s.split(/[;,\s]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => Number.isFinite(x) && x >= 0).slice(0, 8);
  const sens = sensitivity(p.research.vd, p.research.q0, p.research.q1);
  const pw = piecewise(p.research.vd, p.research.pieces);
  const gv = currentGapVariants(R);
  const tangent: [number, number][] = sens.d !== null && sens.T0 !== null ? [[Math.max(1, p.research.q0 - 4), sens.T0 + sens.d * (Math.max(1, p.research.q0 - 4) - p.research.q0)], [p.research.q0 + 6, sens.T0 + sens.d * 6]] : [];

  return (
    <>
      <Section title="Дайын мысалдар">
        <div className="seg">
          <button className="btn" onClick={() => applyPreset('base')}>Негізгі (4500 л, 10 л/с)</button>
          <button className="btn" onClick={() => applyPreset('two')}>Екі машина, 14 л/с</button>
          <button className="btn" onClick={() => applyPreset('delayed')}>Кешіктірілген толықтыру</button>
          <button className="btn" onClick={() => applyPreset('gap')}>Үзіліс (9-мин)</button>
          <button className="btn" onClick={() => applyPreset('combined')}>Біріккен сценарий</button>
        </div>
      </Section>

      <Section title="Машиналардың суы" right={<FormulaBtn id="vd" />}>
        {p.trucks.map((t, i) => {
          const tt = R.trucks[i];
          return (
            <div key={t.id} className={`route-box ${t.participates ? '' : 'off'}`}>
              <Toggle label={<b>{t.name} — қатысады</b>} checked={t.participates} onChange={(v) => update((x) => { x.trucks[i].participates = v; })} />
              <div className="grid3">
                <NumField label="V₀" value={t.v0} unit="л" status="model" step={100} max={20000} onChange={(v) => update((x) => { x.trucks[i].v0 = v; })} disabled={!t.participates} />
                <NumField label="Есептік сақталатын үлес Vқ" value={t.reservePct} unit="%" status="model" step={5} max={100} onChange={(v) => update((x) => { x.trucks[i].reservePct = v; })} disabled={!t.participates} />
                <NumField label="Бекітілген шығын Qᵢ" value={t.flowLps} unit="л/с" status="model" step={1} max={200} onChange={(v) => update((x) => { x.trucks[i].flowLps = v; })} disabled={!t.participates} />
              </div>
              <p className="small">Қол жетімді: <b>{fmt(tt.vd)} л</b>, резерв {fmt(tt.reserve)} л; дайындығы t = {fmtMin(tt.ready)}{tt.tauReady !== null ? ` (τ = ${fmt(tt.tauReady, 2)})` : ''}.</p>
            </div>
          );
        })}
        <NumField label="Су берудің берілген ұзақтығы T" value={p.water.demandMin} unit="мин" status="model" step={1} max={600} onChange={(v) => update((x) => { x.water.demandMin = v; })} hint="τ бойынша; өртті сөндіру уақыты емес" />
        <Note>Талап етілетін жалпы шығын Q = ΣQᵢ (қатысатын машиналарға бекітілген желілер). Су ортақ қордан беріледі; екінші машинаның суы ол дайын болғанда ғана қосылады (лезде қосу — жеңілдету). Сақталатын үлес Vқ = 10 % — өзгертуге болатын модельдік шарт, міндетті норматив емес.</Note>
      </Section>

      <Section title="Су көзінен толықтыру" right={<FormulaBtn id="refill" />}>
        <Toggle label="Шартты гидранттан толықтыру (стадион маңы, ≈50 м — мектеп өкілінің мәліметі)" checked={p.water.hydrant.enabled} onChange={(v) => update((x) => { x.water.hydrant.enabled = v; })} />
        <div className="grid2">
          <NumField label="Қосылу кідірісі (су беру басынан)" value={p.water.hydrant.delayMin} unit="мин" status="model" step={0.5} max={600} onChange={(v) => update((x) => { x.water.hydrant.delayMin = v; })} disabled={!p.water.hydrant.enabled} />
          <NumField label="Нақты кіріс шығыны Qкіріс" value={p.water.hydrant.qIn} unit="л/с" status="model" step={1} max={200} onChange={(v) => update((x) => { x.water.hydrant.qIn = v; })} disabled={!p.water.hydrant.enabled} hint="Шартты мән; 55 л/с — жедел жоспардағы желі мәні" />
        </div>
        {p.water.hydrant.enabled && p.water.hydrant.qIn >= ws.qReq && ws.qReq > 0 && <Note tone="warn">Qкіріс ≥ Qшығу: үздіксіз сумен жабдықтау кезіндегі шартты баланс. Қор тек сыйымдылыққа дейін өседі; бұл шексіз сөндіру мүмкіндігін білдірмейді.</Note>}
      </Section>

      <Section title="Нәтижелер (ағымдағы сценарий)" right={<FormulaBtn id="deficit" label="Тапшылық" />}>
        <div className="metrics">
          <Metric label="Q = ΣQᵢ" value={ws.qReq > 0 ? `${fmt(ws.qReq)} л/с` : 'Су шығыны жоқ'} status="model" />
          <Metric label="Қол жетімді / Vқ" value={`${fmt(ws.vdTotal)} л`} sub={`Vқ ${fmt(ws.reserveTotal)} л (пайдаланылмайды)`} />
          <Metric label="T = Vп/(60Q), толықтырусыз" value={ws.qReq > 0 ? fmtMin(ws.durationAllStock) : 'Су шығыны жоқ'} sub="барлық машина бірден дайын болса" />
          <Metric label="Берілген шығын қамтылды" value={ws.supported === null ? '—' : `τ = ${fmtMin(ws.supported)}`} tone={w?.firstShortfall != null ? 'warn' : 'ok'}
            sub={w?.firstShortfall != null && R.ts !== null ? `жалпы шкалада t = ${fmt(R.ts + w.firstShortfall, 2)} мин` : 'бүкіл кезеңде'} />
          <Metric label="Vқаж = 60QT" value={`${fmt(ws.req)} л`} />
          <Metric label="ΔV (толықтырусыз)" value={`${fmt(ws.deficitSimple)} л`} tone={ws.deficitSimple > 0 ? 'bad' : 'ok'} sub={ws.deficitPct === null ? '' : `${fmt(ws.deficitPct, 2)} % қажеттен`} />
          <Metric label="Қамтылмаған (уақыт моделі)" value={w ? `${fmt(w.totals.unmet)} л` : '—'} tone={w && w.totals.unmet > 0 ? 'bad' : 'ok'} sub="толықтыру мен кешігуді ескереді" />
          <Metric label="Қазір (t)" value={snap.water && snap.water.tau >= 0 ? `${fmt(snap.water.V, 0)} л` : 'су беру басталмаған'} sub={snap.water && snap.water.tau >= 0 ? `сұралған ${fmt(snap.water.qReq, 1)} / нақты ${fmt(snap.water.qOut, 1)} л/с` : ''} />
        </div>
        {S && w && (
          <>
            <LineChart title="Қол жетімді су және сақталатын үлес Vқ" xLabel="τ, мин (су беру басынан)" yLabel="литр" yUnit="л" xUnit="мин" xMax={w.T}
              series={[{ name: 'Қол жетімді V(τ)', color: SERIES.blue, points: S.V, area: true }, { name: 'Vқ — сақталатын үлес (бөлек)', color: SERIES.gray, points: S.res, dash: '5 4' }]}
              markers={[...(w.firstShortfall !== null ? [{ x: w.firstShortfall, label: 'жетіспеушілік', color: SERIES.orange }] : []), ...(p.water.hydrant.enabled ? [{ x: p.water.hydrant.delayMin, label: 'гидрант', color: SERIES.aqua }] : [])]}
              timeToX={tauNow} />
            <LineChart title="Шығын: сұралған, нақты және кіріс" xLabel="τ, мин" yLabel="л/с" yUnit="л/с" xUnit="мин" xMax={w.T} height={200}
              series={[{ name: 'Сұралған', color: SERIES.gray, points: S.qReq, dash: '6 4' }, { name: 'Нақты беру', color: SERIES.blue, points: S.qOut }, { name: 'Кіріс (гидрант)', color: SERIES.aqua, points: S.qIn }]}
              timeToX={tauNow} />
            {w.gaps.length > 0 && <Table caption="Су берудегі жетіспеушілік аралықтары" head={['τ басы, мин', 'τ соңы, мин', 'Түрі', 'Қамтылмаған, л']}
              rows={w.gaps.map((g) => [fmt(g.from, 2), fmt(g.to, 2), g.full ? 'толық үзіліс' : 'ішінара (кіріспен шектелген)', fmt(g.unmet, 0)])} />}
          </>
        )}
        <Note>Су беру ұзақтығы — өртті толық сөндіру уақыты емес. Қол жетімді су біткенде сызба мен анимацияда сұралған шығын енді қамтылмайтыны көрсетіледі.</Note>
      </Section>

      <Section title="Бақылау мысалдары">
        <Table caption="Vп = 4500 л, T = 10 мин" head={['Q, л/с', 'T = Vп/(60Q), мин', 'Vқаж, л', 'ΔV, л', 'ΔV, %']}
          rows={[5, 10, 15].map((q) => { const d = waterDeficit(4500, q, 10); return [fmt(q), fmt(supplyDuration(4500, q), 2), fmt(d.req), fmt(d.D), d.Dpct === null ? '—' : fmt(d.Dpct, 2)]; })} />
        <Table caption="9-кесте. Екі автоцистернаның есептік қоры (Q = 14 л/с)" head={['Есептік қор', 'Толық көлем, л', 'Толық қордағы T, мин', '90 % қор, л', '90 % қордағы T, мин', '10 мин тапшылық, л']}
          rows={([['АЦ-5', 5000], ['АЦ-6', 6000], ['Екеуі бірге', 11000]] as const).map(([n, v]) => { const vp = availableVolume(v, 10); return [n, fmt(v), fmt(supplyDuration(v, 14), 2), fmt(vp), fmt(supplyDuration(vp, 14), 2), fmt(waterDeficit(vp, 14, 10).D)]; })} />
        <p className="small muted">Екі машинаның 9900 л қоры тек екеуі де су беруге дайын болса қолданылады.</p>
        <Table caption="10-кесте. Гидранттан толықтыру нұсқалары (5400 л, Qшығ = 14 л/с)" head={['Шартты Qкір, л/с', 'Бірден қосылса', '3 мин кешіксе']}
          rows={[0, 5, 10, 14, 55].map((qin) => {
            const now = refillDuration(5400, 14, qin);
            const late = delayedRefillDuration(5400, 14, 3, qin).total;
            const txt = (x: number | null) => (x === null ? (qin === 14 ? 'Баланс: қор кемімейді' : 'Қор ұлғаяды; сыйымдылықпен шектеледі') : `${fmt(x, 2)} мин`);
            return [qin === 55 ? '55 (жедел жоспардағы желі мәні)' : fmt(qin), txt(now), qin === 0 ? `${fmt(supplyDuration(5400, 14), 2)} мин` : txt(late)];
          })} />
        <Table caption={`Келесі су көзінің дайындығы (Vп = ${fmt(gv.vd)} л, Q = ${fmt(gv.q)} л/с)`} head={['tж (τ), мин', 'G = max(0; tж − T), мин', 'Vаралық = 60QG, л', 'Уақыт моделі, л']}
          rows={gv.rows.map((g) => [fmt(g.tReady, 2), fmt(g.G, 2), fmt(g.unsupplied, 0), fmt(g.simUnmet, 0)])} />
        <div className="seg"><FormulaBtn id="gap" label="Үзіліс формуласы" /></div>
      </Section>

      <Section title="Зерттеу режимі: T(Q), туынды және сезімталдық" right={<FormulaBtn id="deriv" />}>
        <div className="grid3">
          <NumField label="Vп" value={p.research.vd} unit="л" status="model" step={100} max={100000} onChange={(v) => update((x) => { x.research.vd = v; })} />
          <NumField label="Q₀" value={p.research.q0} unit="л/с" status="model" step={1} max={200} onChange={(v) => update((x) => { x.research.q0 = v; })} />
          <NumField label="Q₁" value={p.research.q1} unit="л/с" status="model" step={1} max={200} onChange={(v) => update((x) => { x.research.q1 = v; })} />
        </div>
        <div className="metrics">
          <Metric label="T′(Q₀)" value={sens.d === null ? '—' : `${fmt(sens.d, 3)} мин/(л/с)`} />
          <Metric label="Дәл T(Q₁)" value={fmtMin(sens.T1)} />
          <Metric label="Qшек = Vп/(60 · 10 мин)" value={`${fmt(p.research.vd / 600, 2)} л/с`} sub="көлемдік шарт; өртке қажет шығын емес" />
          <Metric label="Сызықтық баға" value={fmtMin(sens.linear)} sub={sens.error === null ? '' : `айырма ${fmt(sens.error, 3)} мин`} />
        </div>
        <LineChart title="T(Q) = Vп/(60Q) және Q₀ нүктесіндегі жанама" xLabel="Q, л/с" yLabel="T, мин" yUnit="мин" xUnit="л/с" xMin={0} xMax={20} yMax={Math.min(60, (supplyDuration(p.research.vd, 2) ?? 30))}
          series={[{ name: 'T(Q) дәл', color: SERIES.blue, points: tqCurve(p.research.vd) }, { name: 'Жанама (сызықтық жуықтау)', color: SERIES.orange, points: tangent, dash: '6 4' }]}
          markers={[{ x: p.research.q0, label: 'Q₀' }, { x: p.research.q1, label: 'Q₁' }]} />
        <Note>Жанама тек Q₀ маңында жақсы жуықтайды; T(Q) қисық болғандықтан, дәл мән мен сызықтық баға ерекшеленеді.</Note>

        <h4>Кесінді-тұрақты шығын <FormulaBtn id="piece" /></h4>
        {p.research.pieces.map((pc, i) => (
          <div key={i} className="grid3">
            <NumField label={`${i + 1}-кезең ұзақтығы`} value={pc.durMin} unit="мин" step={1} max={600} onChange={(v) => update((x) => { x.research.pieces[i].durMin = v; })} />
            <NumField label="Q" value={pc.q} unit="л/с" step={1} max={200} onChange={(v) => update((x) => { x.research.pieces[i].q = v; })} />
            <button className="btn ghost small" onClick={() => update((x) => { x.research.pieces.splice(i, 1); })} disabled={p.research.pieces.length <= 1}>Жою</button>
          </div>
        ))}
        <button className="btn small" onClick={() => update((x) => { x.research.pieces.push({ durMin: 2, q: 10 }); })} disabled={p.research.pieces.length >= 8}>+ Кезең қосу</button>
        <Table head={['Аралық, мин', 'Q, л/с', 'Пайдаланылды, л', 'Қалды, л']} rows={pw.rows.map((r) => [`${fmt(r.from, 2)} – ${fmt(r.to, 2)}`, fmt(r.q), fmt(r.used, 0), fmt(r.left, 0)])} />
        <p className="small">Vпайд = 60∫Q(t)dt (уақыт — мин, шығын — л/с). Барлық ұзақтық: <b>{fmtMin(pw.total)}</b>.</p>

        <h4>Сезімталдық кестесі</h4>
        <div className="grid2">
          <label className="field"><span className="field-label">Пайдаланылатын көлемдер Vп, л (V₀ = 3000, 5000, 8000 × 90 %)</span><span className="field-input"><input value={vols} onChange={(e) => setVols(e.target.value)} /></span></label>
          <label className="field"><span className="field-label">Шығындар, л/с</span><span className="field-input"><input value={qs} onChange={(e) => setQs(e.target.value)} /></span></label>
        </div>
        {(() => { const t = sensitivityTable(parseList(vols), parseList(qs)); return <Table head={t.head} rows={t.rows} />; })()}
        <Table caption="V₀ = 5000 л, Q = 10 л/с: пайдаланылатын үлестің әсері" head={['Үлес', 'Vп, л', 'T, мин']}
          rows={[100, 90, 80].map((u) => [`${u} %`, fmt(5000 * u / 100), fmt(supplyDuration(5000 * u / 100, 10), 2)])} />
      </Section>
    </>
  );
}
