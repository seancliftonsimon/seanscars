import type { Segment, WithId } from '../types';
import type { ScheduleRow, ScheduleTotals } from './clock';
import { formatDuration, formatHMS } from './clockFormat';

/*
 * The show clock in words: does it fit, by how much, and which segments
 * are the best candidates to trim.
 */

export interface TrimCandidate {
  segmentId: string;
  title: string;
  sec: number;
}

export interface ClockVerdict {
  state: ScheduleTotals['state'];
  /** One sentence, e.g. "4:00 over the 3:00:00 cap." */
  headline: string;
  /** What to do about it, or null when it fits. */
  advice: string | null;
  /** Seconds to cut to get back inside the buffer (0 when it fits). */
  trimToBufferSec: number;
  /** Seconds to cut to get under the cap (0 when under). */
  trimToCapSec: number;
  candidates: TrimCandidate[];
}

/**
 * Candidates are Sean's own segments (he can cut those himself), longest
 * first; guest sets and house segments only when Sean has none.
 */
export function clockVerdict(
  totals: ScheduleTotals,
  rows: ScheduleRow[],
  segments: WithId<Segment>[],
  max = 3,
): ClockVerdict {
  const trimToBufferSec = Math.max(0, totals.totalSec - totals.availableSec);
  const trimToCapSec = Math.max(0, totals.totalSec - totals.capSec);
  const byId = new Map(segments.map((s) => [s.id, s]));
  const pool = (group: ScheduleRow['group'] | null) =>
    rows
      .filter((r) => (group ? r.group === group : r.group !== 'house') && r.durationSec > 0)
      .sort((a, b) => b.durationSec - a.durationSec)
      .slice(0, max)
      .map((r) => ({ segmentId: r.segmentId, title: byId.get(r.segmentId)?.title ?? 'Segment', sec: r.durationSec }));
  const own = pool('sean');
  const candidates = trimToBufferSec > 0 ? (own.length ? own : pool(null)) : [];

  if (rows.length === 0) {
    return { state: 'ok', headline: 'No run of show yet.', advice: null, trimToBufferSec: 0, trimToCapSec: 0, candidates: [] };
  }
  const names = candidates.map((c) => `${c.title} (${formatDuration(c.sec)})`);
  const list = names.length ? ` Longest of yours: ${names.join(', ')}.` : '';

  if (totals.state === 'ok') {
    const spare = totals.availableSec - totals.totalSec;
    return {
      state: 'ok',
      headline: spare === 0 ? 'Fits exactly, buffer intact.' : `Fits, with ${formatDuration(spare)} to spare and the ${formatDuration(totals.bufferTargetSec)} buffer intact.`,
      advice: null,
      trimToBufferSec,
      trimToCapSec,
      candidates,
    };
  }
  if (totals.state === 'tight') {
    return {
      state: 'tight',
      headline: `Runs ${formatDuration(trimToBufferSec)} into the ${formatDuration(totals.bufferTargetSec)} buffer.`,
      advice: `Trim ${formatDuration(trimToBufferSec)} to keep the buffer.${list}`,
      trimToBufferSec,
      trimToCapSec,
      candidates,
    };
  }
  return {
    state: 'over',
    headline: `${formatDuration(trimToCapSec)} over the ${formatHMS(totals.capSec)} cap.`,
    advice: `Trim at least ${formatDuration(trimToCapSec)} (${formatDuration(trimToBufferSec)} to get the buffer back).${list}`,
    trimToBufferSec,
    trimToCapSec,
    candidates,
  };
}
