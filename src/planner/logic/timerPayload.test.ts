import { describe, expect, it } from 'vitest';
import type { PlaybackSource, Segment, SegmentType, WithId } from '../types';
import { timerPresenterFor, timerTypeFor, toTimerPayload } from './timerPayload';

const people = new Map([
  ['p1', { name: 'Ada Example' }],
  ['p2', { name: 'Ben Sample' }],
]);

function seg(over: Partial<WithId<Segment>> & { id: string }): WithId<Segment> {
  return {
    order: 1000,
    title: 'Bit',
    type: 'live',
    playbackSource: 'none',
    plannedSec: 300,
    ownerPersonIds: [],
    ...over,
  };
}

describe('timerTypeFor', () => {
  const t = (type: SegmentType, playbackSource: PlaybackSource) =>
    timerTypeFor({ type, playbackSource });
  it('maps each type', () => {
    expect(t('intermission', 'none')).toBe('intermission');
    expect(t('pretape', 'slides')).toBe('pretape');
    expect(t('live', 'video')).toBe('live');
    expect(t('song', 'video')).toBe('pretape');
    expect(t('song', 'live-music')).toBe('live');
    expect(t('song', 'none')).toBe('live');
  });
});

describe('timerPresenterFor', () => {
  it('joins owners', () => {
    expect(timerPresenterFor({ ownerPersonIds: ['p1', 'p2'] }, people)).toBe('Ada Example & Ben Sample');
  });
  it('skips unknown ids', () => {
    expect(timerPresenterFor({ ownerPersonIds: ['zzz', 'p2'] }, people)).toBe('Ben Sample');
  });
  it('falls back to presenterLabel then Sean Simon', () => {
    expect(timerPresenterFor({ ownerPersonIds: [], presenterLabel: 'Sharemony' }, people)).toBe('Sharemony');
    expect(timerPresenterFor({ ownerPersonIds: ['zzz'], presenterLabel: ' ' }, people)).toBe('Sean Simon');
    expect(timerPresenterFor({ ownerPersonIds: [] }, people)).toBe('Sean Simon');
  });
});

describe('toTimerPayload', () => {
  it('keeps order and maps fields', () => {
    const out = toTimerPayload(
      { showStartTime: '19:00' },
      [
        seg({ id: 'b', title: 'Welcome', plannedSec: 360, ownerPersonIds: ['p1'] }),
        seg({ id: 'a', title: 'Clip', type: 'pretape', plannedSec: 90 }),
      ],
      people,
      1234,
    );
    expect(out).toEqual({
      showStartTime: '19:00',
      updatedAtMs: 1234,
      segments: [
        { id: 'b', title: 'Welcome', presenter: 'Ada Example', type: 'live', durationSec: 360 },
        { id: 'a', title: 'Clip', presenter: 'Sean Simon', type: 'pretape', durationSec: 90 },
      ],
    });
  });
  it('handles an empty list', () => {
    expect(toTimerPayload({ showStartTime: '19:00' }, [], people, 1).segments).toEqual([]);
  });
});
