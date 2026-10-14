// Жеке құрам: қолжетімді / қажет / тапшылық және адам-сағат.
// θ — жұмыс уақыты, мин; θ = 0 — бірінші экипаждың келуі.
import { Params, StaffTask } from './types';

export const staffDeficit = (req: number, avail: number) => Math.max(0, req - avail);

export function availableAt(s: Params['staff'], theta: number): number {
  if (theta < 0) return 0;
  const extra = s.extra.filter((e) => e.atMin <= theta + 1e-9).reduce((a, e) => a + e.count, 0);
  return Math.min(s.total, s.initial + extra);
}

export function requiredAt(tasks: StaffTask[], theta: number): number {
  if (theta < 0) return 0;
  return tasks.filter((t) => t.fromMin <= theta + 1e-9).reduce((a, t) => a + t.count, 0);
}

/** Әр адам тек бір міндетке бекітіледі (кезек бойынша). */
export function assignment(tasks: StaffTask[], avail: number, theta: number) {
  let left = avail;
  const rows = tasks.map((t) => {
    const need = t.fromMin <= theta + 1e-9 ? t.count : 0;
    const got = Math.min(need, left);
    left -= got;
    return { id: t.id, name: t.name, need, assigned: got, missing: need - got };
  });
  return { rows, idle: left };
}

export interface StaffStep { from: number; to: number; avail: number; req: number; deficit: number }

export function staffTimeline(s: Params['staff']): StaffStep[] {
  const pts = new Set<number>([0, s.workMin]);
  s.extra.forEach((e) => e.atMin > 0 && e.atMin < s.workMin && pts.add(e.atMin));
  s.tasks.forEach((t) => t.fromMin > 0 && t.fromMin < s.workMin && pts.add(t.fromMin));
  const p = [...pts].sort((a, b) => a - b);
  const out: StaffStep[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const a = availableAt(s, p[i]);
    const r = requiredAt(s.tasks, p[i]);
    out.push({ from: p[i], to: p[i + 1], avail: a, req: r, deficit: staffDeficit(r, a) });
  }
  return out;
}

/** H = Σ(Nᵢ·Δtᵢ)/60 = (1/60)∫N(θ)dθ */
export function personHours(s: Params['staff']) {
  const steps = staffTimeline(s);
  const sum = steps.reduce((a, st) => a + st.avail * (st.to - st.from), 0);
  const H = sum / 60;
  const avg = s.workMin > 0 ? sum / s.workMin : null;
  const max = steps.reduce((m, st) => Math.max(m, st.avail), 0);
  const requested = s.initial + s.extra.reduce((a, e) => a + e.count, 0);
  return { H, avg, max, steps, sumNt: sum, cappedByTotal: requested > s.total, requested };
}
