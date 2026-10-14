import { timeStore, useScenario, useTime } from '../state/store';
import { fmt } from '../engine/num';

export function Timeline() {
  const time = useTime();
  const { results: R, resetDefaults } = useScenario();
  const { t, playing, speed, tEnd } = time;
  const tau = R.ts === null ? null : t - R.ts;
  const marks = [
    { x: R.tFirstArrival, label: 'келу', cls: 'm-arr' },
    ...(R.ts !== null ? [{ x: R.ts, label: 'су беру басы', cls: 'm-start' }] : []),
    ...(R.ts !== null && R.water?.firstShortfall != null ? [{ x: R.ts + R.water.firstShortfall, label: 'жетіспеушілік', cls: 'm-short' }] : []),
    ...(Number.isFinite(R.evac.total) ? [{ x: R.evac.total / 60, label: 'учаске', cls: 'm-evac' }] : []),
  ].filter((m) => m.x >= 0 && m.x <= tEnd).sort((a, b) => a.x - b.x);
  let lastLabeled = -Infinity;
  const shown = marks.map((m) => { const show = (m.x - lastLabeled) / tEnd > 0.09; if (show) lastLabeled = m.x; return { ...m, show }; });

  const primary = playing
    ? <button className="btn primary" onClick={() => timeStore.set({ playing: false })}>❚❚ Кідірту</button>
    : t <= 0
      ? <button className="btn primary" onClick={() => timeStore.set({ playing: true })}>▶ Бастау</button>
      : t >= tEnd
        ? <button className="btn primary" onClick={() => timeStore.set({ t: 0, playing: true })}>▶ Бастау</button>
        : <button className="btn primary" onClick={() => timeStore.set({ playing: true })}>▶ Жалғастыру</button>;

  return (
    <div className="timeline" role="group" aria-label="Уақыт шкаласы">
      <div className="tl-buttons">
        {primary}
        <button className="btn" onClick={() => timeStore.set({ t: 0, playing: true })} title="t = 0 сәтінен қайта ойнату">↺ Қайта бастау</button>
        <button className="btn ghost" onClick={resetDefaults} title="Барлық параметрді бастапқы мәндерге қайтару">Бастапқы мәндер</button>
        <label className="speed">Жылдамдық
          <select value={speed} onChange={(e) => timeStore.set({ speed: Number(e.target.value) })}>
            {[1, 5, 10, 30, 60, 120].map((s) => <option key={s} value={s}>×{s}</option>)}
          </select>
        </label>
      </div>
      <div className="tl-track">
        <input type="range" min={0} max={tEnd} step={0.01} value={t} aria-label="Уақытты айналдыру"
          onChange={(e) => timeStore.set({ t: Number(e.target.value), playing: false })} />
        <div className="tl-marks" aria-hidden>
          {shown.map((m, i) => <span key={i} className={`tl-mark ${m.cls}`} style={{ left: `${(m.x / tEnd) * 100}%` }} title={m.label}><em>{m.show ? m.label : ''}</em></span>)}
        </div>
      </div>
      <div className="tl-read">
        <b>t = {fmt(t, 2)} мин</b> <span className="muted">(t = 0 — хабарлау басы)</span>
        <span className="sep">·</span>
        <b>τ = {tau === null ? '—' : tau < 0 ? `су беру ${fmt(-tau, 2)} мин кейін басталады` : `${fmt(tau, 2)} мин`}</b> <span className="muted">(τ = 0 — су беру басы)</span>
        <span className="sep">·</span>
        <span>{fmt(t * 60, 0)} с</span>
        <span className="muted"> / {fmt(tEnd, 0)} мин</span>
      </div>
    </div>
  );
}
