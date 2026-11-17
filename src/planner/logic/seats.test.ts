import { describe, expect, it } from 'vitest';
import { assignSeats, buildParties, resizeNames, rowLengths, rowLetter, seatLabel, suggestions, tallySeats } from './seats';

const ts = (ms: number) => ({ toMillis: () => ms });

const people = [
  { id: 'a', name: 'Avery' },
  { id: 'b', name: 'Bea' },
  { id: 'c', name: 'Cal' },
  { id: 'd', name: 'Dana' },
  { id: 'e', name: 'Eli', notes: 'Came in 2024' },
  { id: 'f', name: 'Fern Castellano' },
  { id: 'g', name: 'Gus Old Name' },
];

const invs = [
  { id: 'a', status: 'invite?' as const, plusOnes: 2, plusOneNames: ['Fern Castellano'], createdAt: ts(1) },
  { id: 'b', status: 'confirmed' as const, plusOnes: 0, createdAt: ts(5) },
  { id: 'c', status: 'invite?' as const, plusOnes: 0, createdAt: ts(0) },
  { id: 'd', status: 'declined' as const, plusOnes: 1, createdAt: ts(0) },
  { id: 'e', status: 'not-inviting' as const, plusOnes: 0, createdAt: ts(0) },
];

describe('seats', () => {
  it('orders parties by status, then by when they were added', () => {
    const parties = buildParties(people, invs);
    expect(parties.map((p) => p.personId)).toEqual(['b', 'c', 'a']);
    expect(parties[2]).toMatchObject({ size: 3, plusOneNames: ['Fern Castellano'] });
  });

  it('seats each party together and marks seats past capacity', () => {
    const parties = buildParties(people, invs);
    const seats = assignSeats(parties, 4);
    expect(seats.map((s) => [s.party?.personId, s.slot, s.over])).toEqual([
      ['b', 0, false],
      ['c', 0, false],
      ['a', 0, false],
      ['a', 1, false],
      ['a', 2, true],
    ]);
    expect(assignSeats([], 3).every((s) => s.party === null)).toBe(true);
  });

  it('tallies guests, plus-ones and free seats', () => {
    const t = tallySeats(buildParties(people, invs), 58);
    expect(t).toMatchObject({ guests: 3, plusOnes: 2, total: 5, free: 53 });
    expect(t.byStatus.confirmed).toBe(1);
    expect(t.byStatus['invite?']).toBe(4);
  });

  it('lays out rows and labels them', () => {
    expect(rowLengths(58)).toEqual([10, 10, 10, 10, 10, 8]);
    expect(rowLengths(0)).toEqual([]);
    expect([rowLetter(0), rowLetter(25), rowLetter(26)]).toEqual(['A', 'Z', 'AA']);
  });

  it('labels plus-one seats by name when known', () => {
    const seats = assignSeats(buildParties(people, invs), 58);
    expect(seats.slice(2, 5).map(seatLabel)).toEqual(['Avery', 'Fern Castellano (Avery’s guest)', 'Avery’s guest 2']);
    expect(seatLabel(seats[10])).toBe('Empty seat');
  });

  it('suggests unseated people and flags ones already counted as a plus-one or alias', () => {
    const withAlias = people.map((p) => (p.id === 'b' ? { ...p, aliases: ['Gus Old Name'] } : p));
    const s = suggestions(withAlias, invs, buildParties(withAlias, invs));
    expect(s.map((x) => [x.personId, x.status, x.countedWith])).toEqual([
      ['d', 'declined', undefined],
      ['e', 'not-inviting', undefined],
      ['f', undefined, 'Avery'],
      ['g', undefined, 'Bea'],
    ]);
  });

  it('resizes plus-one names', () => {
    expect(resizeNames(['A', 'B', 'C'], 2)).toEqual(['A', 'B']);
    expect(resizeNames(['A', '', ''], 3)).toEqual(['A']);
    expect(resizeNames(undefined, 2)).toEqual([]);
  });
});
