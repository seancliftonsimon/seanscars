import type { Piece, Segment, Season, WithId } from '../types';
import { isHHMM } from './season';

/*
 * Pure show-clock maths: turns ordered segments (plus the pieces attached to
 * them) into a wall-clock schedule and runtime totals. Segment durations are
 * always `plannedSec`; pieces are rolled up for comparison but never change
 * the schedule.
 */

export type OwnerGroup = 'sean' | 'contributors' | 'house';

const DAY_SEC = 24 * 60 * 60;
/** Hard times more than this far past showStartTime are read as "before the show". */
const MAX_FORWARD_SEC = 12 * 60 * 60;

/** House = type 'intermission' or presenterLabel 'Sharemony' (case-insensitive, trimmed). The one place this rule lives. */
export function isHouseSegment(seg: Pick<Segment, 'type' | 'presenterLabel'>): boolean {
  return seg.type === 'intermission' || (seg.presenterLabel ?? '').trim().toLowerCase() === 'sharemony';
}

/** 'contributors' if ownerPersonIds non-empty; else 'house' if isHouseSegment; else 'sean'. */
export function ownerGroup(
  seg: Pick<Segment, 'type' | 'presenterLabel' | 'ownerPersonIds'>,
): OwnerGroup {
  if (seg.ownerPersonIds.length > 0) return 'contributors';
  return isHouseSegment(seg) ? 'house' : 'sean';
}

/** measuredSec ?? confirmedSec ?? estSec ?? 0 */
export function pieceLengthSec(piece: Pick<Piece, 'measuredSec' | 'confirmedSec' | 'estSec'>): number {
  return piece.measuredSec ?? piece.confirmedSec ?? piece.estSec ?? 0;
}

export interface ScheduleRow {
  segmentId: string;
  startTime: string; // 'HH:MM' 24h, wraps past midnight
  startOffsetSec: number; // from showStartTime
  durationSec: number; // = plannedSec, never changed by pieces
  endOffsetSec: number;
  piecesSec: number; // sum of pieceLengthSec of pieces with segmentId === this segment
  pieceCount: number;
  piecesOver: boolean; // piecesSec > durationSec
  switchCue: boolean; // playbackSource differs from previous row's and neither is 'none' (first row: false)
  hardTimeGapSec: number; // >0 when hardTime is later than computed start (segment starts at hardTime)
  hardTimeConflict: boolean; // hardTime earlier than computed start (keep computed start)
  group: OwnerGroup;
}

export type ClockState = 'ok' | 'tight' | 'over';

export interface ScheduleTotals {
  totalSec: number; // end offset of last row, including hard-time gaps
  capSec: number; // season.runtimeCapSec
  bufferTargetSec: number;
  availableSec: number; // cap - buffer
  overUnderSec: number; // availableSec - totalSec (negative = into buffer or over)
  state: ClockState; // ok: totalSec <= availableSec; tight: <= capSec; over: > capSec
  byGroup: Record<OwnerGroup, number>; // sums of durationSec (gaps excluded)
}

export interface Schedule {
  rows: ScheduleRow[];
  totals: ScheduleTotals;
}

function hhmmToSec(hhmm: string | undefined): number | null {
  if (!hhmm || !isHHMM(hhmm)) return null;
  return Number(hhmm.slice(0, 2)) * 3600 + Number(hhmm.slice(3, 5)) * 60;
}

function secToHHMM(sec: number): string {
  const minutes = Math.floor((((sec % DAY_SEC) + DAY_SEC) % DAY_SEC) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Offset (seconds since showStart) of a hard time, or null if it is invalid.
 * Taken mod 24h so a show that crosses midnight works; anything more than 12h
 * "ahead" is treated as earlier than the show start (negative offset).
 */
function hardOffsetSec(hardTime: string | undefined, showStartSec: number): number | null {
  const t = hhmmToSec(hardTime);
  if (t === null) return null;
  const off = (((t - showStartSec) % DAY_SEC) + DAY_SEC) % DAY_SEC;
  return off > MAX_FORWARD_SEC ? off - DAY_SEC : off;
}

/**
 * Builds the running order: each segment starts when the previous one ends,
 * unless its hardTime is later, in which case it starts at the hardTime and
 * the gap counts toward the total. An earlier hardTime is flagged as a
 * conflict and the computed start is kept.
 */
export function computeSchedule(
  season: Pick<Season, 'showStartTime' | 'runtimeCapSec' | 'bufferTargetSec'>,
  segments: WithId<Segment>[],
  pieces: WithId<Piece>[],
): Schedule {
  const showStartSec = hhmmToSec(season.showStartTime) ?? 0;
  const sorted = [...segments].sort(
    (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const pieceRollup = new Map<string, { sec: number; count: number }>();
  for (const piece of pieces) {
    if (!piece.segmentId) continue;
    const entry = pieceRollup.get(piece.segmentId) ?? { sec: 0, count: 0 };
    entry.sec += pieceLengthSec(piece);
    entry.count += 1;
    pieceRollup.set(piece.segmentId, entry);
  }

  const byGroup: Record<OwnerGroup, number> = { sean: 0, contributors: 0, house: 0 };
  const rows: ScheduleRow[] = [];
  let cursor = 0;
  let prevSource: Segment['playbackSource'] | null = null;

  for (const seg of sorted) {
    let start = cursor;
    let hardTimeGapSec = 0;
    let hardTimeConflict = false;
    const hard = hardOffsetSec(seg.hardTime, showStartSec);
    if (hard !== null) {
      if (hard > start) {
        hardTimeGapSec = hard - start;
        start = hard;
      } else if (hard < start) {
        hardTimeConflict = true;
      }
    }

    const durationSec = seg.plannedSec;
    const rollup = pieceRollup.get(seg.id) ?? { sec: 0, count: 0 };
    const group = ownerGroup(seg);
    byGroup[group] += durationSec;

    rows.push({
      segmentId: seg.id,
      startTime: secToHHMM(showStartSec + start),
      startOffsetSec: start,
      durationSec,
      endOffsetSec: start + durationSec,
      piecesSec: rollup.sec,
      pieceCount: rollup.count,
      piecesOver: rollup.sec > durationSec,
      switchCue:
        prevSource !== null &&
        prevSource !== 'none' &&
        seg.playbackSource !== 'none' &&
        prevSource !== seg.playbackSource,
      hardTimeGapSec,
      hardTimeConflict,
      group,
    });

    cursor = start + durationSec;
    prevSource = seg.playbackSource;
  }

  const totalSec = rows.length > 0 ? rows[rows.length - 1].endOffsetSec : 0;
  const capSec = season.runtimeCapSec;
  const bufferTargetSec = season.bufferTargetSec;
  const availableSec = capSec - bufferTargetSec;
  const state: ClockState = totalSec <= availableSec ? 'ok' : totalSec <= capSec ? 'tight' : 'over';

  return {
    rows,
    totals: {
      totalSec,
      capSec,
      bufferTargetSec,
      availableSec,
      overUnderSec: availableSec - totalSec,
      state,
      byGroup,
    },
  };
}

/** 'HH:MM' -> '7:00 PM'. Returns the input unchanged if it is not a valid time. */
export function formatClockTime(hhmm: string): string {
  if (!isHHMM(hhmm)) return hhmm;
  const h = Number(hhmm.slice(0, 2));
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${hhmm.slice(3, 5)} ${suffix}`;
}
