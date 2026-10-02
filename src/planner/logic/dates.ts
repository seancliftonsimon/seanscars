/*
 * Calendar-date helpers on 'YYYY-MM-DD' strings. No Date timezone shifts:
 * a date is a day, not an instant.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

/** Today in local time as 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Whole days from a to b; positive when b is later. */
export function daysBetween(aIso: string, bIso: string): number {
  return Math.round(dayNumber(bIso) - dayNumber(aIso));
}

export function addDays(iso: string, n: number): string {
  const d = new Date((dayNumber(iso) + n) * DAY_MS);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 'Nov 6'. */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1] ?? '?'} ${d}`;
}

/** 'Sat, Nov 6, 2027'. */
export function formatLongDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ${MONTHS[m - 1] ?? '?'} ${d}, ${y}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** 'today', 'tomorrow', 'in 3 days', 'yesterday', '4 days ago'. */
export function relativeDay(iso: string, today: string): string {
  const d = daysBetween(today, iso);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${plural(d, 'day')}` : `${plural(-d, 'day')} ago`;
}

/** 'Due today', 'Due in 3 days', '2 days overdue'. */
export function dueLabel(iso: string, today: string): string {
  const d = daysBetween(today, iso);
  if (d < 0) return `${plural(-d, 'day')} overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d <= 14) return `Due in ${plural(d, 'day')}`;
  return `Due ${formatDay(iso)}`;
}
