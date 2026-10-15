import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { computeAll, Results } from '../engine/compute';
import { DEFAULT_PARAMS, Params, PRESETS, SceneMode, ParamGroup } from '../engine/types';
import { sanitize } from '../engine/sanitize';
import { clone } from '../engine/num';

// ---------- Уақыт қоймасы (секундпен; React қайта салусыз, кадр жиілігіне тәуелсіз) ----------
// Жылдамдық тек көрсетілімге әсер етеді: есеп нәтижесі t-ға ғана тәуелді.
type TimeState = { t: number; playing: boolean; speed: number; tEnd: number; mode: SceneMode };
let ts: TimeState = { t: 0, playing: false, speed: 30, tEnd: 660, mode: 'fire' };
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
        const nt = s.t + dt * s.speed;
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
const LS_KEY = 'ort-matematika:scenarios:v2';
const LS_CUR = 'ort-matematika:current:v2';
function lsGet<T>(k: string, def: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

interface Ctx {
  params: Params;
  results: Results;
  update: (fn: (p: Params) => void) => void;
  replace: (p: unknown, msg?: string) => void;
  resetDefaults: () => void;
  resetGroup: (g: ParamGroup) => void;
  mode: SceneMode;
  setMode: (m: SceneMode) => void;
  applyPreset: (id: string, silent?: boolean) => void;
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

  const mode = useSyncExternalStore(timeStore.subscribe, () => timeStore.get().mode);
  const setMode = useCallback((m: SceneMode) => {
    if (timeStore.get().mode === m) return;
    const mi = results.modes[m];
    timeStore.set({ mode: m, t: 0, playing: false, speed: mi.speed, tEnd: mi.tEnd });
  }, [results]);
  const tEnd = results.modes[mode].tEnd;
  useEffect(() => {
    lsSet(LS_CUR, params);
    const wasPlaying = timeStore.get().playing;
    timeStore.set({ tEnd, playing: false });
    if (!first.current && wasPlaying) notify('Мән өзгерді: анимация тоқтатылды, көрініс жаңа есепке сай қайта құрылды.');
    first.current = false;
  }, [params, tEnd, notify]);

  const update = useCallback((fn: (p: Params) => void) => {
    setParams((prev) => { const n = clone(prev); fn(n); return sanitize(n).params; });
  }, []);
  const replace = useCallback((p: unknown, msg?: string) => {
    const s = sanitize(p);
    setParams(s.params);
    timeStore.set({ t: 0, playing: false });
    notify((msg ?? 'Сценарий жүктелді.') + (s.warnings.length ? ` Ескерту: ${s.warnings.slice(0, 3).join('; ')}` : ''));
  }, [notify]);
  const resetDefaults = useCallback(() => { setParams(clone(DEFAULT_PARAMS)); timeStore.set({ t: 0, playing: false }); notify('Барлық бастапқы мән қалпына келтірілді.'); }, [notify]);
  const resetGroup = useCallback((g: ParamGroup) => {
    setParams((prev) => ({ ...prev, [g]: clone(DEFAULT_PARAMS[g]) }));
    timeStore.set({ t: 0, playing: false });
    notify('Осы бөлімнің бастапқы мәндері қайтарылды.');
  }, [notify]);
  const applyPreset = useCallback((id: string, silent?: boolean) => {
    const pr = PRESETS.find((x) => x.id === id); if (!pr) return;
    setParams((prev) => sanitize(pr.apply(clone(prev))).params);
    timeStore.set({ t: 0, playing: false });
    if (!silent) notify(`«${pr.name}» мысалы қолданылды. Уақыт t = 0-ге қайтарылды.`);
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

  const v: Ctx = { params, results, update, replace, resetDefaults, resetGroup, mode, setMode, applyPreset, saved, saveCurrent, deleteSaved, slots, setSlot, toast, notify };
  return <C.Provider value={v}>{children}</C.Provider>;
}
