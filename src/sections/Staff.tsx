import { useScenario, useTime } from '../state/store';
import { Section, NumField, Metric, Note, Tag } from '../components/ui';
import { LineChart, Table, SERIES } from '../components/Chart';
import { fmt } from '../engine/num';
import { snapshotAt } from '../engine/compute';
import { staffSeries } from '../engine/tables';
import { FormulaBtn } from './common';

export function Staff() {
  const { params: p, results: R, update } = useScenario();
  const time = useTime();
  const snap = snapshotAt(R, time.t);
  const st = R.staff;
  const S = staffSeries(R);
  const totalReq = p.staff.tasks.reduce((a, t) => a + t.count, 0);
  return (
    <>
      <Section title="Жеке құрам" right={<FormulaBtn id="staff" />}>
        <div className="grid2">
          <NumField label="Жалпы штат" value={p.staff.total} unit="адам" status="given" integer step={1} max={500} onChange={(v) => update((x) => { x.staff.total = v; })} hint="4 өрт сөндіруші, 4 бөлімше командирі, 5 жүргізуші, 1 басшы" />
          <NumField label="Алғашқы экипаж" value={p.staff.initial} unit="адам" status="given" integer step={1} max={500} onChange={(v) => update((x) => { x.staff.initial = v; })} hint="Шағын өртте: өрт сөндіруші, командир, жүргізуші" />
        </div>
        <h4>Қосымша келгендер (θ — бірінші экипаж келгеннен бастап)</h4>
        {p.staff.extra.map((e, i) => (
          <div key={i} className="grid3">
            <NumField label="θ" value={e.atMin} unit="мин" status="model" step={1} max={1440} onChange={(v) => update((x) => { x.staff.extra[i].atMin = v; })} />
            <NumField label="Саны" value={e.count} unit="адам" status="model" integer step={1} max={100} onChange={(v) => update((x) => { x.staff.extra[i].count = v; })} />
            <button className="btn ghost small" onClick={() => update((x) => { x.staff.extra.splice(i, 1); })}>Жою</button>
          </div>
        ))}
        <button className="btn small" onClick={() => update((x) => { x.staff.extra.push({ atMin: 10, count: 1 }); })} disabled={p.staff.extra.length >= 6}>+ Қосымша топ</button>
        <Note>Жалпы штат (14) кезекшілер немесе келгендер саны емес. 14 − 3 айырмасы 11 адамның бірден шығуға дайын екенін дәлелдемейді.</Note>
      </Section>

      <Section title="Міндеттер матрицасы (шартты)">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Міндет</th><th>Адам</th><th>Басталуы θ, мин</th><th>Қазір бекітілгені</th></tr></thead>
            <tbody>
              {p.staff.tasks.map((t, i) => {
                const row = snap.staff.rows[i];
                return (
                  <tr key={t.id}>
                    <td><input className="cell-input" value={t.name} onChange={(e) => update((x) => { x.staff.tasks[i].name = e.target.value; })} /></td>
                    <td><input className="cell-input num" inputMode="numeric" value={t.count} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 100) update((x) => { x.staff.tasks[i].count = n; }); }} /></td>
                    <td><input className="cell-input num" inputMode="decimal" value={t.fromMin} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n) && n >= 0) update((x) => { x.staff.tasks[i].fromMin = n; }); }} /></td>
                    <td>{row ? `${row.assigned} / ${row.need}${row.missing ? ` (жетіспейді ${row.missing})` : ''}` : '—'}</td>
                  </tr>
                );
              })}
              <tr className="total"><td>Барлығы</td><td>{totalReq}</td><td /><td /></tr>
            </tbody>
          </table>
        </div>
        <div className="seg">
          <button className="btn small" onClick={() => update((x) => { x.staff.tasks.push({ id: 't' + Date.now(), name: 'Жаңа міндет', count: 1, fromMin: 0 }); })} disabled={p.staff.tasks.length >= 10}>+ Міндет</button>
          <button className="btn small ghost" onClick={() => update((x) => { x.staff.tasks.pop(); })} disabled={p.staff.tasks.length <= 1}>Соңғысын жою</button>
        </div>
        <Note>Бұл — математикалық зерттеуге арналған міндеттердің шартты бөлінуі, өрт бөлімшесінің нормативтік құрамы емес. Бір қызметкерге бір мезгілде тек бір міндет бекітіледі; бір адам бірнеше тәуелсіз позицияда көрсетілмейді.</Note>
      </Section>

      <Section title="Көрсеткіштер">
        <div className="metrics">
          <Metric label="Жалпы штат" value={`${p.staff.total}`} status="given" />
          <Metric label="Алғашқы келгендер" value={`${p.staff.initial}`} status="given" />
          <Metric label="Қосымша келгендер" value={`${p.staff.extra.reduce((a, e) => a + e.count, 0)}`} status="model" />
          <Metric label="Қазір бар (θ)" value={snap.theta < 0 ? 'әлі келген жоқ' : `${snap.staff.avail}`} sub={`θ = ${fmt(snap.theta, 2)} мин`} />
          <Metric label="Қазір бос емес" value={snap.theta < 0 ? '—' : `${snap.staff.avail - snap.staff.idle}`} />
          <Metric label="Модельдік қажеттілік" value={snap.theta < 0 ? `${st.initialReq}` : `${snap.staff.req}`} status="model" />
          <Metric label="Тапшылық Dадам" value={snap.theta < 0 ? `${st.initialDeficit} (келгенде)` : `${snap.staff.deficit}`} tone={(snap.theta < 0 ? st.initialDeficit : snap.staff.deficit) > 0 ? 'bad' : 'ok'} />
        </div>
        <LineChart title="Бар және қажет адамдар" xLabel="θ, мин (бірінші экипаж келгеннен)" yLabel="адам" yUnit="адам" xUnit="мин" xMax={p.staff.workMin}
          series={[{ name: 'Бар Nбар(θ)', color: SERIES.blue, points: S.avail, area: true }, { name: 'Қажет Nқажет(θ)', color: SERIES.orange, points: S.req, dash: '6 4' }]}
          timeToX={(t) => t - R.tFirstArrival} />
        <Table caption={`Бақылау: қажет ${st.initialReq} адам`} head={['Бар адам', 'Dадам = max(0; Nқажет − Nбар)']} rows={st.control.map((c) => [String(c.avail), String(c.deficit)])} />
        <Note>Су тапшылығы мен жеке құрам тапшылығы — әртүрлі шектеулер: біреуін жою екіншісін жоймайды. <Tag s="model" short /></Note>
      </Section>
    </>
  );
}
