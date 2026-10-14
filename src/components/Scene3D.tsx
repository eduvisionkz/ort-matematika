import { useEffect, useRef, useState } from 'react';
import { SchoolScene, ViewOpts, webglAvailable } from '../three/scene';
import { timeStore, useScenario } from '../state/store';
import { snapshotAt } from '../engine/compute';
import { Schematic2D } from './Schematic2D';

export function Scene3D({ view, selected, onPick, sceneRef, onFail }: {
  view: ViewOpts; selected: string | null; onPick: (id: string | null) => void;
  sceneRef: React.MutableRefObject<SchoolScene | null>; onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { results } = useScenario();
  const resRef = useRef(results); resRef.current = results;
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) { setErr('Бұл құрылғыда немесе браузерде WebGL қолжетімсіз, сондықтан 3D көрініс ашылмады.'); onFail(); return; }
    let sc: SchoolScene;
    try { sc = new SchoolScene(host.current); } catch (e) { setErr('3D сахнаны іске қосу мүмкін болмады: ' + String((e as Error).message ?? e)); onFail(); return; }
    sceneRef.current = sc;
    sc.setResults(resRef.current);
    const push = () => sc.setSnapshot(snapshotAt(resRef.current, timeStore.get().t));
    push();
    const un = timeStore.subscribe(push);
    return () => { un(); sc.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const sc = sceneRef.current; if (!sc) return; sc.setResults(results); sc.setSnapshot(snapshotAt(results, timeStore.get().t)); }, [results, sceneRef]);
  useEffect(() => { sceneRef.current?.setView(view); }, [view, sceneRef]);
  useEffect(() => { sceneRef.current?.select(selected); }, [selected, sceneRef]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.onPick = onPick; }, [onPick, sceneRef]);

  if (err) {
    return (
      <div className="scene-fallback">
        <p className="note note-warn"><b>3D қолжетімсіз.</b> {err} Барлық есептеулер, графиктер мен төмендегі схема жұмыс істей береді.</p>
        <Schematic2D floor={view.floor === 'all' ? 2 : view.floor} selected={selected} onPick={onPick} />
      </div>
    );
  }
  return <div ref={host} className="scene-host" />;
}
