import { useScenario } from '../state/store';
import { Section, Tag, NumField, Note } from '../components/ui';
import { SOURCE_ITEMS } from '../data/sourceData';
import { STATUS_LABEL, Status } from '../engine/types';

export function Source() {
  const { params: p, update } = useScenario();
  return (
    <>
      <Section title="Деректердің мәртебесі">
        <div className="status-legend">
          {(Object.keys(STATUS_LABEL) as Status[]).filter((s) => s !== 'clarify').map((s) => <Tag key={s} s={s} />)}
        </div>
        <Note>Деректер «Өрт сөндіру ісіндегі математика» зерттеу жұмысында сипатталғандай берілген: мектеп жоспарлары мен фотосуреттері, мектеп өкілінің 13.10.2026 күнгі мәліметтері, жедел жоспар және жұмыстағы есептік шарттар (2, 4, 13, 15, 16-кестелер).</Note>
      </Section>
      <Section title="Негізгі параметрлер (өңдеуге болады)">
        <div className="grid3">
          <div>
            <span className="field-label">Күндізгі адам саны <Tag s="given" short /></span>
            <div className="seg">
              {[450, 590].map((n) => <button key={n} className={`btn ${p.intensity.people === n ? 'primary' : ''}`} onClick={() => update((x) => { x.intensity.people = n; })}>{n}</button>)}
            </div>
            <NumField label="басқа мән" value={p.intensity.people} unit="адам" integer step={10} max={5000} onChange={(v) => update((x) => { x.intensity.people = v; })} hint="Қолданылады: R = N/T («Эвакуация»)" />
          </div>
          <NumField label="Эвакуацияға берілген уақыт T" value={p.intensity.T} unit="мин" status="given" step={0.5} max={120} onChange={(v) => update((x) => { x.intensity.T = v; })} hint="Жедел жоспар бойынша 5 мин; R = N/T үшін" />
          <NumField label="Шығулар саны" value={p.intensity.exits} unit="" status="given" integer step={1} max={20} onChange={(v) => update((x) => { x.intensity.exits = v; })} hint="4 негізгі + 1 қосалқы = 5" />
          <NumField label="КАМАЗ АЦ-5: V₀" value={p.trucks[0].v0} unit="л" status="model" step={100} max={20000} onChange={(v) => update((x) => { x.trucks[0].v0 = v; })} hint="АЦ-5 атауы бойынша есептік көлем" />
          <NumField label="Урал АЦ-6: V₀" value={p.trucks[1].v0} unit="л" status="model" step={100} max={20000} onChange={(v) => update((x) => { x.trucks[1].v0 = v; })} hint="АЦ-6 атауы бойынша есептік көлем («6 т су»)" />
          <div>
            <span className="field-label">Жол уақытының көзі</span>
            <div className="seg col">
              <button className={`btn ${p.response.travelSource === 'participant' ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travelSource = 'participant'; x.response.travel = 2; })}>Мектеп өкілі: 1–2 мин (2 мин)</button>
              <button className={`btn ${p.response.travelSource === 'document' ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travelSource = 'document'; x.response.travel = 3; })}>Жедел жоспар: 3 мин</button>
              <button className={`btn ${p.response.travelSource === 'custom' ? 'primary' : ''}`} onClick={() => update((x) => { x.response.travelSource = 'custom'; })}>Модельдік мән</button>
            </div>
            <span className="field-hint">3 мин — құжаттық сценарий, 1–2 мин — мектеп өкілінің бағалауы.</span>
          </div>
        </div>
      </Section>
      <Section title="Бастапқы мәліметтер тізілімі">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Топ</th><th>Көрсеткіш</th><th>Мәні</th><th>Мәртебе</th><th>Дереккөзі</th><th>Қай есептеуде қолданылады</th></tr></thead>
            <tbody>{SOURCE_ITEMS.map((s, i) => <tr key={i}><td>{s.group}</td><td>{s.name}</td><td><b>{s.value}</b></td><td><Tag s={s.status} /></td><td>{s.source}</td><td>{s.usedIn}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
