import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScenarioProvider, useScenario, usePlaybackDriver } from './state/store';
import { SECTIONS, SectionId, UIProvider, UI } from './state/ui';
import { SchoolScene, ViewOpts, WALK_SPOTS } from './three/scene';
import { Scene3D } from './components/Scene3D';
import { Timeline } from './components/Timeline';
import { SceneHud } from './components/SceneHud';
import { PhotoViewer } from './components/PhotoViewer';
import { PRESETS } from './engine/types';
import { ScenePanel } from './sections/ScenePanel';
import { AreaTask, SpreadTask, ArrivalTask, EvacTask, SchoolTask, FlowTask, WaterTask, RefillTask, StaffTask } from './sections/Tasks';
import { DataSection, ConditionsSection, ResultsSection } from './sections/Info';
import { Photos } from './sections/Photos';

const PANELS: Record<SectionId, () => JSX.Element> = {
  scene: ScenePanel, data: DataSection, area: AreaTask, spread: SpreadTask, arrival: ArrivalTask, evac: EvacTask, school: SchoolTask,
  flow: FlowTask, water: WaterTask, refill: RefillTask, staff: StaffTask, conditions: ConditionsSection, photos: Photos, results: ResultsSection,
};

function readHash(): SectionId {
  const h = window.location.hash.replace('#', '') as SectionId;
  return SECTIONS.some((s) => s.id === h) ? h : 'scene';
}

function Shell() {
  usePlaybackDriver();
  const { toast, applyPreset, params, mode, setMode } = useScenario();
  const [section, setSection] = useState<SectionId>(readHash);
  const [view, setViewState] = useState<ViewOpts>({ floor: 'all', hideRoof: false, hideWalls: false, exploded: false, showRoutes: true, showPlans: false, showLabels: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => readHash() !== 'scene');
  const sceneRef = useRef<SchoolScene | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const [isFs, setFs] = useState(false);
  const [walk, setWalk] = useState<{ on: boolean; floor: number }>({ on: false, floor: 0 });
  const [walkMenu, setWalkMenu] = useState(false);
  useEffect(() => { const sc = sceneRef.current; if (sc) sc.onWalkChange = (on, floor) => setWalk({ on, floor }); });

  useEffect(() => { const f = () => { const h = readHash(); setSection(h); if (h !== 'scene') setPanelOpen(true); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const go = useCallback((s: SectionId) => { window.location.hash = s; setSection(s); setPanelOpen(true); }, []);
  const closePanel = useCallback(() => { setPanelOpen(false); try { history.replaceState(null, '', '#scene'); } catch { /* */ } }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !photo) setPanelOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const setView = useCallback((v: Partial<ViewOpts>) => setViewState((o) => ({ ...o, ...v })), []);
  const onPick = useCallback((id: string | null) => {
    if (id === 'roof') { setViewState((o) => ({ ...o, hideRoof: true })); setSelected('roof'); return; }
    if (id?.startsWith('plan-')) { setSelected(id); go('scene'); return; }
    setSelected(id); if (id) { setPanelOpen(true); if (section !== 'scene') go('scene'); }
  }, [go, section]);

  const ui: UI = useMemo(() => ({
    view, setView, selected, setSelected, go, webgl,
    openPhoto: (f) => setPhoto(f),
    camera: (c) => { const s = sceneRef.current; if (!s) return; if (c === 'reset') s.resetCamera(); else if (c === 'top') s.topView(); else if (c === 'station') s.focusStation(); else s.focusMode(c === 'room' ? 'fire' : 'water'); },
    snapshotPNG: () => { try { return sceneRef.current?.snapshotPNG() ?? null; } catch { return null; } },
  }), [view, setView, selected, go, webgl]);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else appRef.current?.requestFullscreen?.().catch(() => {});
  };
  const wide = SECTIONS.find((s) => s.id === section)?.wide;
  const Panel = PANELS[section];
  // Панель ашық болса, 3D көріністің ортасы бос аймаққа жылжиды
  useEffect(() => {
    const apply = () => { const sc = sceneRef.current; if (!sc) return; const open = panelOpen && !wide; const mob = window.innerWidth <= 860; sc.setInset(open && !mob ? 470 : 0, open && mob ? 0.68 : 0); };
    apply(); window.addEventListener('resize', apply); return () => window.removeEventListener('resize', apply);
  }, [panelOpen, wide]);
  // Бөлім ашылғанда 3D сол есепті көрсетеді
  useEffect(() => { const m = SECTIONS.find((x) => x.id === section)?.mode; if (panelOpen && m) setMode(m); }, [section, panelOpen, setMode]);
  // Көрініс ауысқанда камера мен қабаттарды сол есепке бағыттау
  useEffect(() => {
    const sc = sceneRef.current; if (!sc || sc.walk.on) return;
    if (mode === 'evac2' || mode === 'evacAll') setViewState((o) => ({ ...o, floor: 1, hideRoof: true, hideWalls: false, exploded: false, showRoutes: true }));
    else setViewState((o) => ({ ...o, floor: 'all', hideRoof: false, hideWalls: false, exploded: false }));
    sc.focusMode(mode);
  }, [mode]);

  return (
    <UIProvider value={ui}>
      <div className="app" ref={appRef}>
        <header className="bar no-print">
          <div className="brand">
            <span className="logo" aria-hidden>∑</span>
            <h1>Өрт сөндіру ісіндегі математика</h1>
          </div>
          <nav className="tabs" aria-label="Бөлімдер">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`tab ${(s.id === 'scene' ? !panelOpen || section === 'scene' : panelOpen && section === s.id) ? 'active' : ''}`}
                onClick={(e) => { if (s.id === 'scene') { e.preventDefault(); if (panelOpen && section === 'scene') closePanel(); else closePanel(); } else { setPanelOpen(true); } }}>
                {s.label}
              </a>
            ))}
          </nav>
          <div className="top-actions">
            <select value="" onChange={(e) => e.target.value && applyPreset(e.target.value)} aria-label="Дайын мысалды таңдау" title="Дайын мысал">
              <option value="">Мысал: {params.name}</option>
              {PRESETS.map((p) => <option key={p.id} value={p.id} title={p.note}>{p.name}</option>)}
            </select>
            <button className="btn small" onClick={toggleFs} title="Толық экран">{isFs ? '⤡' : '⤢'}</button>
          </div>
        </header>
        <main className="work">
          <div className="stage no-print">
            <Scene3D view={view} selected={selected} onPick={onPick} sceneRef={sceneRef} onFail={() => setWebgl(false)} />
            <SceneHud />
            {webgl && !walk.on && (
              <div className="tools" role="toolbar" aria-label="3D басқару">
                <button className="walkbtn" onClick={() => setWalkMenu((v) => !v)}><span aria-hidden>🚶</span> Мектепке кіру</button>
                {!panelOpen && <div className="tool-card">
                  <div className="tool-sec">Қабат</div>
                  <div className="tool-row">
                    {(['all', 1, 2, 3] as const).map((f) => (
                      <button key={String(f)} className={`tbtn ${view.floor === f ? 'on' : ''}`} onClick={() => setView({ floor: f })}>{f === 'all' ? 'Бәрі' : `${f}`}</button>
                    ))}
                  </div>
                  <div className="tool-sec">Көрініс</div>
                  <div className="tool-col">
                    <button className="tbtn" onClick={() => ui.camera('reset')}>Бастапқы</button>
                    <button className="tbtn" onClick={() => ui.camera('top')}>Жоғарыдан</button>
                    <button className="tbtn" onClick={() => ui.camera('station')}>Өрт бөлімі</button>
                  </div>
                  <div className="tool-sec">Көрсету</div>
                  <div className="tool-col">
                    {([['hideRoof', 'Шатырды алу'], ['hideWalls', 'Қабырғаны алу'], ['exploded', 'Қабаттарды ажырату'], ['showRoutes', 'Маршруттар'], ['showPlans', 'Жоспар фотолары']] as const).map(([k, label]) => (
                      <button key={k} className={`tcheck ${view[k] ? 'on' : ''}`} aria-pressed={view[k]} onClick={() => setView({ [k]: !view[k] })}><i aria-hidden />{label}</button>
                    ))}
                  </div>
                  <button className="tbtn more" onClick={() => go('scene')}>Барлық баптаулар →</button>
                </div>}
              </div>
            )}
            {webgl && walkMenu && !walk.on && (
              <div className="walk-menu" role="dialog" aria-label="Мектеп ішіне кіру">
                <div className="walk-head"><b>Қай жерге кіресіз?</b><button className="tbtn" onClick={() => setWalkMenu(false)} aria-label="Жабу">✕</button></div>
                {[1, 2, 3].map((f) => (
                  <div key={f} className="walk-row"><span>{f}-қабат</span>
                    {WALK_SPOTS.filter((w) => w.floor === f).map((w) => <button key={w.id} className="btn small" onClick={() => { setWalkMenu(false); closePanel(); sceneRef.current?.enterWalk(w); }}>{w.name}</button>)}
                  </div>
                ))}
              </div>
            )}
            {walk.on && (
              <div className="walk-bar" role="toolbar" aria-label="Ішкі көрініс басқаруы">
                <div className="walk-pad">
                  {([['l', '↶'], ['f', '▲'], ['r', '↷'], ['b', '▼']] as const).map(([d, t]) => (
                    <button key={d} className={`tbtn pad pad-${d}`} aria-label={{ f: 'Алға', b: 'Артқа', l: 'Солға бұрылу', r: 'Оңға бұрылу' }[d]}
                      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); sceneRef.current?.hold(d, true); }}
                      onPointerUp={() => sceneRef.current?.hold(d, false)} onPointerCancel={() => sceneRef.current?.hold(d, false)} onPointerLeave={() => sceneRef.current?.hold(d, false)}>{t}</button>
                  ))}
                </div>
                <div className="walk-spots">
                  <span className="walk-hint">{walk.floor}-қабат · W A S D / ↑ ↓ ← → — жүру, тінтуірмен сүйреп — жан-жаққа қарау</span>
                  <div className="seg">
                    {WALK_SPOTS.map((w) => <button key={w.id} className={`btn small ${w.floor === walk.floor ? '' : 'ghost'}`} onClick={() => sceneRef.current?.enterWalk(w)}>{w.floor}: {w.name}</button>)}
                  </div>
                </div>
                <button className="btn primary" onClick={() => sceneRef.current?.exitWalk()}>✕ Сыртқа шығу</button>
              </div>
            )}
            <p className="stage-disc">Оқу-зерттеу жұмысы: нәтижелер <a href="#conditions">есептеу шарттарына</a> тәуелді.</p>
            {panelOpen && !wide && (
              <aside className="drawer" aria-label={SECTIONS.find((s) => s.id === section)?.label}>
                <div className="panel-head">
                  <h2>{SECTIONS.find((s) => s.id === section)?.label}</h2>
                  <button className="btn small" onClick={closePanel} aria-label="Жабу">✕ Жабу</button>
                </div>
                <div className="panel-body"><Panel /></div>
              </aside>
            )}
          </div>
          {panelOpen && wide && (
            <section className="page" aria-label={SECTIONS.find((s) => s.id === section)?.label}>
              <div className="page-head no-print">
                <button className="btn primary" onClick={closePanel}>← 3D-ге оралу</button>
                <h2>{SECTIONS.find((s) => s.id === section)?.label}</h2>
              </div>
              <div className="page-body"><Panel /></div>
            </section>
          )}
        </main>
        <footer className="no-print"><Timeline /></footer>
        {toast && <div className="toast" role="status">{toast}</div>}
        {photo && <PhotoViewer file={photo} onClose={() => setPhoto(null)} onNav={setPhoto} />}
      </div>
    </UIProvider>
  );
}

export default function App() {
  return <ScenarioProvider><Shell /></ScenarioProvider>;
}
