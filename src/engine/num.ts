// Сандарды қауіпсіз өңдеу және қазақша пішімдеу (ондық бөлгіш — үтір).

/** Санды тексеру: NaN/Infinity болса — fallback, сосын [min, max] аралығына қысу. */
export function safeNum(x: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Нөлге бөлуден қорғалған бөлу: бөлгіш ≤ 0 болса null қайтарады. */
export function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return a / b;
}

const EPS = 1e-9;
export const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
export const isPos = (x: number) => Number.isFinite(x) && x > EPS;

/** Қазақша сан пішімі: 1 234,5 */
export function fmt(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  const r = Number(x.toFixed(digits));
  const neg = r < 0;
  const abs = Math.abs(r);
  let [int, frac] = abs.toFixed(digits).split('.');
  if (frac) frac = frac.replace(/0+$/, '');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + int + (frac ? ',' + frac : '');
}

/** Секундты «140 с (2 мин 20 с)» түрінде көрсету. */
export function fmtSec(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return 'анықталмайды';
  const m = Math.floor(s / 60 + 1e-9);
  const rest = s - m * 60;
  const base = `${fmt(s, 1)} с`;
  if (s < 60) return base;
  return `${base} (${m} мин${rest > 1e-6 ? ' ' + fmt(rest, 1) + ' с' : ''})`;
}

/** Минутты «7,5 мин» түрінде. */
export function fmtMin(m: number | null, digits = 2): string {
  if (m === null || !Number.isFinite(m)) return 'анықталмайды';
  return `${fmt(m, digits)} мин`;
}

export function pct(part: number, base: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(base) || Math.abs(base) < EPS) return null;
  return (part / base) * 100;
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

const KK_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
/** Қазақша күн: «2026 жылғы 14 қазан, 14:20» (браузердің kk локаліне тәуелсіз). */
export function fmtDateKk(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()} жылғы ${d.getDate()} ${KK_MONTHS[d.getMonth()]}, ${hh}:${mm}`;
}
