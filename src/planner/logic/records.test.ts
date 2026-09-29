import { describe, expect, it } from 'vitest';
import { nextOrder, omitId, prepareUpdate, stripUndefined } from './records';

class Sentinel {
  readonly tag = 'sentinel';
}

describe('stripUndefined', () => {
  it('drops undefined values deeply', () => {
    const input = {
      title: 'Opening number',
      notes: undefined,
      waitingOn: { kind: 'award', id: 'a1', extra: undefined },
      contenders: [{ id: 'c1', label: 'Test Film', note: undefined }, undefined],
    };
    expect(stripUndefined(input)).toEqual({
      title: 'Opening number',
      waitingOn: { kind: 'award', id: 'a1' },
      contenders: [{ id: 'c1', label: 'Test Film' }],
    });
  });

  it('passes non-plain objects through by reference', () => {
    const sentinel = new Sentinel();
    const out = stripUndefined({ at: sentinel });
    expect(out.at).toBe(sentinel);
  });

  it('does not mutate its input', () => {
    const input = { a: 1, b: undefined };
    stripUndefined(input);
    expect('b' in input).toBe(true);
  });
});

describe('prepareUpdate', () => {
  it('turns top-level undefined into the sentinel and keeps other values', () => {
    const del = new Sentinel();
    const out = prepareUpdate({ notes: undefined, title: 'New', links: [{ label: 'x', url: 'y', note: undefined }] }, del);
    expect(out.notes).toBe(del);
    expect(out.title).toBe('New');
    expect(out.links).toEqual([{ label: 'x', url: 'y' }]);
  });
});

describe('omitId', () => {
  it('removes id only', () => {
    expect(omitId({ id: 'x', name: 'Example' })).toEqual({ name: 'Example' });
  });
});

describe('nextOrder', () => {
  it('starts at 1000', () => {
    expect(nextOrder([])).toBe(1000);
  });
  it('appends after the largest order on the next 1000 boundary', () => {
    expect(nextOrder([{ order: 1000 }, { order: 3000 }, { order: 2000 }])).toBe(4000);
    expect(nextOrder([{ order: 2500 }])).toBe(3000);
  });
});
