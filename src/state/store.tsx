import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { computeAll, Results } from '../engine/compute';
import { DEFAULT_PARAMS, Params, PRESETS } from '../engine/types';
import { sanitize } from '../engine/sanitize';
import { clone } from '../engine/num';

// ---------- Уақыт қоймасы (React қайта салусыз, кадр жиілігіне тәуелсіз) ----------
type TimeState = { t: number; playing: boolean; speed: number; tEnd: number };
let ts: TimeState = { t: 0, playing: false, speed: 30, tEnd: 20 };
const subs = new Set<() => void>();
export const timeStore = {
  get: () => ts,
  set(patch: Partial<TimeState>) {
    ts = { ...ts, ...patch };
    if (ts.t > ts.tEnd) ts.t = ts.tEnd;
    if (ts.t < 0) ts.t = 0;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};
export const useTime = () => useSyncExternalStore(timeStore.subscribe, timeStore.get);

/** requestAnimationFrame: t += Δнақты · жылдамдық. Нәтиже тек t-ға тәуелді. */
export function usePlaybackDriver() {
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      const s = timeStore.get();
      if (s.playing) {
        const nt = s.t + (dt * s.speed) / 60;
        if (nt >= s.tEnd) timeStore.set({ t: s.tEnd, playing: false });
        else timeStore.set({ t: nt });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

// ---------- Сценарий ----------
export interface Saved { name: string; savedAt: string; params: Params }
const LS_KEY = 'ort-matematika:scenarios:v1';
const LS_CUR = 'ort-matematika:current:v1';
function lsGet<T>(k: string, def: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

interface Ctx {
  params: Params;
  results: Results;
  update: (fn: (p: Params) => void) => void;
  replace: (p: unknown, msg?: string) => void;
  resetDefaults: () => void;
  applyPreset: (id: string) => void;
  saved: Saved[];
  saveCurrent: (name: string) => boolean;
  deleteSaved: (i: number) => void;
  slots: { A: Params | null; B: Params | null };
  setSlot: (k: 'A' | 'B', p: Params | null) => void;
  toast: string | null;
  notify: (m: string) => void;
}
const C = createContext<Ctx | null>(null);
export const useScenario = () => { const c = useContext(C); if (!c) throw new Error('no ctx'); return c; };

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<Params>(() => sanitize(lsGet(LS_CUR, DEFAULT_PARAMS)).params);
  const [saved, setSaved] = useState<Saved[]>(() => lsGet<Saved[]>(LS_KEY, []));
  const [slots, setSlots] = useState<{ A: Params | null; B: Params | null }>({ A: null, B: null });
  const [toast, setToast] = useState<string | null>(null);
  const tRef = useRef<number>();
  const notify = useCallback((m: string) => {
    setToast(m); window.clearTimeout(tRef.current); tRef.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => { const h = (e: Event) => notify(String((e as CustomEvent).detail)); window.addEventListener('app-toast', h); return () => window.removeEventListener('app-toast', h); }, [notify]);
  const results = useMemo(() => computeAll(params), [params]);
  const first = useRef(true);

  useEffect(() => {
    lsSet(LS_CUR, params);
    const s = timeStore.get();
    const wasPlaying = s.playing;
    timeStore.set({ tEnd: results.tEnd, playing: false });
    if (!first.current && wasPlaying) notify('Параметр өзгерді: анимация тоқтатылды, көрініс жаңа есептеуге сай t = ' + timeStore.get().t.toFixed(2).replace('.', ',') + ' мин сәтіне қайта құрылды.');
    first.current = false;
  }, [params, results.tEnd, notify]);

  const update = useCallback((fn: (p: Params) => void) => {
    setParams((prev) => { const n = clone(prev); fn(n); return sanitize(n).params; });
  }, []);
  const replace = useCallback((p: unknown, msg?: string) => {
    const s = sanitize(p);
    setParams(s.params);
    timeStore.set({ t: 0, playing: false });
    notify((msg ?? 'Сценарий жүктелді.') + (s.warnings.length ? ` Ескерту: ${s.warnings.slice(0, 3).join('; ')}` : ''));
  }, [notify]);
  const resetDefaults = useCallback(() => { setParams(clone(DEFAULT_PARAMS)); timeStore.set({ t: 0, playing: false }); notify('Бастапқы мәндер қалпына келтірілді, уақыт t = 0.'); }, [notify]);
  const applyPreset = useCallback((id: string) => {
    const pr = PRESETS.find((x) => x.id === id); if (!pr) return;
    setParams((prev) => sanitize(pr.apply(clone(prev))).params);
    timeStore.set({ t: 0, playing: false });
    notify(`«${pr.name}» мысалы қолданылды. Уақыт t = 0-ге қайтарылды.`);
  }, [notify]);
  const saveCurrent = useCallback((name: string) => {
    const n = name.trim() || params.name;
    const list = [{ name: n, savedAt: new Date().toISOString(), params: { ...clone(params), name: n } }, ...saved.filter((s) => s.name !== n)].slice(0, 30);
    setSaved(list);
    const ok = lsSet(LS_KEY, list);
    notify(ok ? `«${n}» браузерде сақталды.` : 'Браузер жадына сақтау мүмкін болмады (жеке режим?). JSON экспортын қолданыңыз.');
    return ok;
  }, [params, saved, notify]);
  const deleteSaved = useCallback((i: number) => { const l = saved.filter((_, k) => k !== i); setSaved(l); lsSet(LS_KEY, l); }, [saved]);
  const setSlot = useCallback((k: 'A' | 'B', p: Params | null) => setSlots((s) => ({ ...s, [k]: p ? clone(p) : null })), []);

  const v: Ctx = { params, results, update, replace, resetDefaults, applyPreset, saved, saveCurrent, deleteSaved, slots, setSlot, toast, notify };
  return <C.Provider value={v}>{children}</C.Provider>;
}
