import { describe, expect, it } from 'vitest';
import type {
  Award,
  ChecklistItem,
  Invitation,
  Piece,
  Question,
  Segment,
  Venue,
  WithId,
} from '../types';
import { computeNow, daysBetween, type NowData } from './now';
import { defaultSteps } from './steps';

const TODAY = '2026-11-01';
const season = { showStartTime: '19:00', runtimeCapSec: 7200, bufferTargetSec: 300 };

const piece = (over: Partial<WithId<Piece>> = {}): WithId<Piece> => ({
  id: 'p1',
  title: 'Piece',
  kind: 'slides-bit',
  ownerPersonIds: [],
  order: 1000,
  steps: defaultSteps('slides-bit'),
  links: [],
  ...over,
});
const question = (over: Partial<WithId<Question>> = {}): WithId<Question> => ({
  id: 'q1',
  question: 'Which theme?',
  status: 'open',
  ...over,
});
const venue = (over: Partial<WithId<Venue>> = {}): WithId<Venue> => ({
  id: 'v1',
  name: 'Hall A',
  status: 'researching',
  links: [],
  ...over,
});
const award = (over: Partial<WithId<Award>> = {}): WithId<Award> => ({
  id: 'a1',
  order: 1000,
  name: 'Best Llama',
  stage: 'nominees',
  returning: false,
  contenders: [{ id: 'c1', label: 'One', nominee: true }],
  ...over,
});
const invitation = (over: Partial<WithId<Invitation>> = {}): WithId<Invitation> => ({
  id: 'u1',
  status: 'invited',
  plusOnes: 0,
  brunch: false,
  rsvpIds: [],
  ...over,
});
const segment = (over: Partial<WithId<Segment>> = {}): WithId<Segment> => ({
  id: 's1',
  order: 1000,
  title: 'Opening',
  type: 'live',
  playbackSource: 'none',
  plannedSec: 600,
  ownerPersonIds: [],
  ...over,
});
const task = (over: Partial<WithId<ChecklistItem>> = {}): WithId<ChecklistItem> => ({
  id: 'k1',
  text: 'Buy snacks',
  done: false,
  order: 1000,
  ...over,
});

const data = (over: Partial<NowData> = {}): NowData => ({
  awards: [],
  pieces: [],
  venues: [],
  questions: [],
  segments: [],
  invitations: [],
  checklist: [],
  peopleById: new Map([
    ['u1', { name: 'Ann' }],
    ['u2', { name: 'Bo' }],
  ]),
  ...over,
});

// venue booked so the "no venue" item does not add noise
const booked = venue({ id: 'vb', name: 'Booked', status: 'booked' });

describe('daysBetween', () => {
  it('counts whole days across months and years', () => {
    expect(daysBetween('2026-10-30', '2026-11-01')).toBe(2);
    expect(daysBetween('2026-11-01', '2026-10-30')).toBe(-2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
  });
});

describe('clock', () => {
  it('returns schedule totals', () => {
    const v = computeNow(season, data({ segments: [segment()], venues: [booked] }), TODAY);
    expect(v.clock.totalSec).toBe(600);
    expect(v.clock.state).toBe('ok');
  });
});

describe('decide', () => {
  it('orders questions by due date, undated last, ties by most blocked', () => {
    const d = data({
      venues: [booked],
      questions: [
        question({ id: 'qn', question: 'Undated' }),
        question({ id: 'qb', question: 'Late', dueDate: '2026-11-10' }),
        question({ id: 'qa', question: 'Tie few', dueDate: '2026-11-06' }),
        question({ id: 'qc', question: 'Tie many', dueDate: '2026-11-06' }),
        question({ id: 'qd', question: 'Done', status: 'decided' }),
      ],
      pieces: [
        piece({ id: 'w1', waitingOn: { kind: 'question', id: 'qc' } }),
        piece({ id: 'w2', waitingOn: { kind: 'question', id: 'qc' } }),
        piece({ id: 'w3', waitingOn: { kind: 'question', id: 'qa' } }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.decide.map((i) => i.id)).toEqual(['qc', 'qa', 'qb', 'qn']);
    expect(v.decide[0]).toMatchObject({
      key: 'question:qc',
      context: 'Due Nov 6 · 2 items wait on this',
      href: '/plan/logistics?question=qc',
    });
    expect(v.decide[1].context).toBe('Due Nov 6 · 1 item waits on this');
    expect(v.decide[3].context).toBe('No due date');
  });

  it('flags overdue questions', () => {
    const v = computeNow(
      season,
      data({ venues: [booked], questions: [question({ dueDate: '2026-10-31' })] }),
      TODAY,
    );
    expect(v.decide[0].overdue).toBe(true);
  });

  it('lists winnerless awards with derived-waiting pieces, most first', () => {
    const wait = (id: string, awardId: string) =>
      piece({
        id,
        kind: 'award-video',
        awardId,
        steps: defaultSteps('award-video').map((s, i) =>
          i < 2 ? { ...s, status: 'done' as const } : s,
        ),
      });
    const d = data({
      venues: [booked],
      awards: [
        award({ id: 'a1', name: 'One' }),
        award({ id: 'a2', name: 'Two' }),
        award({ id: 'a3', name: 'Three' }),
        award({ id: 'a4', name: 'Decided', winnerContenderId: 'c1' }),
      ],
      pieces: [wait('x1', 'a1'), wait('x2', 'a2'), wait('x3', 'a2'), wait('x4', 'a4')],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.decide.map((i) => i.key)).toEqual(['award:a2', 'award:a1']);
    expect(v.decide[0].context).toBe('2 pieces waiting on the winner');
    expect(v.decide[1].context).toBe('1 piece waiting on the winner');
    expect(v.decide[0].href).toBe('/plan/awards?award=a2');
  });

  it('adds "No venue booked" with option count unless booked', () => {
    const d = data({
      venues: [
        venue({ id: 'a', status: 'researching' }),
        venue({ id: 'b', status: 'holding' }),
        venue({ id: 'c', status: 'declined' }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.decide).toEqual([
      expect.objectContaining({
        key: 'venue:none',
        kind: 'venue',
        id: '',
        title: 'No venue booked',
        context: '2 options under consideration',
      }),
    ]);
    expect(computeNow(season, data({ venues: [booked] }), TODAY).decide).toEqual([]);
  });

  it('skips the venue item when an open question mentions venue', () => {
    const covered = data({ questions: [question({ question: 'Venue and date?' })] });
    expect(computeNow(season, covered, TODAY).decide.map((i) => i.kind)).toEqual(['question']);
    const decided = data({
      questions: [question({ question: 'Venue and date?', status: 'decided' })],
    });
    expect(computeNow(season, decided, TODAY).decide.map((i) => i.kind)).toEqual(['venue']);
  });
});

describe('chase', () => {
  const deck = (over: Partial<WithId<Piece>>) =>
    piece({ kind: 'contributor-deck', steps: defaultSteps('contributor-deck'), ...over });

  it('lists contributor decks not submitted, due within 7 days or past', () => {
    const submitted = defaultSteps('contributor-deck').map((s) =>
      s.key === 'submitted' ? { ...s, status: 'done' as const } : s,
    );
    const d = data({
      venues: [booked],
      pieces: [
        deck({ id: 'soon', title: 'Soon', dueDate: '2026-11-04', ownerPersonIds: ['u1'] }),
        deck({ id: 'late', title: 'Late', dueDate: '2026-10-30', ownerPersonIds: ['u1', 'u2'] }),
        deck({ id: 'today', title: 'Today', dueDate: TODAY }),
        deck({ id: 'far', title: 'Far', dueDate: '2026-11-09' }),
        deck({ id: 'edge', title: 'Edge', dueDate: '2026-11-08' }),
        deck({ id: 'undated', title: 'Undated' }),
        deck({ id: 'sent', title: 'Sent', dueDate: '2026-10-01', steps: submitted }),
        piece({ id: 'mine', dueDate: '2026-10-01' }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.chase.map((i) => i.id)).toEqual(['late', 'today', 'soon', 'edge']);
    expect(v.chase[0]).toMatchObject({
      title: 'Late',
      overdue: true,
      href: '/plan/awards?tab=pieces&piece=late',
    });
    expect(v.chase[0].context).toContain('Ann & Bo');
    expect(v.chase[0].context).toContain('due Oct 30 (2 days overdue)');
    expect(v.chase[1].context).toContain('due today');
    expect(v.chase[2].context).toContain('due in 3 days');
    expect(v.chase[2].overdue).toBe(false);
  });

  it('lists invitations invited more than 14 days ago, oldest first', () => {
    const d = data({
      venues: [booked],
      invitations: [
        invitation({ id: 'u2', invitedAt: '2026-10-05' }),
        invitation({ id: 'u1', invitedAt: '2026-10-01' }),
        invitation({ id: 'u3', invitedAt: '2026-10-18' }), // exactly 14 days: not yet
        invitation({ id: 'u4', invitedAt: '2026-09-01', status: 'confirmed' }),
        invitation({ id: 'u5' }), // no invitedAt
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.chase.map((i) => i.id)).toEqual(['u1', 'u2']);
    expect(v.chase[0]).toMatchObject({
      key: 'invitation:u1',
      title: 'Ann',
      context: 'Invited Oct 1, no reply for 31 days',
      href: '/plan/people?person=u1',
    });
  });

  it('lists inquired venues with stale or missing contact', () => {
    const d = data({
      venues: [
        booked,
        venue({ id: 'fresh', name: 'Fresh', status: 'inquired', lastContactDate: '2026-10-28' }),
        venue({ id: 'edge', name: 'Edge', status: 'inquired', lastContactDate: '2026-10-25' }),
        venue({ id: 'stale', name: 'Stale', status: 'inquired', lastContactDate: '2026-10-20' }),
        venue({ id: 'none', name: 'None', status: 'inquired' }),
        venue({ id: 'res', name: 'Res', status: 'researching' }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.chase.map((i) => i.id)).toEqual(['none', 'stale']);
    expect(v.chase[0].context).toContain('No contact date logged');
    expect(v.chase[1].context).toContain('Oct 20');
    expect(v.chase[1].href).toBe('/plan/logistics?venue=stale');
  });
});

describe('make', () => {
  it('sorts Sean pieces by due date then segment order, with next step', () => {
    const d = data({
      venues: [booked],
      segments: [
        segment({ id: 's1', order: 1000, title: 'First' }),
        segment({ id: 's2', order: 2000, title: 'Second' }),
      ],
      pieces: [
        piece({ id: 'noDue', title: 'NoDue', segmentId: 's1' }),
        piece({ id: 'b', title: 'B', dueDate: '2026-11-10', segmentId: 's2' }),
        piece({ id: 'a', title: 'A', dueDate: '2026-11-10', segmentId: 's1' }),
        piece({ id: 'c', title: 'C', dueDate: '2026-11-10' }),
        piece({ id: 'early', title: 'Early', dueDate: '2026-10-29' }),
        piece({ id: 'theirs', ownerPersonIds: ['u1'] }),
        piece({
          id: 'fin',
          steps: defaultSteps('slides-bit', 'done'),
        }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.make.map((i) => i.id)).toEqual(['early', 'a', 'b', 'c', 'noDue']);
    expect(v.make[1].context).toBe('Next: Draft · First · due Nov 10');
    expect(v.make[0]).toMatchObject({ overdue: true, kind: 'piece' });
    expect(v.make[4].context).toBe('Next: Draft · First');
    expect(v.make[3].context).toBe('Next: Draft · due Nov 10');
  });

  it('lists waiting pieces after, dimmed, with the reason', () => {
    const d = data({
      venues: [booked],
      awards: [award({ id: 'a1', name: 'Best Llama' })],
      pieces: [
        piece({
          id: 'w',
          title: 'Waiter',
          dueDate: '2026-10-01',
          waitingOn: { kind: 'award', id: 'a1' },
        }),
        piece({ id: 'r', title: 'Ready', dueDate: '2026-12-01' }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.make.map((i) => i.id)).toEqual(['r', 'w']);
    expect(v.make[1]).toMatchObject({
      dim: true,
      context: 'Waiting on Best Llama winner',
    });
    expect(v.make[0].dim).toBeUndefined();
  });

  it('lists checklist items due within 14 days or past', () => {
    const d = data({
      venues: [booked],
      checklist: [
        task({ id: 'soon', text: 'Soon', area: 'Food', dueDate: '2026-11-15' }),
        task({ id: 'late', text: 'Late', dueDate: '2026-10-30' }),
        task({ id: 'far', dueDate: '2026-11-16' }),
        task({ id: 'done', dueDate: '2026-11-02', done: true }),
        task({ id: 'none' }),
      ],
    });
    const v = computeNow(season, d, TODAY);
    expect(v.make.map((i) => i.id)).toEqual(['late', 'soon']);
    expect(v.make[0]).toMatchObject({ kind: 'checklist', overdue: true, context: 'due Oct 30', href: '/plan/logistics?checklist=late' });
    expect(v.make[1].context).toBe('Food · due Nov 15');
  });
});
