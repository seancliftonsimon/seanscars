import { describe, expect, it } from 'vitest';
import { capacityVerdict, headcount, presentingIds, projectHeadcount } from './headcount';

describe('headcount', () => {
  const invs = [
    { status: 'confirmed', plusOnes: 1, brunch: true },
    { status: 'confirmed', plusOnes: 0, brunch: false },
    { status: 'maybe', plusOnes: 2, brunch: true },
    { status: 'invite?', plusOnes: 0, brunch: false },
    { status: 'invited', plusOnes: 0, brunch: false },
    { status: 'declined', plusOnes: 0, brunch: false },
    { status: 'not-inviting', plusOnes: 0, brunch: false },
  ] as const;

  it('counts by status', () => {
    const h = headcount([...invs], 10);
    expect(h).toEqual({
      confirmedPeople: 2,
      confirmedPlusOnes: 1,
      total: 3,
      capacity: 10,
      remaining: 7,
      maybe: 1,
      inviteQ: 1,
      unanswered: 1,
      declined: 1,
      brunch: 1,
    });
  });
  it('handles missing capacity and over capacity', () => {
    expect(headcount([...invs], undefined)).toMatchObject({ capacity: null, remaining: null });
    expect(headcount([...invs], 2).remaining).toBe(-1);
  });
  it('handles empty', () => {
    expect(headcount([], 5).total).toBe(0);
  });
});

describe('presentingIds', () => {
  it('collects owners of contributor decks only', () => {
    const ids = presentingIds([
      { kind: 'contributor-deck', ownerPersonIds: ['a', 'b'] },
      { kind: 'song', ownerPersonIds: ['c'] },
      { kind: 'contributor-deck', ownerPersonIds: ['a'] },
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});

describe('projectHeadcount', () => {
  const list = [
    { status: 'confirmed', plusOnes: 1, brunch: true },
    { status: 'confirmed', plusOnes: 0, brunch: true },
    { status: 'maybe', plusOnes: 2, brunch: false },
    { status: 'invited', plusOnes: 1, brunch: false },
    { status: 'invite?', plusOnes: 1, brunch: false },
    { status: 'declined', plusOnes: 3, brunch: true },
    { status: 'not-inviting', plusOnes: 0, brunch: false },
  ] as const;

  it('counts plus-ones in every projection', () => {
    const p = projectHeadcount([...list], 8);
    expect(p.confirmed).toEqual({ people: 2, plusOnes: 1, total: 3, remaining: 5 });
    expect(p.likely).toEqual({ people: 4, plusOnes: 4, total: 8, remaining: 0 });
    expect(p.everyone).toEqual({ people: 5, plusOnes: 5, total: 10, remaining: -2 });
    expect(p.counts['invite?']).toBe(1);
  });
  it('counts brunch people and their plus-ones separately', () => {
    expect(projectHeadcount([...list], 8).brunch).toEqual({ people: 2, plusOnes: 1, total: 3 });
  });
  it('states the verdict in words', () => {
    const p = projectHeadcount([...list], 8);
    expect(capacityVerdict(p, 'everyone')).toMatchObject({ tone: 'over', text: 'You’re 2 over capacity if everyone you’ve listed says yes.' });
    expect(capacityVerdict(p, 'likely').tone).toBe('tight');
    expect(capacityVerdict(p, 'confirmed').text).toBe('5 seats to spare with everyone who has said yes.');
    expect(capacityVerdict(projectHeadcount([...list], null), 'confirmed').tone).toBe('unknown');
  });
});
