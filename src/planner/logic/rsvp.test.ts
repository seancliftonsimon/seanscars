import { describe, expect, it } from 'vitest';
import type { Invitation, Person, WithId } from '../types';
import {
  applyRsvpToInvitation,
  contributorPieceFromRsvp,
  emailToSave,
  matchRsvp,
  rsvpBrunch,
  rsvpFullName,
  sortRsvpsNewestFirst,
  statusFromRsvp,
} from './rsvp';

describe('statusFromRsvp', () => {
  it('maps answers', () => {
    expect(statusFromRsvp('enthusiastically')).toBe('confirmed');
    expect(statusFromRsvp('  Tentatively ')).toBe('maybe');
    expect(statusFromRsvp('REGRETFULLY')).toBe('declined');
    expect(statusFromRsvp('whatever')).toBeNull();
    expect(statusFromRsvp('')).toBeNull();
  });
});

describe('rsvpBrunch', () => {
  it('reads booleans and Yes/No', () => {
    expect(rsvpBrunch(true)).toBe(true);
    expect(rsvpBrunch(false)).toBe(false);
    expect(rsvpBrunch('Yes')).toBe(true);
    expect(rsvpBrunch(' yes ')).toBe(true);
    expect(rsvpBrunch('No')).toBe(false);
    expect(rsvpBrunch(undefined)).toBe(false);
  });
});

describe('rsvpFullName', () => {
  it('trims and single-spaces', () => {
    expect(rsvpFullName({ firstName: ' Ada ', lastName: '  Example ' })).toBe('Ada Example');
    expect(rsvpFullName({ firstName: 'Ada', lastName: '' })).toBe('Ada');
  });
});

describe('matchRsvp', () => {
  const people: WithId<Person>[] = [
    { id: 'p1', name: 'Ada Example', email: 'Ada@example.com' },
    { id: 'p2', name: 'Grace Sample', aliases: ['Gracie Sample'] },
    { id: 'p3', name: 'José Test' },
  ];
  it('prefers email', () => {
    expect(matchRsvp({ firstName: 'Nope', lastName: 'Nobody', email: ' ada@EXAMPLE.com ' }, people)).toEqual({
      personId: 'p1',
      reason: 'email',
    });
  });
  it('falls back to name, ignoring case and accents', () => {
    expect(matchRsvp({ firstName: 'grace', lastName: 'sample', email: '' }, people)).toEqual({
      personId: 'p2',
      reason: 'name',
    });
    expect(matchRsvp({ firstName: 'Jose', lastName: 'Test', email: '' }, people)?.personId).toBe('p3');
  });
  it('then alias', () => {
    expect(matchRsvp({ firstName: 'Gracie', lastName: 'Sample', email: '' }, people)).toEqual({
      personId: 'p2',
      reason: 'alias',
    });
  });
  it('returns null when nothing matches', () => {
    expect(matchRsvp({ firstName: 'Zed', lastName: 'Unknown', email: 'z@example.com' }, people)).toBeNull();
    expect(matchRsvp({ firstName: '', lastName: '', email: '' }, people)).toBeNull();
  });
});

describe('applyRsvpToInvitation', () => {
  it('starts from defaults when there is no invitation', () => {
    expect(applyRsvpToInvitation(null, { rsvp: 'enthusiastically', brunch: 'Yes' }, 'r1', '2026-09-29')).toEqual({
      status: 'confirmed',
      plusOnes: 0,
      brunch: true,
      respondedAt: '2026-09-29',
      rsvpIds: ['r1'],
    });
  });
  it('keeps plusOnes, method, invitedAt, notes and status on unknown answers', () => {
    const existing: Invitation = {
      status: 'invited',
      plusOnes: 2,
      brunch: true,
      method: 'text',
      invitedAt: '2026-09-01',
      rsvpIds: ['r0'],
      notes: 'hi',
    };
    const out = applyRsvpToInvitation(existing, { rsvp: '???', brunch: false }, 'r1', '2026-09-29');
    expect(out).toEqual({
      status: 'invited',
      plusOnes: 2,
      brunch: false,
      method: 'text',
      invitedAt: '2026-09-01',
      respondedAt: '2026-09-29',
      rsvpIds: ['r0', 'r1'],
      notes: 'hi',
    });
  });
  it('does not duplicate rsvp ids', () => {
    const existing: Invitation = { status: 'maybe', plusOnes: 0, brunch: false, rsvpIds: ['r1'] };
    const out = applyRsvpToInvitation(existing, { rsvp: 'regretfully', brunch: 'No' }, 'r1', '2026-09-29');
    expect(out.rsvpIds).toEqual(['r1']);
    expect(out.status).toBe('declined');
  });
});

describe('emailToSave', () => {
  it('only when person lacks one and RSVP has one', () => {
    expect(emailToSave({}, { email: ' a@example.com ' })).toBe('a@example.com');
    expect(emailToSave({ email: 'x@example.com' }, { email: 'a@example.com' })).toBeUndefined();
    expect(emailToSave({}, { email: '  ' })).toBeUndefined();
  });
});

describe('contributorPieceFromRsvp', () => {
  it('builds a draft piece with Asked done', () => {
    const p = contributorPieceFromRsvp({ awardName: '  Best Example ' }, 'p1', 3000, '2026-09-29');
    expect(p.title).toBe('Best Example');
    expect(p.kind).toBe('contributor-deck');
    expect(p.ownerPersonIds).toEqual(['p1']);
    expect(p.order).toBe(3000);
    expect(p.links).toEqual([]);
    expect(p.notes).toBe('From RSVP 2026-09-29');
    expect(p.steps[0]).toMatchObject({ key: 'asked', status: 'done' });
    expect(p.steps.slice(1).every((s) => s.status === 'todo')).toBe(true);
  });
  it('falls back to a placeholder title', () => {
    expect(contributorPieceFromRsvp({ awardName: ' ' }, 'p1', 0, '2026-09-29').title).toBe('Untitled awards');
  });
});

describe('sortRsvpsNewestFirst', () => {
  it('sorts newest first with null as newest, without mutating', () => {
    const a = { id: 'a', createdAt: { toMillis: () => 1000 } };
    const b = { id: 'b', createdAt: { toMillis: () => 3000 } };
    const c = { id: 'c', createdAt: null };
    const input = [a, b, c];
    expect(sortRsvpsNewestFirst(input).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(input.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
