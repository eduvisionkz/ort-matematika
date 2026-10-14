import { useScenario } from '../state/store';
import { Section, NumField, Metric, Note } from '../components/ui';
import { LineChart, Table, SERIES } from '../components/Chart';
import { fmt } from '../engine/num';
import { staffSeries } from '../engine/tables';
import { FormulaBtn } from './common';

export function PersonHours() {
  const { params: p, results: R, update } = useScenario();
  const st = R.staff;
  const S = staffSeries(R);
  return (
    <>
      <Section title="Ұзақтық және адам-сағат" right={<FormulaBtn id="ph" />}>
        <div className="grid2">
          <NumField label="Жұмыс ұзақтығы" value={p.staff.workMin} unit="мин" status="model" step={5} max={1440} onChange={(v) => update((x) => { x.staff.workMin = v; })} hint="θ = 0 — бірінші экипаждың келуі" />
          <NumField label="Алғашқы экипаж" value={p.staff.initial} unit="адам" status="given" integer step={1} max={500} onChange={(v) => update((x) => { x.staff.initial = v; })} />
        </div>
        {p.staff.extra.map((e, i) => (
          <div key={i} className="grid2">
            <NumField label={`Қосымша топ ${i + 1}: θ`} value={e.atMin} unit="мин" status="model" step={1} max={1440} onChange={(v) => update((x) => { x.staff.extra[i].atMin = v; })} />
            <NumField label="Саны" value={e.count} unit="адам" status="model" integer step={1} max={100} onChange={(v) => update((x) => { x.staff.extra[i].count = v; })} />
          </div>
        ))}
        <div className="metrics">
          <Metric label="Ұзақтық" value={`${fmt(p.staff.workMin)} мин`} status="model" />
          <Metric label="Адам-сағат H" value={fmt(st.H, 2)} />
          <Metric label="Орташа саны" value={st.avg === null ? '—' : fmt(st.avg, 2)} />
          <Metric label="Ең көп саны" value={String(st.max)} />
        </div>
        <LineChart title="N(θ) — объектідегі адамдар саны" xLabel="θ, мин" yLabel="адам" yUnit="адам" xUnit="мин" xMax={p.staff.workMin}
          series={[{ name: 'N(θ)', color: SERIES.blue, points: S.avail, area: true }]} timeToX={(t) => t - R.tFirstArrival} />
        <Table head={['Аралық θ, мин', 'Nᵢ, адам', 'Δtᵢ, мин', 'Nᵢ·Δtᵢ, адам·мин']}
          rows={[...st.steps.map((s) => [`${fmt(s.from)} – ${fmt(s.to)}`, String(s.avail), fmt(s.to - s.from, 2), fmt(s.avail * (s.to - s.from), 2)]), ['Барлығы', '', fmt(p.staff.workMin), `${fmt(st.sumNt, 2)} → H = ${fmt(st.sumNt, 2)}/60 = ${fmt(st.H, 2)}`]]} />
        <Table caption="18-кесте. Адам-сағатты салыстыру" head={['Қатысу нұсқасы', 'Өткен уақыт', 'Еңбек шығыны']}
          rows={[['3 адам 60 мин', 3 * 60], ['3 адам 20 мин; 6 адам 40 мин', 3 * 20 + 6 * 40], ['6 адам 60 мин', 6 * 60]].map(([n, x]) => [n as string, '1 сағ', `${fmt((x as number) / 60, 2)} адам-сағ`])} />
        {st.cappedByTotal && <Note tone="warn">Келгендер саны жалпы штаттан асады — N(θ) {p.staff.total} адаммен шектелді.</Note>}
        <Note>Қосымша 3 адам келгенде жалпы саны 3 + 3 = 6 болады (9 емес): N(θ) — сол сәттегі объектідегі адамдардың жалпы саны. Ақшалай шығындар тарифсіз есептелмейді. Қызметкерлер санын екі есе көбейту сөндіруді екі есе қысқартады деп айтылмайды.</Note>
      </Section>
    </>
  );
}
