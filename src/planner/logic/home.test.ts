import { describe, expect, it } from 'vitest';
import { projectHeadcount } from './headcount';
import { homeActions, type HomeInput } from './home';
import type { NowItem } from './now';

const clock = { state: 'ok' as const, headline: 'Fits.', advice: null, trimToBufferSec: 0, trimToCapSec: 0, candidates: [] };
const item = (over: Partial<NowItem>): NowItem => ({ key: 'k', kind: 'piece', id: 'x', title: 'T', context: 'Next: Edit', href: '/h', ...over });
const base: HomeInput = {
  phase: 'production',
  now: { clock: { totalSec: 0, capSec: 0, bufferTargetSec: 0, availableSec: 0, overUnderSec: 0, state: 'ok', byGroup: { sean: 0, contributors: 0, house: 0 } }, decide: [], chase: [], make: [] },
  projection: projectHeadcount([], 50),
  send: { sent: 0, toSend: 0, total: 0 },
  waiting: [],
  inboxCount: 0,
  clock,
  segmentCount: 5,
  awardCount: 3,
  hasShowDate: true,
  readinessOpen: 0,
  seasonYear: 2027,
};

describe('homeActions', () => {
  it('starts a fresh season with the date and rollover', () => {
    const a = homeActions({ ...base, phase: 'setup', hasShowDate: false, segmentCount: 0, awardCount: 0 });
    expect(a.slice(0, 2).map((x) => x.key)).toEqual(['setup:date', 'setup:rollover']);
  });
  it('puts new RSVPs and overdue items first', () => {
    const now = { ...base.now, decide: [item({ key: 'question:q', kind: 'question', id: 'q', overdue: true })], make: [item({ key: 'piece:p', id: 'p' })] };
    const a = homeActions({ ...base, now, inboxCount: 2 });
    expect(a.map((x) => x.key)).toEqual(['rsvps', 'question:q', 'piece:p']);
    expect(a[0].title).toBe('File 2 new RSVPs');
    expect(a[1].inline).toEqual({ kind: 'answer', questionId: 'q' });
    expect(a[2].inline).toEqual({ kind: 'advance', pieceId: 'p' });
  });
  it('warns about capacity using everyone listed while building the list', () => {
    const projection = projectHeadcount([{ status: 'invite?', plusOnes: 1, brunch: false }], 1);
    const a = homeActions({ ...base, phase: 'lists', projection, send: { sent: 0, toSend: 1, total: 1 } });
    expect(a[0]).toMatchObject({ key: 'capacity', title: 'You’re 1 over capacity if everyone you’ve listed says yes.' });
    expect(a.find((x) => x.key === 'send')?.detail).toBe('0 of 1 sent.');
  });
  it('does not mention nudges before invitations are out', () => {
    const waiting = [{ id: 'p', daysWaiting: 30, daysSinceContact: 30 }];
    expect(homeActions({ ...base, phase: 'lists', waiting }).some((x) => x.key === 'nudge')).toBe(false);
    expect(homeActions({ ...base, phase: 'invites', waiting }).some((x) => x.key === 'nudge')).toBe(true);
  });
  it('raises an over-time show close to the date', () => {
    const over = { ...clock, state: 'over' as const, headline: '4:00 over.' };
    expect(homeActions({ ...base, clock: over })[0]).toMatchObject({ key: 'clock', urgent: true });
    expect(homeActions({ ...base, phase: 'lists', clock: over })[0].priority).toBe(55);
  });
  it('dims waiting pieces to the bottom', () => {
    const now = { ...base.now, make: [item({ key: 'w', dim: true, context: 'Waiting on X' }), item({ key: 'r' })] };
    expect(homeActions({ ...base, now }).map((x) => x.key)).toEqual(['r', 'w']);
  });
});
