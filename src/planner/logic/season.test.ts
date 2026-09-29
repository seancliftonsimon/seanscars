import { describe, expect, it } from 'vitest';
import type { Season } from '../types';
import {
  defaultSeason,
  draftToPatch,
  isHHMM,
  isPublishableTimerDocId,
  minutesToSec,
  pickSeasonId,
  seasonToDraft,
  secToMinutes,
  suggestNextYear,
} from './season';

describe('defaultSeason', () => {
  it('uses the planner defaults', () => {
    expect(defaultSeason(2031)).toEqual({
      year: 2031,
      name: '2031 Award Sharemony',
      showStartTime: '19:00',
      runtimeCapSec: 10800,
      bufferTargetSec: 600,
      timerDocId: 'seanscars-2031-rundown',
      archived: false,
    });
  });
});

describe('time helpers', () => {
  it('validates HH:MM', () => {
    expect(isHHMM('19:00')).toBe(true);
    expect(isHHMM('00:05')).toBe(true);
    expect(isHHMM('7:00')).toBe(false);
    expect(isHHMM('24:00')).toBe(false);
    expect(isHHMM('19:60')).toBe(false);
  });

  it('converts minutes and seconds', () => {
    expect(minutesToSec(180)).toBe(10800);
    expect(minutesToSec(2.5)).toBe(150);
    expect(secToMinutes(600)).toBe(10);
    expect(secToMinutes(90)).toBe(1.5);
  });
});

describe('isPublishableTimerDocId', () => {
  it('matches the rules pattern', () => {
    expect(isPublishableTimerDocId('seanscars-2027-rundown')).toBe(true);
    expect(isPublishableTimerDocId('seanscars-2027-rundown-test')).toBe(true);
    expect(isPublishableTimerDocId('seanscars-1999-rundown')).toBe(false);
    expect(isPublishableTimerDocId('other-2027-rundown')).toBe(false);
  });
});

describe('pickSeasonId', () => {
  const seasons = [
    { id: '2030', year: 2030, archived: false },
    { id: '2031', year: 2031, archived: true },
    { id: '2029', year: 2029, archived: false },
  ];

  it('keeps a remembered season that still exists', () => {
    expect(pickSeasonId(seasons, '2029')).toBe('2029');
  });
  it('falls back to the latest non-archived season', () => {
    expect(pickSeasonId(seasons, null)).toBe('2030');
    expect(pickSeasonId(seasons, '1990')).toBe('2030');
  });
  it('falls back to the latest season when all are archived', () => {
    expect(pickSeasonId([{ id: '2028', year: 2028, archived: true }, { id: '2029', year: 2029, archived: true }], null)).toBe('2029');
  });
  it('returns null when there are no seasons', () => {
    expect(pickSeasonId([], '2030')).toBeNull();
  });
});

describe('suggestNextYear', () => {
  it('is the year after the latest season', () => {
    expect(suggestNextYear([{ year: 2030 }, { year: 2032 }])).toBe(2033);
  });
  it('is next calendar year with no seasons', () => {
    expect(suggestNextYear([], new Date(2030, 5, 1))).toBe(2031);
  });
});

describe('season drafts', () => {
  const season: Season = { ...defaultSeason(2030), doorsTime: '18:30', capacity: 40 };

  it('round-trips defaults', () => {
    const draft = seasonToDraft(season);
    expect(draft.runtimeCapMin).toBe('180');
    expect(draft.bufferTargetMin).toBe('10');
    const result = draftToPatch(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.runtimeCapSec).toBe(10800);
      expect(result.patch.bufferTargetSec).toBe(600);
      expect(result.patch.doorsTime).toBe('18:30');
      expect(result.patch.capacity).toBe(40);
      expect(result.patch.showDate).toBeUndefined();
    }
  });

  it('clears optional fields left blank', () => {
    const draft = { ...seasonToDraft(season), doorsTime: ' ', capacity: '' };
    const result = draftToPatch(draft);
    expect(result.ok && result.patch.doorsTime).toBeUndefined();
    expect(result.ok && 'capacity' in result.patch).toBe(true);
    expect(result.ok && result.patch.capacity).toBeUndefined();
  });

  it('reports invalid fields', () => {
    const draft = {
      ...seasonToDraft(season),
      name: '',
      showStartTime: '7pm',
      runtimeCapMin: '0',
      bufferTargetMin: 'x',
      capacity: '12.5',
      showDate: '2030-13-01',
    };
    const result = draftToPatch(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ['bufferTargetMin', 'capacity', 'name', 'runtimeCapMin', 'showDate', 'showStartTime'].sort(),
      );
    }
  });
});
