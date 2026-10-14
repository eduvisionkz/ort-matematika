import { useScenario, useTime } from '../state/store';
import { Section, NumField, Metric, Note, Toggle, Tag } from '../components/ui';
import { Gantt, Table, SERIES } from '../components/Chart';
import { fmt, fmtSec } from '../engine/num';
import { snapshotAt } from '../engine/compute';
import { FormulaBtn, PHASE_KK } from './common';

export function Evac() {
  const { params: p, results: R, update } = useScenario();
  const time = useTime();
  const snap = snapshotAt(R, time.t);
  const e = R.evac;
  const ro = R.routes;
  const setRoutes = (a: number, b: number, en2 = true) => update((x) => { x.routes.list[0].share = a; x.routes.list[1].share = b; x.routes.list[0].enabled = true; x.routes.list[1].enabled = en2; });
  const ganttMax = Math.max(10, Number.isFinite(e.total) ? e.total : e.t0 + 60, ...ro.routes.map((r) => (Number.isFinite(r.total) ? r.total : 0))) * 1.05;
  return (
    <>
      <Section title="Модельдік учаске: 2-қабат дәлізі → баспалдақ" right={<FormulaBtn id="evac" />}>
        <div className="grid2">
          <NumField label="L₁ — дәліз ұзындығы" value={p.evac.L1} unit="м" status="model" step={1} max={500} onChange={(v) => update((x) => { x.evac.L1 = v; })} />
          <NumField label="L₂ — баспалдақпен жол" value={p.evac.L2} unit="м" status="model" step={1} max={500} onChange={(v) => update((x) => { x.evac.L2 = v; })} hint="Қозғалыс ұзындығы, қабат биіктігі емес" />
          <NumField label="v₁ — дәліздегі жылдамдық" value={p.evac.v1} unit="м/с" status="model" step={0.1} max={5} onChange={(v) => update((x) => { x.evac.v1 = v; })} />
          <NumField label="v₂ — баспалдақтағы жылдамдық" value={p.evac.v2} unit="м/с" status="model" step={0.1} max={5} onChange={(v) => update((x) => { x.evac.v2 = v; })} />
          <NumField label="t₀ — қозғалыс басталғанға дейін" value={p.evac.t0} unit="с" status="model" step={5} max={3600} onChange={(v) => update((x) => { x.evac.t0 = v; })} />
          <NumField label="N — топ" value={p.evac.N} unit="адам" status="model" integer step={5} max={5000} onChange={(v) => update((x) => { x.evac.N = v; })} />
          <NumField label="q — өткізу қабілеті" value={p.evac.q} unit="адам/с" status="model" step={0.05} max={20} onChange={(v) => update((x) => { x.evac.q = v; })} />
        </div>
        <div className="metrics">
          <Metric label="Учаскеден өту уақыты" value={e.feasible ? fmtSec(e.total) : 'Өту мүмкін емес'} tone={e.feasible ? undefined : 'bad'} sub={e.feasible ? 'толық эвакуация уақыты емес' : e.reason} />
          <Metric label="Қазіргі кезең (t)" value={PHASE_KK[snap.evac.phase]} sub={`шықты: ${snap.evac.exited} / ${snap.evac.N} адам`} status="result" />
        </div>
        <Gantt xLabel="уақыт, с (t = 0 — хабарлау басы)" xMax={ganttMax} timeToX={(t) => t * 60}
          rows={[{ label: 'Модельдік учаске', bars: [
            { from: 0, to: e.t0, color: SERIES.gray, text: 't₀' },
            { from: e.bounds[0], to: Math.min(ganttMax, e.bounds[1]), color: SERIES.aqua, text: 'дәліз' },
            { from: e.bounds[1], to: Math.min(ganttMax, e.bounds[2]), color: SERIES.blue, text: 'баспалдақ' },
            { from: e.bounds[2], to: Math.min(ganttMax, e.total), color: SERIES.violet, text: 'N/q', hatch: !e.feasible },
          ] }]} />
        <Note>Оқу моделінде кезеңдер бірінен соң бірі қосылады: қозғалыс уақыты мен тар учаскеден өту уақыты қабаттаспайды. Анимация осы шартқа сәйкес: топ бірге қозғалады, сосын есіктен q жиілігімен бір-бірлеп шығады.</Note>
      </Section>

      <Section title="Бір параметрді өзгерту арқылы салыстыру">
        <Table head={['Нұсқа', 'Өзгерген параметр', 't, с', 'Айырма, с', 'Айырма, %']}
          rows={R.evacVariants.map((v) => [v.label, v.changed, v.result.feasible ? fmt(v.result.total, 1) : 'мүмкін емес', v.diff === null ? '—' : (v.diff > 0 ? '+' : '') + fmt(v.diff, 1), v.diffPct === null ? '—' : (v.diffPct > 0 ? '+' : '') + fmt(v.diffPct, 2) + ' %'])} />
        <p className="muted small">Әр нұсқа ағымдағы бастапқы нұсқадан тек көрсетілген параметрмен ерекшеленеді.</p>
      </Section>

      <Section title="Бірнеше маршрут" right={<FormulaBtn id="routes" />}>
        <div className="seg">
          <button className="btn" onClick={() => setRoutes(50, 50)}>30/30</button>
          <button className="btn" onClick={() => setRoutes(66.6667, 33.3333)}>40/20</button>
          <button className="btn" onClick={() => setRoutes(100, 0, false)}>Бір маршрут (60)</button>
          <button className="btn ghost" onClick={() => update((x) => { x.scene.mode = 'routes'; })}>3D-да көрсету</button>
        </div>
        <NumField label="Барлық адам" value={p.routes.N} unit="адам" status="model" integer step={5} max={5000} onChange={(v) => update((x) => { x.routes.N = v; })} />
        {p.routes.list.map((r, i) => {
          const rr = ro.routes[i];
          return (
            <div key={r.id} className={`route-box ${r.enabled ? '' : 'off'}`}>
              <Toggle label={<b>{r.name}</b>} checked={r.enabled} onChange={(v) => update((x) => { x.routes.list[i].enabled = v; })} />
              <div className="grid4">
                <NumField label="t₀" value={r.t0} unit="с" step={5} max={3600} onChange={(v) => update((x) => { x.routes.list[i].t0 = v; })} disabled={!r.enabled} />
                <NumField label="Қозғалыс" value={r.travel} unit="с" step={5} max={3600} onChange={(v) => update((x) => { x.routes.list[i].travel = v; })} disabled={!r.enabled} />
                <NumField label="q" value={r.q} unit="адам/с" step={0.05} max={20} onChange={(v) => update((x) => { x.routes.list[i].q = v; })} disabled={!r.enabled} />
                <NumField label="Үлес" value={+r.share.toFixed(2)} unit="%" step={5} max={100} onChange={(v) => update((x) => { x.routes.list[i].share = v; })} disabled={!r.enabled} />
              </div>
              <p className="small">{r.enabled ? <>Адам: <b>{rr.people}</b>; t = {Number.isFinite(rr.total) ? fmtSec(rr.total) : 'мүмкін емес'}</> : 'Шартты түрде өшірілген — адамдары басқа маршрутқа ауыстырылды. Фигуралар жабық учаске арқылы жүрмейді.'}</p>
            </div>
          );
        })}
        <Toggle label="Ағындар бір есікке жиналады (ортақ тар учаске)" checked={p.routes.commonBottleneck} onChange={(v) => update((x) => { x.routes.commonBottleneck = v; })} />
        {p.routes.commonBottleneck && <NumField label="Ортақ өткізу қабілеті" value={p.routes.qCommon} unit="адам/с" status="model" step={0.1} max={20} onChange={(v) => update((x) => { x.routes.qCommon = v; })} />}
        <div className="metrics">
          <Metric label="tжалпы = max(tᵢ)" value={ro.feasible ? fmtSec(ro.total) : 'мүмкін емес'} tone={ro.feasible ? undefined : 'bad'} sub={ro.reason ?? (ro.mode === 'common' ? 'ортақ тар учаске ескерілді' : 'маршруттар тәуелсіз')} />
          <Metric label="Бір маршрутпен" value={fmtSec(ro.singleRouteTotal)} sub={ro.increasePct === null ? '' : `ағымдағыдан ${fmt(ro.increasePct, 2)} % ұзақ`} />
        </div>
        <Note>Екі маршрут тәуелсіз деп тек ортақ тар учаске болмағанда есептеледі. Мысалы 110 → 140 с: (140 − 110)/110 × 100 % ≈ 27,27 %.</Note>
      </Section>

      <Section title="Талап етілетін орташа шығу қарқыны" right={<FormulaBtn id="intensity" />}>
        <Table head={['N, адам', 'T, мин', 'R = N/T, адам/мин', `Бір шығуға (${p.intensity.exits}), адам/мин`]}
          rows={[...R.intensity.doc.map((d) => [<span key="a">{d.people} <Tag s="given" short /></span>, fmt(p.intensity.T), fmt(d.R, 2), fmt(d.perExit, 2)]),
            ...(p.intensity.people !== 450 && p.intensity.people !== 590 ? [[String(p.intensity.people), fmt(p.intensity.T), fmt(R.intensity.R, 2), fmt(R.intensity.perExit, 2)]] : [])]} />
        <Note tone="warn">Бұл — берілген уақытқа сәйкес талап етілетін орташа қарқын. Ол шығулардың дәлелденген өткізу қабілеті емес және 5 минутта эвакуациялау мүмкіндігін растамайды. Өрт сөндірушілердің келу уақытын эвакуация уақытынан жай алып тастап «қауіпсіздік қоры» есептелмейді.</Note>
      </Section>
    </>
  );
}
