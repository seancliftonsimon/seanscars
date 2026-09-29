import { describe, expect, it } from 'vitest';
import type { ShowConfig, TimerSegment } from '../types';
import { changedSincePublish, describeChanges, diffTimerConfigs, timerEditsSincePublish } from './publishDiff';

const s = (id: string, title = id, durationSec = 300, over: Partial<TimerSegment> = {}): TimerSegment => ({
  id,
  title,
  presenter: 'Ada Example',
  type: 'live',
  durationSec,
  ...over,
});
const cfg = (segments: TimerSegment[], showStartTime = '19:00', updatedAtMs = 1): ShowConfig => ({
  showStartTime,
  segments,
  updatedAtMs,
});
const kinds = (d: ReturnType<typeof diffTimerConfigs>) => d.changes.map((c) => c.kind);

describe('diffTimerConfigs', () => {
  it('is identical ignoring updatedAtMs', () => {
    const d = diffTimerConfigs(cfg([s('a')], '19:00', 1), cfg([s('a')], '19:00', 99));
    expect(d.identical).toBe(true);
    expect(d.changes).toEqual([]);
    expect(d.beforeTotalSec).toBe(300);
    expect(d.afterTotalSec).toBe(300);
  });

  it('treats a missing before as all added', () => {
    const d = diffTimerConfigs(null, cfg([s('a'), s('b', 'B', 60)]));
    expect(kinds(d)).toEqual(['added', 'added']);
    expect(d.beforeTotalSec).toBe(0);
    expect(d.afterTotalSec).toBe(360);
    expect(d.startTimeChanged).toBeNull();
    expect(d.identical).toBe(false);
  });

  it('finds added and removed', () => {
    const d = diffTimerConfigs(cfg([s('a'), s('b')]), cfg([s('a'), s('c')]));
    expect(kinds(d)).toEqual(['removed', 'added']);
    expect(d.changes[1]).toMatchObject({ kind: 'added', index: 1 });
  });

  it('finds retimed and start time changes', () => {
    const d = diffTimerConfigs(cfg([s('a', 'Welcome', 300)]), cfg([s('a', 'Welcome', 390)], '19:30'));
    expect(kinds(d)).toEqual(['retimed']);
    expect(d.startTimeChanged).toEqual({ before: '19:00', after: '19:30' });
    expect(d.afterTotalSec - d.beforeTotalSec).toBe(90);
  });

  it('reports one renamed entry with all fields', () => {
    const d = diffTimerConfigs(
      cfg([s('a', 'Old')]),
      cfg([s('a', 'New', 300, { presenter: 'Ben Sample', type: 'pretape' })]),
    );
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0]).toMatchObject({ kind: 'renamed', fields: ['title', 'presenter', 'type'] });
  });

  it('reports a single jump as one move', () => {
    const before = cfg([s('a'), s('b'), s('c'), s('d'), s('e')]);
    const after = cfg([s('b'), s('c'), s('d'), s('a'), s('e')]);
    const d = diffTimerConfigs(before, after);
    expect(d.changes).toEqual([{ kind: 'moved', after: s('a'), fromIndex: 0, toIndex: 3 }]);
  });

  it('does not report moves caused only by removals or additions', () => {
    const d = diffTimerConfigs(cfg([s('a'), s('b'), s('c')]), cfg([s('x'), s('a'), s('c')]));
    expect(kinds(d)).toEqual(['removed', 'added']);
  });

  it('orders changes removed, added, moved, retimed, renamed', () => {
    const before = cfg([s('a'), s('b'), s('gone'), s('c', 'C', 60), s('d', 'Old')]);
    const after = cfg([s('c', 'C', 120), s('a'), s('new'), s('b'), s('d', 'New')]);
    expect(kinds(diffTimerConfigs(before, after))).toEqual([
      'removed',
      'added',
      'moved',
      'retimed',
      'renamed',
    ]);
  });
});

describe('describeChanges', () => {
  it('describes each kind', () => {
    const before = cfg([s('a'), s('b', 'Ada bit'), s('gone', 'Clip'), s('c', 'Welcome', 300), s('d', 'Old'), s('e', 'P')]);
    const after = cfg(
      [
        s('a'),
        s('c', 'Welcome', 390),
        s('n', 'Fresh', 360),
        s('e', 'P', 300, { presenter: 'Ben Sample' }),
        s('d', 'New'),
        s('b', 'Ada bit'),
      ],
      '19:30',
    );
    const lines = describeChanges(diffTimerConfigs(before, after));
    expect(lines).toContain('Start 19:00 → 19:30');
    expect(lines).toContain('Removed "Clip"');
    expect(lines).toContain('Added "Fresh" (6:00)');
    expect(lines).toContain('"Welcome" 5:00 → 6:30');
    expect(lines).toContain('"New" renamed from "Old"');
    expect(lines).toContain('"P" presenter changed');
    expect(lines.some((l) => /^"Ada bit" moved \d → \d$/.test(l))).toBe(true);
  });

  it('prints 1-based positions', () => {
    const d = diffTimerConfigs(cfg([s('a'), s('b'), s('c')]), cfg([s('b'), s('c'), s('a')]));
    expect(describeChanges(d)).toEqual(['"a" moved 1 → 3']);
  });
});

describe('timerEditsSincePublish', () => {
  const last = { payloadUpdatedAtMs: 100, segments: [s('a')] };

  it('returns null with no last publish or no current doc', () => {
    expect(timerEditsSincePublish(null, cfg([s('a')], '19:00', 200))).toBeNull();
    expect(timerEditsSincePublish(last, null)).toBeNull();
  });

  it('returns null when the doc has not moved since the publish', () => {
    expect(timerEditsSincePublish(last, cfg([s('a')], '19:00', 100))).toBeNull();
    expect(timerEditsSincePublish(last, cfg([s('a')], '19:00', 50))).toBeNull();
  });

  it('returns null for old records without stored segments', () => {
    expect(timerEditsSincePublish({ payloadUpdatedAtMs: 100 }, cfg([s('a')], '19:00', 200))).toBeNull();
  });

  it('returns an identical diff when only the timestamp moved', () => {
    const d = timerEditsSincePublish(last, cfg([s('a')], '19:00', 200));
    expect(d?.identical).toBe(true);
  });

  it('returns the edits, including start time when given', () => {
    const d = timerEditsSincePublish(last, cfg([s('a', 'a', 400)], '19:30', 200), '19:00');
    expect(kinds(d!)).toEqual(['retimed']);
    expect(d!.startTimeChanged).toEqual({ before: '19:00', after: '19:30' });
  });

  it('ignores start time when lastShowStartTime is omitted', () => {
    const d = timerEditsSincePublish(last, cfg([s('a')], '19:30', 200));
    expect(d!.startTimeChanged).toBeNull();
  });
});

describe('changedSincePublish', () => {
  const seg = (id: string, durationSec: number) =>
    ({ id, title: `Seg ${id}`, presenter: 'Ada Example', type: 'live' as const, durationSec });
  const now = { showStartTime: '19:00', segments: [seg('a', 300), seg('b', 600)], updatedAtMs: 5 };

  it('is null without a publish or stored segments', () => {
    expect(changedSincePublish(now, null)).toBeNull();
    expect(changedSincePublish(now, { showStartTime: '19:00' })).toBeNull();
  });

  it('is false when segments and start time match, ignoring timestamps', () => {
    expect(changedSincePublish(now, { segments: now.segments, showStartTime: '19:00' })).toBe(false);
  });

  it('catches a start-time change against the published start time', () => {
    expect(changedSincePublish(now, { segments: now.segments, showStartTime: '19:30' })).toBe(true);
  });

  it('catches segment changes', () => {
    expect(changedSincePublish(now, { segments: [seg('a', 300), seg('b', 630)], showStartTime: '19:00' })).toBe(true);
  });

  it('falls back to the current start time for older records', () => {
    expect(changedSincePublish(now, { segments: now.segments })).toBe(false);
  });
});
