import { describe, expect, it } from 'vitest';
import type { Piece, Publish, WithId } from '../types';
import { readiness, type ReadinessInput } from './readiness';
import { defaultSteps } from './steps';

const totals = { totalSec: 100, capSec: 200, bufferTargetSec: 10, availableSec: 190, overUnderSec: 90, state: 'ok' as const, byGroup: { sean: 100, contributors: 0, house: 0 } };
const piece = (id: string, done: boolean, kind: Piece['kind'] = 'slides-bit'): WithId<Piece> => ({
  id, title: id, kind, ownerPersonIds: [], order: 0, links: [], steps: defaultSteps(kind, done ? 'done' : 'todo'),
});
const pub = (target: string): WithId<Publish> => ({
  id: target, at: null, targetDocId: target, segmentCount: 1, totalSec: 1, byEmail: 'x', payloadUpdatedAtMs: 1,
});
const base: ReadinessInput = {
  season: { timerDocId: 'live', showDate: '2027-01-10' }, totals, segmentCount: 3, pieces: [], awards: [], checklist: [],
  invitations: [], publishes: [], changedSinceLivePublish: false, today: '2027-01-05',
};
const byId = (input: Partial<ReadinessInput>) => Object.fromEntries(readiness({ ...base, ...input }).map((i) => [i.id, i]));

describe('readiness', () => {
  it('reports outstanding pieces and decks', () => {
    const r = byId({ pieces: [piece('a', false), piece('b', true), piece('d', false, 'contributor-deck')] });
    expect(r.pieces).toMatchObject({ done: false, detail: '2 pieces still in progress.' });
    expect(r.decks).toMatchObject({ done: false, detail: '1 of 1 not in the master deck yet.' });
  });
  it('needs a live publish that matches the plan', () => {
    expect(byId({ publishes: [pub('live-test')] }).published).toMatchObject({ done: false, detail: 'Only published to the test copy so far.' });
    expect(byId({ publishes: [pub('live')] }).unchanged.done).toBe(true);
    expect(byId({ publishes: [pub('live')], changedSinceLivePublish: true }).unchanged.done).toBe(false);
  });
  it('counts only checklist items due by show day', () => {
    const checklist = [
      { id: 't1', text: 'a', done: false, order: 0, dueDate: '2027-01-09' },
      { id: 't2', text: 'b', done: false, order: 0, dueDate: '2027-01-20' },
    ];
    expect(byId({ checklist }).tasks.detail).toBe('1 task due by show day still open.');
  });
  it('fails the clock when over the cap or empty', () => {
    expect(byId({ totals: { ...totals, state: 'over' } }).clock.done).toBe(false);
    expect(byId({ segmentCount: 0 }).clock.done).toBe(false);
  });
});

describe('timerTargetDocId', () => {
  it('uses the env value, else the timer default', async () => {
    const { timerTargetDocId } = await import('./readiness');
    expect(timerTargetDocId(' seanscars-2027-rundown ')).toBe('seanscars-2027-rundown');
    expect(timerTargetDocId(undefined)).toBe('seanscars-2026-rundown');
    expect(timerTargetDocId('')).toBe('seanscars-2026-rundown');
  });
});
