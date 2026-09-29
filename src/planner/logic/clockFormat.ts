const pad = (n: number) => String(n).padStart(2, '0');

/** 10260 → '2:51:00'; 59 → '0:00:59'; negative → absolute value. */
export function formatHMS(sec: number): string {
  const s = Math.round(Math.abs(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${pad(m)}:${pad(s % 60)}`;
}

/** Short m:ss for any magnitude: 540 → '9:00', 3725 → '62:05'. Absolute value. */
export function formatDuration(sec: number): string {
  const s = Math.round(Math.abs(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Over/under in words, from totals. */
export function describeOverUnder(t: {
  totalSec: number;
  availableSec: number;
  bufferTargetSec: number;
  capSec: number;
}): string {
  if (t.totalSec <= t.availableSec) {
    const spare = t.availableSec - t.totalSec;
    return spare === 0
      ? 'Exactly on the buffer'
      : `${formatDuration(spare)} to spare, buffer intact`;
  }
  if (t.totalSec <= t.capSec) {
    return `${formatDuration(t.totalSec - t.availableSec)} into the ${formatDuration(t.bufferTargetSec)} buffer`;
  }
  return `${formatDuration(t.totalSec - t.capSec)} over`;
}
