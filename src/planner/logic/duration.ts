/*
 * Parsing lengths typed into the planner. The UI shows m:ss; people also
 * type plain minutes ("6", "6.5").
 */

/** Largest length the planner accepts for one segment or piece: 10 hours. */
export const MAX_LENGTH_SEC = 10 * 60 * 60;

/**
 * 'm:ss' or 'h:mm:ss' → seconds; a bare number is minutes ('6.5' → 390).
 * Returns null for anything else, negatives, or seconds fields ≥ 60.
 */
export function parseLength(text: string): number | null {
  const value = text.trim();
  if (value === '') return null;

  if (/^\d+(\.\d+)?$/.test(value)) {
    const sec = Math.round(Number(value) * 60);
    return sec <= MAX_LENGTH_SEC ? sec : null;
  }

  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  // Everything after the first field is a 0–59 sub-unit.
  if (nums.slice(1).some((n) => n >= 60)) return null;
  const sec = nums.reduce((total, n) => total * 60 + n, 0);
  return sec <= MAX_LENGTH_SEC ? sec : null;
}

/** Adds `deltaSec`, never going below zero. */
export function nudge(sec: number, deltaSec: number): number {
  return Math.max(0, sec + deltaSec);
}
