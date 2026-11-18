import { describe, expect, it } from 'vitest';
import {
  assignSeats,
  buildParties,
  dropSide,
  expectedFrom,
  initials,
  moveParty,
  outlookOf,
  resizeNames,
  rowLengths,
  rowLetter,
  seatLabel,
  seatOrderPatches,
  shortName,
  suggestions,
  uniqueShortNames,
  tallySeats,
} from './seats';

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

describe('outlook', () => {
  it('uses the reply when there is one, else the guess (likely by default)', () => {
    expect(outlookOf('confirmed', 'unlikely')).toBe('coming');
    expect(outlookOf('maybe', 'likely')).toBe('maybe');
    expect(outlookOf('invited', 'unlikely')).toBe('unlikely');
    expect(outlookOf('invite?', undefined)).toBe('likely');
  });
});

describe('seats', () => {
  it('orders parties by outlook, then by when they were added', () => {
    const parties = buildParties(people, invs);
    expect(parties.map((p) => p.personId)).toEqual(['b', 'c', 'a']);
    expect(parties[2]).toMatchObject({ size: 3, plusOneNames: ['Fern Castellano'], outlook: 'likely' });
  });

  it('puts hand-placed parties first, in their order, and the rest after', () => {
    const placed = invs.map((i) => (i.id === 'a' ? { ...i, seatOrder: 1000 } : i.id === 'c' ? { ...i, seatOrder: 2000 } : i));
    expect(buildParties(people, placed).map((p) => p.personId)).toEqual(['a', 'c', 'b']);
  });

  it('seats each party together and marks seats past capacity', () => {
    const seats = assignSeats(buildParties(people, invs), 4);
    expect(seats.map((s) => [s.party?.personId, s.slot, s.over])).toEqual([
      ['b', 0, false],
      ['c', 0, false],
      ['a', 0, false],
      ['a', 1, false],
      ['a', 2, true],
    ]);
    expect(assignSeats([], 3).every((s) => s.party === null)).toBe(true);
  });

  it('tallies seats held, expected turnout and free seats', () => {
    const withGuesses = invs.map((i) => (i.id === 'a' ? { ...i, likelihood: 'unlikely' as const } : i.id === 'c' ? { ...i, likelihood: 'maybe' as const } : i));
    const t = tallySeats(buildParties(people, withGuesses), 58);
    expect(t).toMatchObject({ guests: 3, plusOnes: 2, total: 5, free: 53 });
    expect(t.byOutlook).toEqual({ coming: 1, likely: 0, maybe: 1, unlikely: 3 });
    // 1 + 0.5 + 3 × 0.2 = 2.1
    expect(t.expected).toBe(2);
    expect(t.expectedFree).toBe(56);
    expect(expectedFrom(8, 'unlikely')).toBe(2);
  });

  it('moves a party next to another, or to the end', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(moveParty(order, 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveParty(order, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(moveParty(order, 'b', null)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveParty(order, 'b', 'b')).toEqual(order);
    expect([dropSide(order, 'a', 'c'), dropSide(order, 'd', 'b')]).toEqual(['after', 'before']);
  });

  it('writes seatOrder only where it changes', () => {
    const parties = [
      { personId: 'a', seatOrder: 1000 },
      { personId: 'b', seatOrder: 2000 },
      { personId: 'c' },
    ];
    expect(seatOrderPatches(parties, ['a', 'c', 'b'])).toEqual([
      { personId: 'c', seatOrder: 2000 },
      { personId: 'b', seatOrder: 3000 },
    ]);
  });

  it('lays out rows and labels them', () => {
    expect(rowLengths(58)).toEqual([10, 10, 10, 10, 10, 8]);
    expect(rowLengths(0)).toEqual([]);
    expect([rowLetter(0), rowLetter(25), rowLetter(26)]).toEqual(['A', 'Z', 'AA']);
  });

  it('shortens names for seat tiles', () => {
    expect(shortName('Ana Deros')).toBe('Ana D.');
    expect(shortName('R. Eric Thomas')).toBe('R. T.');
    expect(shortName('Nes')).toBe('Nes');
    expect([initials('Ana Deros'), initials('Nes')]).toEqual(['AD', 'Ne']);
    const u = uniqueShortNames(['Hannah Thomas', 'Hannah Tennies', 'Ana Deros', 'Nes', 'Sam Le.', 'Sam Le']);
    expect([...u.values()]).toEqual(['Hannah Th.', 'Hannah Te.', 'Ana D.', 'Nes', 'Sam Le.', 'Sam Le']);
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
