import type { Segment, Season, ShowConfig, TimerSegment, TimerSegmentType, WithId } from '../types';

/*
 * Turns planner segments into the run-of-show document the backstage timer
 * reads (showConfigs/{timerDocId}). Pure: the caller supplies the ordered
 * segments, the people lookup and the clock.
 */

const DEFAULT_PRESENTER = 'Sean Simon';

/** Timer type for a planner segment: intermission→intermission; pretape→pretape; song→pretape if playbackSource is 'video' else live; live→live. */
export function timerTypeFor(seg: Pick<Segment, 'type' | 'playbackSource'>): TimerSegmentType {
  switch (seg.type) {
    case 'intermission':
      return 'intermission';
    case 'pretape':
      return 'pretape';
    case 'song':
      return seg.playbackSource === 'video' ? 'pretape' : 'live';
    default:
      return 'live';
  }
}

/** Owner names joined with ' & ' (unknown ids skipped), else presenterLabel, else 'Sean Simon'. */
export function timerPresenterFor(
  seg: Pick<Segment, 'ownerPersonIds' | 'presenterLabel'>,
  peopleById: ReadonlyMap<string, { name: string }>,
): string {
  const names = seg.ownerPersonIds
    .map((id) => peopleById.get(id)?.name.trim())
    .filter((name): name is string => !!name);
  if (names.length > 0) return names.join(' & ');
  return seg.presenterLabel?.trim() || DEFAULT_PRESENTER;
}

/**
 * Payload for showConfigs/{timerDocId}. `orderedSegments` is already in running order.
 * id = planner segment id; durationSec = plannedSec; updatedAtMs = nowMs.
 */
export function toTimerPayload(
  season: Pick<Season, 'showStartTime'>,
  orderedSegments: WithId<Segment>[],
  peopleById: ReadonlyMap<string, { name: string }>,
  nowMs: number,
): ShowConfig {
  const segments: TimerSegment[] = orderedSegments.map((seg) => ({
    id: seg.id,
    title: seg.title,
    presenter: timerPresenterFor(seg, peopleById),
    type: timerTypeFor(seg),
    durationSec: seg.plannedSec,
  }));
  return { showStartTime: season.showStartTime, segments, updatedAtMs: nowMs };
}
