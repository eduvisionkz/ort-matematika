import { useScenario } from '../state/store';
import { Section, NumField, Metric, Note, Toggle, Tag } from '../components/ui';
import { Gantt, Table, SERIES } from '../components/Chart';
import { fmt, fmtMin } from '../engine/num';
import { FormulaBtn } from './common';

export function Arrival() {
  const { params: p, results: R, update } = useScenario();
  const r = p.response;
  const xMax = Math.max(6, ...R.trucks.map((t) => t.ready)) * 1.1;
  return (
    <>
      <Section title="Хабарлаудан су беру басына дейін" right={<FormulaBtn id="start" />}>
        <div className="grid2">
          <NumField label="Хабарлау" value={r.msg} unit="мин" status="model" step={0.5} max={60} onChange={(v) => update((x) => { x.response.msg = v; })} />
          <NumField label="Жиналу" value={r.gather} unit="мин" status="model" step={0.5} max={60} onChange={(v) => update((x) => { x.response.gather = v; })} />
          <NumField label="Жол жүру" value={r.travel} unit="мин" status={r.travelSource === 'participant' ? 'given' : r.travelSource === 'document' ? 'given' : 'model'} step={0.5} max={60}
            onChange={(v) => update((x) => { x.response.travel = v; x.response.travelSource = 'custom'; })} hint={`Көзі: ${r.travelSource === 'participant' ? 'мектеп өкілі (1–2 мин)' : r.travelSource === 'document' ? 'құжат (3 мин)' : 'модельдік мән'}`} />
          <NumField label="Қашықтық L" value={r.distanceKm} unit="км" status="given" step={0.1} max={50} onChange={(v) => update((x) => { x.response.distanceKm = v; })} hint="700 м — мектеп өкілінің мәліметі" />
        </div>
        <div className="seg">
          <button className={`btn ${r.travelSource === 'participant' && r.travel === 1 ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travel = 1; x.response.travelSource = 'participant'; })}>Мектеп өкілі: 1 мин</button>
          <button className={`btn ${r.travelSource === 'participant' && r.travel === 2 ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travel = 2; x.response.travelSource = 'participant'; })}>Мектеп өкілі: 2 мин</button>
          <button className={`btn ${r.travelSource === 'document' ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travel = 3; x.response.travelSource = 'document'; })}>Құжат: 3 мин</button>
        </div>
        <Note>Жұмыста 3 мин — жедел жоспардағы құжаттық сценарий, 1–2 мин — мектеп өкілінің бағалауы; олар бөлек нұсқалар ретінде көрсетіледі. Жолға 1, 2 немесе 3 мин жұмсалса, су беру 4, 5 немесе 6-минутта басталады.</Note>
      </Section>

      <Section title="Машиналар: қатысуы және уақыты">
        {p.trucks.map((t, i) => {
          const tt = R.trucks[i];
          return (
            <div key={t.id} className={`route-box ${t.participates ? '' : 'off'}`}>
              <Toggle label={<b>{t.name} — сценарийге қатысады</b>} checked={t.participates} onChange={(v) => update((x) => { x.trucks[i].participates = v; })} />
              <div className="grid2">
                <NumField label="Қосымша кідіріс (жиналудан кейін)" value={t.extraDelayMin} unit="мин" status="model" step={0.5} max={240} onChange={(v) => update((x) => { x.trucks[i].extraDelayMin = v; })} disabled={!t.participates} />
                <NumField label="Су беруге дайындық" value={t.deployMin} unit="мин" status="model" step={0.5} max={120} onChange={(v) => update((x) => { x.trucks[i].deployMin = v; })} disabled={!t.participates} />
              </div>
              <p className="small">{t.participates ? <>Шығуы t = {fmtMin(tt.depart)}; <b>келуі t = {fmtMin(tt.arrival)}</b>; <b>суы дайын t = {fmtMin(tt.ready)}</b>{tt.tauReady !== null ? ` (τ = ${fmt(tt.tauReady, 2)} мин)` : ''}</> : 'Қатыспайды. Фотосуреттегі екі машинаның бары олардың бір мезгілде шығатынын білдірмейді.'}</p>
            </div>
          );
        })}
        <Gantt xLabel="t, мин (t = 0 — хабарлау басы)" xMax={xMax} timeToX={(t) => t}
          rows={R.trucks.map((t) => ({
            label: t.name, bars: t.participates ? [
              { from: 0, to: r.msg, color: SERIES.gray, text: 'хабар' },
              { from: r.msg, to: t.depart, color: SERIES.yellow, text: 'жиналу' },
              { from: t.depart, to: t.arrival, color: SERIES.blue, text: 'жол' },
              { from: t.arrival, to: t.ready, color: SERIES.aqua, text: 'дайындық' },
            ] : [],
          }))} />
        <div className="metrics">
          <Metric label="Бірінші келу" value={`t = ${fmtMin(R.tFirstArrival)}`} />
          <Metric label="Су беру басы" value={R.ts === null ? '—' : `t = ${fmtMin(R.ts)}`} sub="τ = 0 осы сәтке сәйкес" />
        </div>
      </Section>

      <Section title="Орташа жылдамдық v = 60L/t" right={<FormulaBtn id="speed" />}>
        <Table head={['t, мин', `v, км/сағ (L = ${fmt(r.distanceKm, 3)} км)`]}
          rows={[...R.response.speedTable.map((s) => [fmt(s.t), s.v === null ? '—' : fmt(s.v, 2)]), ['таңдалған: ' + fmt(r.travel), R.response.speed === null ? 'анықталмайды' : fmt(R.response.speed, 2)]]} />
        <Note>Бұл — математикалық сәйкестік, қозғалыс жылдамдығына ұсыныс емес. 3D-дегі 700 м жол схемалық, географиялық дәл маршрут емес. <Tag s="model" short /></Note>
      </Section>
    </>
  );
}
