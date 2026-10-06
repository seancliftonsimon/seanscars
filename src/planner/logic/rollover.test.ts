import { describe, expect, it } from 'vitest';
import type { Award, Invitation, Season, Segment, WithId } from '../types';
import { planRollover, rolloverDocId } from './rollover';

const season: Season = {
  year: 2026,
  name: '2026 Award Sharemony',
  showStartTime: '18:30',
  runtimeCapSec: 9000,
  bufferTargetSec: 300,
  timerDocId: 'seanscars-2026-rundown',
  archived: true,
  capacity: 56,
};

const segments: WithId<Segment>[] = [
  {
    id: 's1',
    order: 1000,
    title: 'Welcome',
    type: 'live',
    playbackSource: 'slides',
    plannedSec: 300,
    ownerPersonIds: [],
    presenterLabel: 'Sharemony',
    hardTime: '18:30',
  },
  {
    id: 's2',
    order: 2000,
    title: 'Ada deck',
    type: 'live',
    playbackSource: 'slides',
    plannedSec: 360,
    ownerPersonIds: ['p-ada'],
  },
  {
    id: 's3',
    order: 3000,
    title: 'Ben and Ada',
    type: 'live',
    playbackSource: 'slides',
    plannedSec: 390,
    ownerPersonIds: ['p-ben', 'p-ada'],
  },
  {
    id: 's4',
    order: 4000,
    title: 'Intermission',
    type: 'intermission',
    playbackSource: 'none',
    plannedSec: 600,
    ownerPersonIds: [],
    notes: 'Snacks',
  },
];

const awards: WithId<Award>[] = [
  {
    id: 'a1',
    order: 1000,
    name: 'Best Example',
    recognizes: 'Examples',
    stage: 'winner',
    returning: true,
    segmentId: 's1',
    contenders: [{ id: 'winner', label: 'Sample Film', nominee: true, slug: 'sample-film' }],
    winnerContenderIds: ['winner'],
    notes: 'Format: clip',
    variant: 'film-only',
    shortName: 'Examples',
    slug: 'best-example-2026',
  },
  { id: 'a2', order: 2000, name: 'One-off', stage: 'winner', returning: false, contenders: [] },
];

const invitations: WithId<Invitation>[] = [
  { id: 'p-ada', status: 'confirmed', plusOnes: 1, brunch: true, rsvpIds: ['r1'], notes: 'hi' },
  { id: 'p-ben', status: 'declined', plusOnes: 0, brunch: false, rsvpIds: [] },
];

describe('planRollover', () => {
  const plan = planRollover({ season, segments, awards, invitations }, 2027);

  it('creates the new season from defaults plus copied timing', () => {
    expect(plan.season).toEqual({
      year: 2027,
      name: '2027 Award Sharemony',
      showStartTime: '18:30',
      runtimeCapSec: 9000,
      bufferTargetSec: 300,
      timerDocId: 'seanscars-2027-rundown',
      archived: false,
    });
  });

  it('copies only returning awards as ideas', () => {
    expect(plan.awards).toEqual([
      {
        sourceId: 'a1',
        award: {
          order: 1000,
          name: 'Best Example',
          recognizes: 'Examples',
          stage: 'idea',
          returning: true,
          contenders: [],
          notes: 'Format: clip',
          variant: 'film-only',
          shortName: 'Examples',
        },
      },
    ]);
  });

  it('does not copy the slug, because it ends in the year', () => {
    expect(plan.awards[0].award).not.toHaveProperty('slug');
  });

  it('copies house segments only', () => {
    expect(plan.segments).toEqual([
      {
        sourceId: 's1',
        segment: {
          order: 1000,
          title: 'Welcome',
          type: 'live',
          playbackSource: 'slides',
          plannedSec: 300,
          ownerPersonIds: [],
          presenterLabel: 'Sharemony',
          hardTime: '18:30',
        },
      },
      {
        sourceId: 's4',
        segment: {
          order: 4000,
          title: 'Intermission',
          type: 'intermission',
          playbackSource: 'none',
          plannedSec: 600,
          ownerPersonIds: [],
          notes: 'Snacks',
        },
      },
    ]);
  });

  it('re-invites only confirmed guests', () => {
    expect(plan.invitations).toEqual([
      {
        personId: 'p-ada',
        invitation: { status: 'invite?', plusOnes: 1, brunch: false, rsvpIds: [] },
      },
    ]);
  });

  it('drafts a contributor piece per contributor segment', () => {
    expect(plan.pieces).toHaveLength(2);
    expect(plan.pieces[0].sourceId).toBe('s2');
    expect(plan.pieces[0].piece).toMatchObject({
      title: 'Ada deck',
      kind: 'contributor-deck',
      ownerPersonIds: ['p-ada'],
      estSec: 360,
      order: 2000,
      links: [],
      notes: 'Ask again? (2026 slot: 6 min)',
    });
    expect(plan.pieces[0].piece.steps.every((s) => s.status === 'todo')).toBe(true);
    expect(plan.pieces[0].piece.steps).toHaveLength(5);
    expect(plan.pieces[0].piece).not.toHaveProperty('segmentId');
    expect(plan.pieces[1].piece.notes).toBe('Ask again? (2026 slot: 6.5 min)');
    expect(plan.pieces[1].piece.ownerPersonIds).toEqual(['p-ben', 'p-ada']);
  });
});

describe('rolloverDocId', () => {
  it('is deterministic', () => {
    expect(rolloverDocId('piece', 's2')).toBe('piece-from-s2');
    expect(rolloverDocId('award', 'a1')).toBe('award-from-a1');
  });
});
