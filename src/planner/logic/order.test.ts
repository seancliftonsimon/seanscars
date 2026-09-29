import { describe, expect, it } from 'vitest';
import { moveItem, orderForMove, renumber } from './order';

const list = [
  { id: 'a', order: 1000 },
  { id: 'b', order: 2000 },
  { id: 'c', order: 3000 },
  { id: 'd', order: 4000 },
];

describe('orderForMove', () => {
  it('returns null when the item does not move', () => {
    expect(orderForMove(list, 2, 2)).toBeNull();
  });

  it('uses the midpoint between the new neighbours', () => {
    expect(orderForMove(list, 0, 2)).toBe(3500); // between c and d
    expect(orderForMove(list, 3, 1)).toBe(1500); // between a and b
  });

  it('moves to the start and the end', () => {
    expect(orderForMove(list, 2, 0)).toBe(0);
    expect(orderForMove(list, 0, 3)).toBe(5000);
  });

  it('returns null when neighbours are too close', () => {
    const tight = [
      { id: 'a', order: 10 },
      { id: 'b', order: 11 },
      { id: 'c', order: 500 },
    ];
    expect(orderForMove(tight, 2, 1)).toBeNull();
  });

  it('allows neighbours exactly 2 apart', () => {
    const l = [
      { id: 'a', order: 10 },
      { id: 'b', order: 12 },
      { id: 'c', order: 500 },
    ];
    expect(orderForMove(l, 2, 1)).toBe(11);
  });

  it('ignores out-of-range indexes', () => {
    expect(orderForMove(list, 0, 9)).toBeNull();
    expect(orderForMove([], 0, 0)).toBeNull();
  });
});

describe('renumber', () => {
  it('assigns gapped orders and returns only changes', () => {
    const result = renumber([
      { id: 'a', order: 1000 },
      { id: 'b', order: 1001 },
      { id: 'c', order: 5 },
    ]);
    expect(result).toEqual([
      { id: 'b', order: 2000 },
      { id: 'c', order: 3000 },
    ]);
  });

  it('returns nothing for an already-clean list', () => {
    expect(renumber(list)).toEqual([]);
  });
});

describe('moveItem', () => {
  it('moves forward and backward without mutating', () => {
    const src = ['a', 'b', 'c', 'd'];
    expect(moveItem(src, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(src, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is a no-op for same or invalid index', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});
