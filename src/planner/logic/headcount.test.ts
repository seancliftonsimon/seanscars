import { describe, expect, it } from 'vitest';
import { headcount, presentingIds } from './headcount';

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
