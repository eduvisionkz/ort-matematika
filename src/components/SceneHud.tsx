import { useScenario, useTime } from '../state/store';
import { snapshotAt } from '../engine/compute';
import { fmt } from '../engine/num';
import { PHASE_KK } from '../sections/common';

/** 3D сахнасының үстіндегі ықшам көрсеткіштер (ағымдағы t сәтіне). */
export function SceneHud() {
  const { results: R, params: p } = useScenario();
  const { t } = useTime();
  const s = snapshotAt(R, t);
  const w = s.water;
  const lead = s.trucks.find((x) => x.participates);
  const short = !!w && w.tau >= 0 && w.qReq > 0 && w.qOut < w.qReq - 1e-9;
  return (
    <div className="hud" aria-live="off">
      <div className="hud-item"><span>t</span><b>{fmt(t, 2)} мин</b></div>
      <div className="hud-item"><span>Эвакуация</span><b>{s.evac.exited}/{s.evac.N}</b><em>{PHASE_KK[s.evac.phase]}</em></div>
      <div className="hud-item"><span>Машина</span><b>{lead ? PHASE_KK[lead.phase] : '—'}</b></div>
      <div className={`hud-item ${short ? 'warn' : ''}`}><span>Су, Vп</span>
        <b>{!w || w.tau < 0 ? '—' : `${fmt(w.V, 0)} л`}</b>
        <em>{!w || w.tau < 0 ? 'су беру басталмаған' : `Q ${fmt(w.qOut, 1)} / ${fmt(w.qReq, 1)} л/с`}</em></div>
      <div className={`hud-item ${s.theta >= 0 && s.staff.deficit > 0 ? 'warn' : ''}`}><span>Адам</span>
        <b>{s.theta < 0 ? '—' : `${s.staff.avail}/${s.staff.req}`}</b><em>{s.theta < 0 ? 'әлі келген жоқ' : `тапшылық ${s.staff.deficit}`}</em></div>
      <div className="hud-item"><span>Сценарий</span><b className="small">{p.name}</b></div>
    </div>
  );
}
