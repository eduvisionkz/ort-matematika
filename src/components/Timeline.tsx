import { timeStore, useScenario, useTime } from '../state/store';
import { fmt } from '../engine/num';
import { SceneMode } from '../engine/types';

const MODES: [SceneMode, string][] = [['fire', 'Өрт және келу'], ['evac2', '2-қабат: эвакуация'], ['evacAll', '450 / 590 адам'], ['water', 'Су қоры'], ['refill', 'Толықтыру'], ['staff', 'Міндеттер']];
const mmss = (s: number) => { const m = Math.floor(s / 60); const r = Math.floor(s - m * 60); return `${m}:${String(r).padStart(2, '0')}`; };

export function Timeline() {
  const time = useTime();
  const { results: R, mode, setMode } = useScenario();
  const { t, playing, speed, tEnd } = time;
  const mi = R.modes[mode];
  const marks = mi.marks.filter((m) => m.t >= 0 && m.t <= tEnd).sort((a, b) => a.t - b.t);
  let last = -Infinity;
  const shown = marks.map((m) => { const show = (m.t - last) / tEnd > 0.1; if (show) last = m.t; return { ...m, show }; });
  const primary = playing
    ? <button className="btn primary" onClick={() => timeStore.set({ playing: false })}>❚❚ Кідірту</button>
    : <button className="btn primary" onClick={() => timeStore.set({ playing: true, ...(t >= tEnd ? { t: 0 } : {}) })}>▶ {t > 0 && t < tEnd ? 'Жалғастыру' : 'Бастау'}</button>;
  return (
    <div className="timeline" role="group" aria-label="Уақыт шкаласы">
      <div className="tl-buttons">
        <select value={mode === 'overview' ? 'fire' : mode} onChange={(e) => setMode(e.target.value as SceneMode)} aria-label="3D-де көрсетілетін есеп">
          {MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        {primary}
        <button className="btn" onClick={() => timeStore.set({ t: 0, playing: true })}>↺ Қайта бастау</button>
        <label className="speed">Жылдамдық
          <select value={speed} onChange={(e) => timeStore.set({ speed: Number(e.target.value) })}>
            {[1, 2, 5, 10, 30, 60, 90, 120].map((s) => <option key={s} value={s}>×{s}</option>)}
          </select>
        </label>
      </div>
      <div className="tl-track">
        <input type="range" min={0} max={tEnd} step={tEnd > 300 ? 1 : 0.1} value={t} aria-label="Уақытты айналдыру"
          onChange={(e) => timeStore.set({ t: Number(e.target.value), playing: false })} />
        <div className="tl-marks" aria-hidden>
          {shown.map((m, i) => <span key={i} className="tl-mark m-start" style={{ left: `${(m.t / tEnd) * 100}%` }} title={m.label}><em>{m.show ? m.label : ''}</em></span>)}
        </div>
      </div>
      <div className="tl-read">
        <b>{mi.unit === 'min' ? `${fmt(t / 60, 2)} мин` : `${fmt(t, 1)} с`}</b>
        <span className="muted"> ({mmss(t)}) / {mi.unit === 'min' ? `${fmt(tEnd / 60, 2)} мин` : `${fmt(tEnd, 0)} с`}</span>
        <span className="sep">·</span>
        <span className="muted">{mode === 'fire' ? 't = 0 — тұтану сәті' : mode === 'water' || mode === 'refill' ? 't = 0 — су беру басы' : mode === 'staff' ? 'қызметкерлердің орналасуы' : 't = 0 — эвакуация белгісі'}. Жылдамдық тек көрсетілімді өзгертеді.</span>
      </div>
    </div>
  );
}
