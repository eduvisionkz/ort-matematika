import { useScenario, useTime } from '../state/store';
import { snapshotAt } from '../engine/compute';
import { fmt } from '../engine/num';

const TRUCK_KK = { station: 'бөлімде', gather: 'шақыртуды қабылдау, жиналу', driving: 'жолда', prep: 'су беруге дайындалу', water: 'су беріп жатыр' } as const;
const PHASE_KK = { wait: 'шығуға дайындалу', walk: 'жүріп келеді', pass: 'есіктен өтіп жатыр', done: 'шығып болды', blocked: 'есептелмейді' } as const;

/** 3D үстіндегі ықшам көрсеткіштер: таңдалған есептің ағымдағы сәті. */
export function SceneHud() {
  const { results: R, mode } = useScenario();
  const { t } = useTime();
  const s = snapshotAt(R, mode, t);
  const items: { k: string; v: string; e?: string; warn?: boolean }[] = [];
  const mi = R.modes[mode];
  items.push({ k: mi.title, v: mi.unit === 'min' ? `${fmt(t / 60, 2)} мин` : `${fmt(t, 0)} с` });
  if (s.fire) {
    items.push({ k: 'Өрт ауданы', v: `${fmt(s.fire.S, 2)} м²`, e: s.fire.limited ? `қабырғаға жетті (r = ${fmt(s.fire.rMax)} м)` : `r = ${fmt(s.fire.r, 2)} м`, warn: s.fire.limited });
    if (s.truck) items.push({ k: 'Өрт автомобилі', v: TRUCK_KK[s.truck.phase] });
  }
  for (const g of s.groups) items.push({ k: `${g.path === 'r1' ? '1' : '2'}-бағыт · ${g.N} адам`, v: `шықты ${g.exited}`, e: g.phase === 'pass' ? `кезекте ${g.queue}` : PHASE_KK[g.phase], warn: g.phase === 'blocked' });
  for (const tk of s.tanks.filter((x) => x.present)) items.push({ k: tk.id === 'kamaz' ? 'КамАЗ АЦ-5' : 'Урал АЦ-6', v: `${fmt(Math.round(tk.V), 0)} л`, e: tk.flow > 0 ? `беріп жатыр ${fmt(tk.flow, 2)} л/с` : tk.V <= 0 ? 'бос' : 'күтіп тұр', warn: tk.V <= 0 });
  if (s.refill) items.push({ k: 'Толықтыру', v: s.refill.on ? `${fmt(R.params.refill.qIn, 2)} л/с` : 'әлі басталған жоқ', warn: s.refill.empty && !s.refill.on });
  if (s.staff) { const st = R.tasks.staff; items.push({ k: 'Қажет / бар', v: `${st.P} / ${R.params.staff.avail}`, e: st.deficit > 0 ? `айырма ${st.deficit} адам` : 'жеткілікті', warn: st.deficit > 0 }); }
  return (
    <div className="hud" aria-live="off">
      {items.map((x, i) => <div key={i} className={`hud-item ${x.warn ? 'warn' : ''}`}><span>{x.k}</span><b>{x.v}</b>{x.e && <em>{x.e}</em>}</div>)}
    </div>
  );
}
