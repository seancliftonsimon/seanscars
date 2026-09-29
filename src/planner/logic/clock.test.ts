import { describe, expect, it } from 'vitest';
import type { Piece, PlaybackSource, Segment, SegmentType, WithId } from '../types';
import {
  computeSchedule,
  formatClockTime,
  isHouseSegment,
  ownerGroup,
  pieceLengthSec,
} from './clock';

const season = { showStartTime: '19:00', runtimeCapSec: 10800, bufferTargetSec: 600 };

function seg(id: string, plannedSec: number, extra: Partial<Segment> = {}): WithId<Segment> {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) * 1000 || 0,
    title: `Segment ${id}`,
    type: 'live' as SegmentType,
    playbackSource: 'slides' as PlaybackSource,
    plannedSec,
    ownerPersonIds: [],
    ...extra,
  };
}

function piece(id: string, segmentId: string | undefined, extra: Partial<Piece> = {}): WithId<Piece> {
  return {
    id,
    title: `Piece ${id}`,
    kind: 'other',
    ownerPersonIds: [],
    segmentId,
    order: 1000,
    steps: [],
    links: [],
    ...extra,
  };
}

describe('pieceLengthSec', () => {
  it('prefers measured, then confirmed, then estimate, then 0', () => {
    expect(pieceLengthSec({ measuredSec: 10, confirmedSec: 20, estSec: 30 })).toBe(10);
    expect(pieceLengthSec({ confirmedSec: 20, estSec: 30 })).toBe(20);
    expect(pieceLengthSec({ estSec: 30 })).toBe(30);
    expect(pieceLengthSec({})).toBe(0);
    expect(pieceLengthSec({ measuredSec: 0, estSec: 30 })).toBe(0);
  });
});

describe('owner groups', () => {
  it('detects house segments', () => {
    expect(isHouseSegment({ type: 'intermission' })).toBe(true);
    expect(isHouseSegment({ type: 'live', presenterLabel: '  SHAREMONY ' })).toBe(true);
    expect(isHouseSegment({ type: 'live', presenterLabel: 'Someone' })).toBe(false);
    expect(isHouseSegment({ type: 'song' })).toBe(false);
  });

  it('groups by owner, then house, then sean', () => {
    expect(ownerGroup({ type: 'live', ownerPersonIds: ['p1'] })).toBe('contributors');
    expect(ownerGroup({ type: 'intermission', ownerPersonIds: ['p1'] })).toBe('contributors');
    expect(ownerGroup({ type: 'intermission', ownerPersonIds: [] })).toBe('house');
    expect(ownerGroup({ type: 'live', presenterLabel: 'Sharemony', ownerPersonIds: [] })).toBe('house');
    expect(ownerGroup({ type: 'pretape', ownerPersonIds: [] })).toBe('sean');
  });
});

describe('formatClockTime', () => {
  it('formats 12-hour times', () => {
    expect(formatClockTime('19:00')).toBe('7:00 PM');
    expect(formatClockTime('00:05')).toBe('12:05 AM');
    expect(formatClockTime('12:30')).toBe('12:30 PM');
    expect(formatClockTime('09:15')).toBe('9:15 AM');
  });

  it('passes invalid input through', () => {
    expect(formatClockTime('nope')).toBe('nope');
  });
});

describe('computeSchedule', () => {
  it('handles an empty show', () => {
    const { rows, totals } = computeSchedule(season, [], []);
    expect(rows).toEqual([]);
    expect(totals.totalSec).toBe(0);
    expect(totals.state).toBe('ok');
    expect(totals.overUnderSec).toBe(10200);
  });

  it('matches the 23-segment fixture: 10,260s is tight with 60s short of the buffer', () => {
    const durations = [
      300, 600, 240, 420, 180, 500, 360, 900, 240, 480, 300, 420, 600, 360, 200, 540, 420, 300,
      480, 360, 600, 270, 1190,
    ];
    expect(durations).toHaveLength(23);
    expect(durations.reduce((a, b) => a + b, 0)).toBe(10260);
    const segments = durations.map((d, i) =>
      seg(`s${i + 1}`, d, i === 4 ? { type: 'intermission' } : {}),
    );
    const { rows, totals } = computeSchedule(season, segments, []);
    expect(rows).toHaveLength(23);
    expect(totals.totalSec).toBe(10260);
    expect(totals.availableSec).toBe(10200);
    expect(totals.overUnderSec).toBe(-60);
    expect(totals.state).toBe('tight');
    expect(rows[0].startTime).toBe('19:00');
    expect(rows[1].startOffsetSec).toBe(300);
    expect(totals.byGroup.house).toBe(180);
    expect(totals.byGroup.sean).toBe(10080);
  });

  it('sorts by order, tie-breaking by id', () => {
    const segments = [
      seg('b', 60, { order: 2000 }),
      seg('z', 60, { order: 1000 }),
      seg('a', 60, { order: 2000 }),
    ];
    const { rows } = computeSchedule(season, segments, []);
    expect(rows.map((r) => r.segmentId)).toEqual(['z', 'a', 'b']);
  });

  it('reports ok and over states', () => {
    expect(computeSchedule(season, [seg('s1', 10200)], []).totals.state).toBe('ok');
    expect(computeSchedule(season, [seg('s1', 10201)], []).totals.state).toBe('tight');
    expect(computeSchedule(season, [seg('s1', 10800)], []).totals.state).toBe('tight');
    const over = computeSchedule(season, [seg('s1', 10801)], []).totals;
    expect(over.state).toBe('over');
    expect(over.overUnderSec).toBe(-601);
  });

  it('wraps clock times past midnight', () => {
    const late = { ...season, showStartTime: '23:30' };
    const { rows } = computeSchedule(late, [seg('s1', 1800), seg('s2', 600)], []);
    expect(rows[0].startTime).toBe('23:30');
    expect(rows[1].startTime).toBe('00:00');
    expect(rows[1].endOffsetSec).toBe(2400);
  });

  it('starts a segment at a later hardTime and counts the gap', () => {
    const { rows, totals } = computeSchedule(
      season,
      [seg('s1', 600), seg('s2', 300, { hardTime: '19:15' })],
      [],
    );
    expect(rows[1].hardTimeGapSec).toBe(300);
    expect(rows[1].hardTimeConflict).toBe(false);
    expect(rows[1].startOffsetSec).toBe(900);
    expect(rows[1].startTime).toBe('19:15');
    expect(totals.totalSec).toBe(1200);
    expect(totals.byGroup.sean).toBe(900);
  });

  it('flags an earlier hardTime as a conflict and keeps the computed start', () => {
    const { rows } = computeSchedule(
      season,
      [seg('s1', 600), seg('s2', 300, { hardTime: '19:05' })],
      [],
    );
    expect(rows[1].hardTimeConflict).toBe(true);
    expect(rows[1].hardTimeGapSec).toBe(0);
    expect(rows[1].startOffsetSec).toBe(600);
  });

  it('treats a hardTime equal to the computed start as neither gap nor conflict', () => {
    const { rows } = computeSchedule(season, [seg('s1', 600), seg('s2', 60, { hardTime: '19:10' })], []);
    expect(rows[1].hardTimeGapSec).toBe(0);
    expect(rows[1].hardTimeConflict).toBe(false);
  });

  it('handles hardTime across midnight, a hardTime before showStart, and invalid ones', () => {
    const late = { ...season, showStartTime: '23:00' };
    const across = computeSchedule(late, [seg('s1', 600), seg('s2', 60, { hardTime: '00:30' })], []);
    expect(across.rows[1].startOffsetSec).toBe(5400);
    expect(across.rows[1].hardTimeGapSec).toBe(4800);

    const before = computeSchedule(season, [seg('s1', 60, { hardTime: '18:00' })], []);
    expect(before.rows[0].hardTimeConflict).toBe(true);
    expect(before.rows[0].startOffsetSec).toBe(0);

    const bad = computeSchedule(season, [seg('s1', 60, { hardTime: 'later' })], []);
    expect(bad.rows[0].hardTimeConflict).toBe(false);
    expect(bad.rows[0].hardTimeGapSec).toBe(0);
  });

  it('sets switch cues when playback source changes, ignoring none', () => {
    const segments = [
      seg('s1', 60, { playbackSource: 'slides' }),
      seg('s2', 60, { playbackSource: 'slides' }),
      seg('s3', 60, { playbackSource: 'video' }),
      seg('s4', 60, { playbackSource: 'none' }),
      seg('s5', 60, { playbackSource: 'browser' }),
      seg('s6', 60, { playbackSource: 'browser' }),
    ];
    const { rows } = computeSchedule(season, segments, []);
    expect(rows.map((r) => r.switchCue)).toEqual([false, false, true, false, false, false]);
  });

  it('rolls up pieces without changing durations', () => {
    const segments = [seg('s1', 300), seg('s2', 300), seg('s3', 300)];
    const pieces = [
      piece('p1', 's1', { estSec: 100 }),
      piece('p2', 's1', { estSec: 100, confirmedSec: 120 }),
      piece('p3', 's2', { measuredSec: 400 }),
      piece('p4', undefined, { measuredSec: 999 }),
      piece('p5', 'gone', { measuredSec: 999 }),
    ];
    const { rows, totals } = computeSchedule(season, segments, pieces);
    expect(rows[0]).toMatchObject({ piecesSec: 220, pieceCount: 2, piecesOver: false, durationSec: 300 });
    expect(rows[1]).toMatchObject({ piecesSec: 400, pieceCount: 1, piecesOver: true, durationSec: 300 });
    expect(rows[2]).toMatchObject({ piecesSec: 0, pieceCount: 0, piecesOver: false });
    expect(totals.totalSec).toBe(900);
  });

  it('sums durations by owner group', () => {
    const segments = [
      seg('s1', 100),
      seg('s2', 200, { ownerPersonIds: ['p1'] }),
      seg('s3', 300, { type: 'intermission' }),
      seg('s4', 400, { presenterLabel: 'Sharemony' }),
    ];
    const { rows, totals } = computeSchedule(season, segments, []);
    expect(rows.map((r) => r.group)).toEqual(['sean', 'contributors', 'house', 'house']);
    expect(totals.byGroup).toEqual({ sean: 100, contributors: 200, house: 700 });
  });
});
