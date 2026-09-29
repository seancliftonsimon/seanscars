import type { Publish, ShowConfig, TimerSegment } from '../types';
import { formatDuration } from './clockFormat';

/*
 * Compares two timer documents so the Publish screen can show what will
 * change, and what timer edits would be overwritten. Segments are matched
 * by id. Indexes in the data are 0-based; describeChanges prints 1-based.
 */

export type SegmentField = 'title' | 'presenter' | 'type';

export type SegmentChange =
  | { kind: 'added'; after: TimerSegment; index: number }
  | { kind: 'removed'; before: TimerSegment }
  | { kind: 'retimed'; before: TimerSegment; after: TimerSegment }
  | { kind: 'renamed'; before: TimerSegment; after: TimerSegment; fields: SegmentField[] }
  | { kind: 'moved'; after: TimerSegment; fromIndex: number; toIndex: number };

export interface PublishDiff {
  /** Order: removed, added, moved, retimed, renamed. */
  changes: SegmentChange[];
  beforeTotalSec: number;
  afterTotalSec: number;
  startTimeChanged: { before: string; after: string } | null;
  /** True when nothing would change (ignoring updatedAtMs). */
  identical: boolean;
}

const totalOf = (segs: TimerSegment[]) => segs.reduce((sum, s) => sum + s.durationSec, 0);

/** Indexes (into `seq`) of one longest strictly increasing subsequence. */
function lisIndexes(seq: number[]): Set<number> {
  const tails: number[] = []; // tails[k] = index in seq ending the best run of length k+1
  const prev: number[] = new Array(seq.length).fill(-1);
  seq.forEach((value, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]] < value) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  });
  const keep = new Set<number>();
  let cur = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (cur !== -1) {
    keep.add(cur);
    cur = prev[cur];
  }
  return keep;
}

export function diffTimerConfigs(before: ShowConfig | null, after: ShowConfig): PublishDiff {
  const beforeSegs = before?.segments ?? [];
  const beforeIndex = new Map(beforeSegs.map((s, i) => [s.id, i]));
  const afterIds = new Set(after.segments.map((s) => s.id));

  const removed: SegmentChange[] = [];
  beforeSegs.forEach((s) => {
    if (!afterIds.has(s.id)) removed.push({ kind: 'removed', before: s });
  });

  const added: SegmentChange[] = [];
  const retimed: SegmentChange[] = [];
  const renamed: SegmentChange[] = [];
  // Segments present in both lists, in `after` order, with their `before` position.
  const common: { seg: TimerSegment; toIndex: number; fromIndex: number }[] = [];

  after.segments.forEach((seg, toIndex) => {
    const fromIndex = beforeIndex.get(seg.id);
    if (fromIndex === undefined) {
      added.push({ kind: 'added', after: seg, index: toIndex });
      return;
    }
    common.push({ seg, toIndex, fromIndex });
    const old = beforeSegs[fromIndex];
    if (old.durationSec !== seg.durationSec) retimed.push({ kind: 'retimed', before: old, after: seg });
    const fields: SegmentField[] = [];
    if (old.title !== seg.title) fields.push('title');
    if (old.presenter !== seg.presenter) fields.push('presenter');
    if (old.type !== seg.type) fields.push('type');
    if (fields.length > 0) renamed.push({ kind: 'renamed', before: old, after: seg, fields });
  });

  // Only segments outside a longest in-order run count as moved, so one
  // segment jumping past five others is one change, not five.
  const keep = lisIndexes(common.map((c) => c.fromIndex));
  const moved: SegmentChange[] = [];
  common.forEach((c, i) => {
    if (!keep.has(i)) {
      moved.push({ kind: 'moved', after: c.seg, fromIndex: c.fromIndex, toIndex: c.toIndex });
    }
  });

  const startTimeChanged =
    before && before.showStartTime !== after.showStartTime
      ? { before: before.showStartTime, after: after.showStartTime }
      : null;
  const changes = [...removed, ...added, ...moved, ...retimed, ...renamed];

  return {
    changes,
    beforeTotalSec: totalOf(beforeSegs),
    afterTotalSec: totalOf(after.segments),
    startTimeChanged,
    identical: changes.length === 0 && startTimeChanged === null,
  };
}

/** One line per change for display, e.g. 'Added "Ada bit" (6:00)', '"Welcome" 5:00 → 6:30', 'Start 19:00 → 19:30'. */
export function describeChanges(diff: PublishDiff): string[] {
  const lines: string[] = [];
  if (diff.startTimeChanged) {
    lines.push(`Start ${diff.startTimeChanged.before} → ${diff.startTimeChanged.after}`);
  }
  for (const c of diff.changes) {
    switch (c.kind) {
      case 'added':
        lines.push(`Added "${c.after.title}" (${formatDuration(c.after.durationSec)})`);
        break;
      case 'removed':
        lines.push(`Removed "${c.before.title}"`);
        break;
      case 'retimed':
        lines.push(
          `"${c.after.title}" ${formatDuration(c.before.durationSec)} → ${formatDuration(c.after.durationSec)}`,
        );
        break;
      case 'moved':
        lines.push(`"${c.after.title}" moved ${c.fromIndex + 1} → ${c.toIndex + 1}`);
        break;
      case 'renamed': {
        const parts: string[] = [];
        if (c.fields.includes('title')) parts.push(`renamed from "${c.before.title}"`);
        if (c.fields.includes('presenter')) parts.push('presenter changed');
        if (c.fields.includes('type')) parts.push('type changed');
        lines.push(`"${c.after.title}" ${parts.join(', ')}`);
        break;
      }
    }
  }
  return lines;
}

/**
 * Timer edits since the last publish: diff(lastPublished, current doc).
 * Returns null when there is nothing to compare or no reason to warn: no last
 * publish, no current doc, a last publish without stored `segments` (older
 * records; there is no baseline to diff against), or a doc whose updatedAtMs
 * is <= the last publish's payloadUpdatedAtMs. Otherwise the diff, which may
 * be `identical` if only the timestamp moved (callers still warn, with "no
 * visible changes"). `lastShowStartTime` is the start time as published;
 * omit it to ignore start-time changes.
 */
export function timerEditsSincePublish(
  lastPublish: Pick<Publish, 'payloadUpdatedAtMs' | 'segments'> | null,
  current: ShowConfig | null,
  lastShowStartTime?: string,
): PublishDiff | null {
  if (!lastPublish || !current || !lastPublish.segments) return null;
  if (current.updatedAtMs <= lastPublish.payloadUpdatedAtMs) return null;
  const published: ShowConfig = {
    showStartTime: lastShowStartTime ?? current.showStartTime,
    segments: lastPublish.segments,
    updatedAtMs: lastPublish.payloadUpdatedAtMs,
  };
  return diffTimerConfigs(published, current);
}
