import { describe, expect, it } from 'vitest';
import type { ShowConfig } from '../types';
import {
  formatMSS,
  mapAttendees,
  mapAwards2026,
  mapFilms,
  mapIdeas,
  mapMaybeInvites,
  mapPostmortem,
  mapQuestions,
  mapTimerSegments,
  mapVenues,
  normalizeName,
  seasonTotalSec,
  splitPresenters,
} from './importers';
import { defaultSteps } from './steps';

describe('name helpers', () => {
  it('normalizes names', () => {
    expect(normalizeName('  Adá   EXAMPLE ')).toBe('ada example');
  });

  it('splits presenters and drops the house', () => {
    expect(splitPresenters('Ada Example & Ben Sample')).toEqual(['Ada Example', 'Ben Sample']);
    expect(splitPresenters('Sharemony')).toEqual([]);
    expect(splitPresenters('sean simon & Ada Example &')).toEqual(['Ada Example']);
    expect(splitPresenters('')).toEqual([]);
  });

  it('formats m:ss', () => {
    expect(formatMSS(171 * 60)).toBe('171:00');
    expect(formatMSS(65)).toBe('1:05');
    expect(formatMSS(0)).toBe('0:00');
  });

  it('totals planned seconds', () => {
    expect(seasonTotalSec([{ plannedSec: 60 }, { plannedSec: 90 }])).toBe(150);
    expect(seasonTotalSec([])).toBe(0);
  });
});

describe('mapTimerSegments', () => {
  const config: ShowConfig = {
    showStartTime: '19:00',
    updatedAtMs: 0,
    segments: [
      { id: 't1', title: 'Welcome', presenter: 'Sharemony', type: 'live', durationSec: 300 },
      { id: 't2', title: 'Ada bit', presenter: 'Ada Example & Ben Sample', type: 'live', durationSec: 360 },
      { id: 't3', title: 'Clip', presenter: '', type: 'pretape', durationSec: 90 },
      { id: 't4', title: 'Break', presenter: '', type: 'intermission', durationSec: 600 },
    ],
  };

  it('maps segments', () => {
    const out = mapTimerSegments(config);
    expect(out[0]).toEqual({
      importKey: 't1',
      segment: {
        order: 1000,
        title: 'Welcome',
        type: 'live',
        playbackSource: 'slides',
        plannedSec: 300,
        ownerPersonIds: [],
        presenterLabel: 'Sharemony',
      },
      ownerNames: [],
      problems: [],
    });
    expect(out[1].ownerNames).toEqual(['Ada Example', 'Ben Sample']);
    expect(out[2].segment).toEqual({
      order: 3000,
      title: 'Clip',
      type: 'pretape',
      playbackSource: 'video',
      plannedSec: 90,
      ownerPersonIds: [],
    });
    expect(out[3].segment.playbackSource).toBe('none');
    expect(seasonTotalSec(out.map((o) => o.segment))).toBe(1350);
  });

  it('flags bad data', () => {
    const out = mapTimerSegments({
      ...config,
      segments: [
        { id: 'x', title: ' ', presenter: '', type: 'live', durationSec: 0 },
        { id: 'y', title: 'Odd', presenter: '', type: 'song' as never, durationSec: 1.5 },
      ],
    });
    expect(out[0].problems).toHaveLength(2);
    expect(out[1].problems).toHaveLength(2);
  });
});

describe('mapAttendees', () => {
  it('maps people and invitations', () => {
    const out = mapAttendees([
      { name: 'Ada Example', plus_ones: '2', brunch: 'Yes', notes: 'vegan' },
      { name: 'Ben Sample', plus_ones: '', brunch: 'no', notes: '' },
    ]);
    expect(out[0]).toEqual({
      importKey: 'ada example',
      person: { name: 'Ada Example' },
      invitation: { status: 'confirmed', plusOnes: 2, brunch: true, rsvpIds: [], notes: 'vegan' },
      problems: [],
    });
    expect(out[1].invitation).toEqual({
      status: 'confirmed',
      plusOnes: 0,
      brunch: false,
      rsvpIds: [],
    });
  });

  it('flags non-numeric plus-ones, blanks and duplicates', () => {
    const out = mapAttendees([
      { name: 'Ada Example', plus_ones: 'two', brunch: '', notes: '' },
      { name: 'ada  example', plus_ones: '0', brunch: '', notes: '' },
      { name: '', plus_ones: '0', brunch: '', notes: '' },
    ]);
    expect(out[0].problems).toHaveLength(1);
    expect(out[0].invitation.plusOnes).toBe(0);
    expect(out[1].problems).toEqual(['Duplicate name "ada  example".']);
    expect(out[2].problems).toEqual(['Name is blank.']);
  });
});

describe('mapMaybeInvites', () => {
  it('maps people with optional notes', () => {
    expect(
      mapMaybeInvites([
        { name: 'Ada Example', notes: 'maybe' },
        { name: 'Ben Sample', notes: '' },
        { name: '', notes: '' },
      ]),
    ).toEqual([
      { importKey: 'ada example', person: { name: 'Ada Example', notes: 'maybe' }, problems: [] },
      { importKey: 'ben sample', person: { name: 'Ben Sample' }, problems: [] },
      { importKey: '', person: { name: '' }, problems: ['Name is blank.'] },
    ]);
  });
});

describe('mapAwards2026 segment matching', () => {
  const row = (block: string) => ({ name: 'Best Example', block, recognizes: '', format: '', video_seconds: '', winner: '' });

  it('matches "The Seanscars" for the finale and prefers the after-intermission segment', () => {
    const segments = [
      { id: 'more', title: 'A few more Seanscar awards' },
      { id: 'finale', title: 'The Seanscars' },
    ];
    const [after, finale] = mapAwards2026([row('after-intermission'), row('finale')], segments);
    expect(after.award.segmentId).toBe('more');
    expect(finale.award.segmentId).toBe('finale');
  });

  it('falls back to the Seanscars segment after intermission', () => {
    const [after] = mapAwards2026([row('after-intermission')], [{ id: 'main', title: 'Seanscars' }]);
    expect(after.award.segmentId).toBe('main');
  });
});

describe('mapAwards2026', () => {
  const segments = [
    { id: 'seg-open', title: 'Welcome & Initial Awards' },
    { id: 'seg-main', title: 'seanscars' },
  ];

  it('maps awards and pieces', () => {
    const out = mapAwards2026(
      [
        {
          name: 'Best Example',
          block: 'opening',
          recognizes: 'Examples',
          format: 'clip',
          video_seconds: '95',
          winner: 'Sample Film',
        },
        { name: 'Best Sample', block: 'finale', recognizes: '', format: '', video_seconds: '', winner: '' },
      ],
      segments,
    );
    expect(out[0]).toEqual({
      importKey: 'best example',
      award: {
        order: 1000,
        name: 'Best Example',
        recognizes: 'Examples',
        stage: 'winner',
        returning: true,
        segmentId: 'seg-open',
        contenders: [{ id: 'winner', label: 'Sample Film', nominee: true }],
        winnerContenderId: 'winner',
        notes: 'Format: clip',
      },
      piece: {
        title: 'Best Example',
        kind: 'award-video',
        ownerPersonIds: [],
        segmentId: 'seg-open',
        order: 1000,
        steps: defaultSteps('award-video', 'done'),
        measuredSec: 95,
        links: [],
      },
      problems: [],
    });
    expect(out[1].award).toEqual({
      order: 2000,
      name: 'Best Sample',
      stage: 'nominees',
      returning: true,
      segmentId: 'seg-main',
      contenders: [],
    });
    expect(out[1].piece).not.toHaveProperty('measuredSec');
  });

  it('flags unknown blocks, missing segments and bad seconds', () => {
    const out = mapAwards2026(
      [
        { name: 'A', block: 'encore', recognizes: '', format: '', video_seconds: 'x', winner: '' },
        { name: 'B', block: 'opening', recognizes: '', format: '', video_seconds: '', winner: '' },
        { name: '', block: '', recognizes: '', format: '', video_seconds: '', winner: '' },
      ],
      [],
    );
    expect(out[0].problems).toHaveLength(2);
    expect(out[0].award).not.toHaveProperty('segmentId');
    expect(out[1].problems).toHaveLength(1);
    expect(out[2].problems).toEqual(['Name is blank.']);
  });
});

describe('mapFilms', () => {
  it('maps films', () => {
    const out = mapFilms([
      { title: 'Sample Film', seen: 'Y', reaction: 'Loved', ideas: 'trailer bit' },
      { title: 'Other Film', seen: 'N', reaction: '', ideas: '' },
      { title: 'Third', seen: 'n', reaction: 'great', ideas: '' },
    ]);
    expect(out[0].film).toEqual({
      title: 'Sample Film',
      seen: true,
      reaction: 'loved',
      eligible: true,
      onBallot: false,
      ideas: 'trailer bit',
    });
    expect(out[1].film).toEqual({ title: 'Other Film', seen: false, eligible: true, onBallot: false });
    expect(out[2].problems).toHaveLength(1);
    expect(out[2].film).not.toHaveProperty('reaction');
  });
});

describe('mapIdeas', () => {
  it('maps ideas and defaults bad tags', () => {
    const out = mapIdeas([
      { tag: 'Song', text: 'A parody' },
      { tag: 'skit', text: 'Something' },
      { tag: 'bit', text: '' },
    ]);
    expect(out[0]).toEqual({ importKey: 'a parody', idea: { text: 'A parody', tag: 'song' }, problems: [] });
    expect(out[1].idea.tag).toBe('other');
    expect(out[1].problems).toHaveLength(1);
    expect(out[2].problems).toEqual(['Text is blank.']);
  });
});

describe('mapVenues', () => {
  it('maps venues', () => {
    const out = mapVenues([
      {
        name: 'Example Hall',
        status: 'Inquired',
        dates_offered: 'Mar 6, Mar 7',
        quote_usd: '$1,250',
        capacity: '130-165',
        notes: 'Nice',
        link: 'https://example.com',
      },
      { name: 'Plain Room', status: 'booked', dates_offered: '', quote_usd: '', capacity: '60', notes: '', link: '' },
    ]);
    expect(out[0].venue).toEqual({
      name: 'Example Hall',
      status: 'inquired',
      datesOffered: 'Mar 6, Mar 7',
      quoteUsd: 1250,
      capacity: 130,
      links: [{ label: 'Link', url: 'https://example.com' }],
      notes: 'Nice\nCapacity: 130-165',
    });
    expect(out[1].venue).toEqual({ name: 'Plain Room', status: 'booked', capacity: 60, links: [] });
  });

  it('flags bad status and quote', () => {
    const out = mapVenues([
      { name: 'X', status: 'maybe', dates_offered: '', quote_usd: 'call', capacity: '', notes: '', link: '' },
    ]);
    expect(out[0].problems).toHaveLength(2);
    expect(out[0].venue.status).toBe('researching');
    expect(out[0].venue).not.toHaveProperty('quoteUsd');
  });
});

describe('mapQuestions', () => {
  it('maps questions', () => {
    const out = mapQuestions([
      { question: 'Which date?', due: '2026-11-01', notes: 'soon' },
      { question: 'Cap?', due: 'next week', notes: '' },
    ]);
    expect(out[0].question).toEqual({
      question: 'Which date?',
      dueDate: '2026-11-01',
      status: 'open',
      notes: 'soon',
    });
    expect(out[1].question).toEqual({ question: 'Cap?', status: 'open' });
    expect(out[1].problems).toHaveLength(1);
  });
});

describe('mapPostmortem', () => {
  it('maps checklist items with ordering and optional prefix', () => {
    const out = mapPostmortem([
      { area: 'Audio', text: 'Test levels', priority: 'must' },
      { area: '', text: 'Add confetti', priority: 'Optional' },
    ]);
    expect(out[0]).toEqual({
      importKey: 'test levels',
      item: { text: 'Test levels', area: 'Audio', done: false, order: 1000 },
      problems: [],
    });
    expect(out[1].importKey).toBe('add confetti');
    expect(out[1].item).toEqual({ text: '(optional) Add confetti', done: false, order: 2000 });
  });
});
