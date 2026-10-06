import { describe, expect, it } from 'vitest';
import type { Award, Contender } from '../types';
import {
  awardFingerprint,
  changedSince,
  composeLabel,
  ensureSlugs,
  isDecided,
  layoutWarnings,
  listNames,
  stampMs,
  variantOf,
  winnersOf,
} from './showGraphics';

const contender = (over: Partial<Contender> = {}): Contender => ({ id: 'c1', label: '', nominee: true, ...over });

const award = (over: Partial<Award> = {}): Award => ({
  order: 1000,
  name: 'Best Sheep',
  stage: 'nominees',
  returning: false,
  contenders: [],
  ...over,
});

const many = (n: number, over: Partial<Contender> = {}): Contender[] =>
  Array.from({ length: n }, (_, i) => contender({ id: `c${i + 1}`, film: `Film ${i + 1}`, ...over }));

describe('composeLabel', () => {
  it('joins person and film with an em dash', () => {
    expect(composeLabel(contender({ personName: 'Pat Example', film: 'The Glass Orchard' }))).toBe('Pat Example — The Glass Orchard');
  });
  it('uses whichever exists, else the label', () => {
    expect(composeLabel(contender({ personName: 'Pat Example' }))).toBe('Pat Example');
    expect(composeLabel(contender({ film: 'Copper Ridge' }))).toBe('Copper Ridge');
    expect(composeLabel(contender({ label: 'Old Label' }))).toBe('Old Label');
    expect(composeLabel(contender({ personName: '  ', film: ' ', label: 'Old Label' }))).toBe('Old Label');
    expect(composeLabel(contender())).toBe('');
  });
});

describe('variantOf', () => {
  it('treats a missing variant as standard', () => {
    expect(variantOf({})).toBe('standard');
    expect(variantOf({ variant: 'honoree' })).toBe('honoree');
  });
});

describe('ensureSlugs', () => {
  it('slugs the award as <kebab name>-<year>', () => {
    expect(ensureSlugs(award({ name: 'Best  Sheep!' }), [], 2027).slug).toBe('best-sheep-2027');
  });

  it('keeps the award slug unique within the season', () => {
    const season = [{ id: 'a1', slug: 'best-sheep-2027' }, { id: 'a2', slug: 'best-sheep-2027-2' }];
    expect(ensureSlugs(award(), season, 2027).slug).toBe('best-sheep-2027-3');
  });

  it('does not clash with the award itself', () => {
    const season = [{ id: 'a1', slug: 'best-sheep-2027' }];
    expect(ensureSlugs({ ...award({ name: 'Best Sheep', slug: undefined }), id: 'a1' }, season, 2027).slug).toBe('best-sheep-2027');
  });

  it('never changes an existing slug, even after a rename', () => {
    const renamed = ensureSlugs(award({ name: 'Best Goat', slug: 'best-sheep-2027', contenders: [contender({ slug: 'old-slug', personName: 'New Name' })] }), [], 2027);
    expect(renamed.slug).toBe('best-sheep-2027');
    expect(renamed.contenders[0].slug).toBe('old-slug');
  });

  it('slugs contenders from the person, else the film, else the label', () => {
    const out = ensureSlugs(
      award({
        contenders: [
          contender({ id: 'c1', personName: 'Pat Example', film: 'The Glass Orchard' }),
          contender({ id: 'c2', film: 'Copper Ridge' }),
          contender({ id: 'c3', label: 'Old Label' }),
        ],
      }),
      [],
      2027,
    );
    expect(out.contenders.map((c) => c.slug)).toEqual(['pat-example', 'copper-ridge', 'old-label']);
  });

  it('numbers repeats, such as the same performance nominated twice', () => {
    const twice = (id: string) => contender({ id, personName: 'Pat Example', film: 'Copper Ridge' });
    const out = ensureSlugs(award({ contenders: [twice('c1'), twice('c2'), twice('c3')] }), [], 2027);
    expect(out.contenders.map((c) => c.slug)).toEqual(['pat-example', 'pat-example-2', 'pat-example-3']);
  });

  it('does not take a slug a later contender already holds', () => {
    const out = ensureSlugs(
      award({ contenders: [contender({ id: 'c1', personName: 'Pat Example' }), contender({ id: 'c2', personName: 'Pat Example', slug: 'pat-example' })] }),
      [],
      2027,
    );
    expect(out.contenders.map((c) => c.slug)).toEqual(['pat-example-2', 'pat-example']);
  });

  it('is idempotent', () => {
    const once = ensureSlugs(award({ contenders: many(3, { personName: 'Pat' }) }), [], 2027);
    expect(ensureSlugs(once, [], 2027)).toEqual(once);
  });
});

describe('winnersOf', () => {
  const contenders = [contender({ id: 'a', film: 'A' }), contender({ id: 'b', film: 'B' }), contender({ id: 'x', film: 'X', nominee: false })];
  it('returns winners in winnerContenderIds order, nominated or not', () => {
    expect(winnersOf({ contenders, winnerContenderIds: ['x', 'a'] }).map((c) => c.id)).toEqual(['x', 'a']);
  });
  it('skips unknown ids and repeats', () => {
    expect(winnersOf({ contenders, winnerContenderIds: ['b', 'gone', 'b'] }).map((c) => c.id)).toEqual(['b']);
  });
  it('is empty with no winners', () => {
    expect(winnersOf({ contenders })).toEqual([]);
    expect(winnersOf({ contenders: undefined as unknown as Contender[], winnerContenderIds: ['a'] })).toEqual([]);
  });
});

describe('isDecided', () => {
  it('is decided with one winner, a tie, or a surprise winner', () => {
    const contenders = [contender({ id: 'a' }), contender({ id: 'b' }), contender({ id: 'x', nominee: false })];
    expect(isDecided({ contenders, winnerContenderIds: ['a'] })).toBe(true);
    expect(isDecided({ contenders, winnerContenderIds: ['a', 'b'] })).toBe(true);
    expect(isDecided({ contenders, winnerContenderIds: ['x'] })).toBe(true);
  });
  it('is undecided with no winner or only unknown ids', () => {
    const contenders = [contender({ id: 'a' })];
    expect(isDecided({ contenders })).toBe(false);
    expect(isDecided({ contenders, winnerContenderIds: [] })).toBe(false);
    expect(isDecided({ contenders, winnerContenderIds: ['gone'] })).toBe(false);
  });
  it('is decided for an honoree award with 1 or 2 honorees marked', () => {
    const honoree = (n: number) => ({ variant: 'honoree' as const, contenders: many(n) });
    expect(isDecided(honoree(0))).toBe(false);
    expect(isDecided(honoree(1))).toBe(true);
    expect(isDecided(honoree(2))).toBe(true);
    expect(isDecided(honoree(3))).toBe(false);
  });
  it('does not treat nominees alone as a decision for other variants', () => {
    expect(isDecided({ contenders: many(1) })).toBe(false);
    expect(isDecided({ variant: 'film-only', contenders: many(2) })).toBe(false);
  });
  it('copes with a missing contenders list', () => {
    expect(isDecided({ contenders: undefined as unknown as Contender[] })).toBe(false);
  });
});

describe('layoutWarnings', () => {
  it('is quiet for an ordinary award', () => {
    expect(layoutWarnings(award({ contenders: many(5) }))).toEqual([]);
  });
  it('warns above 7 nominees but not at 7, and ignores non-nominees', () => {
    expect(layoutWarnings(award({ contenders: many(7) }))).toEqual([]);
    expect(layoutWarnings(award({ contenders: [...many(7), contender({ id: 'x', film: 'Extra', nominee: false })] }))).toEqual([]);
    expect(layoutWarnings(award({ contenders: many(8) }))).toEqual(['8 nominees. More than 7 may not fit on screen.']);
  });
  it('ignores empty rows', () => {
    expect(layoutWarnings(award({ contenders: [...many(7), contender({ id: 'blank' })] }))).toEqual([]);
  });
  it('warns above 2 honorees on an honoree award only', () => {
    expect(layoutWarnings(award({ variant: 'honoree', contenders: many(2) }))).toEqual([]);
    expect(layoutWarnings(award({ variant: 'honoree', contenders: many(3) }))).toHaveLength(1);
    expect(layoutWarnings(award({ variant: 'honoree', contenders: many(3) }))[0]).toContain('3 honorees');
    expect(layoutWarnings(award({ variant: 'standard', contenders: many(3) }))).toEqual([]);
  });
  it('warns about a short name over 40 characters', () => {
    expect(layoutWarnings(award({ shortName: 'x'.repeat(40) }))).toEqual([]);
    expect(layoutWarnings(award({ shortName: 'x'.repeat(41) }))[0]).toContain('short name is 41 characters');
  });
  it('warns about long names on what the show draws, once per name', () => {
    const long = 'A Very Long Title Indeed That Goes On And On';
    const out = layoutWarnings(
      award({
        contenders: [contender({ id: 'a', personName: 'Pat Example', film: long }), contender({ id: 'b', film: long, nominee: false })],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(`${long.length} characters`);
  });
  it('checks surprise winners too', () => {
    const long = 'Q'.repeat(45);
    const out = layoutWarnings(award({ contenders: [contender({ id: 'x', film: long, nominee: false })], winnerContenderIds: ['x'] }));
    expect(out).toHaveLength(1);
  });
  it('checks the label of an unsplit contender', () => {
    expect(layoutWarnings(award({ contenders: [contender({ label: 'L'.repeat(41) })] }))).toHaveLength(1);
  });
  it('never throws on a missing list', () => {
    expect(layoutWarnings({ contenders: undefined as unknown as Contender[] })).toEqual([]);
  });
});

describe('listNames', () => {
  it('joins names in plain English', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B'])).toBe('A and B');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('stale panel guard', () => {
  const stamp = (ms: number) => ({ toMillis: () => ms });
  it('reads milliseconds from a Timestamp-like value', () => {
    expect(stampMs(stamp(5))).toBe(5);
    expect(stampMs(null)).toBeNull();
    expect(stampMs(undefined)).toBeNull();
    expect(stampMs({})).toBeNull();
  });
  it('fingerprints fields, not ids, timestamps or key order', () => {
    const a = { id: 'a1', updatedAt: stamp(1), name: 'X', winnerContenderIds: undefined, contenders: [{ id: 'c1', label: 'L', nominee: true }] };
    const b = { name: 'X', contenders: [{ nominee: true, label: 'L', id: 'c1' }], updatedAt: stamp(2), updatedBy: 'someone' };
    expect(awardFingerprint(a)).toBe(awardFingerprint(b));
    expect(awardFingerprint({ ...b, name: 'Y' })).not.toBe(awardFingerprint(b));
    expect(awardFingerprint({ ...b, contenders: [{ id: 'c2', label: 'L', nominee: true }] })).not.toBe(awardFingerprint(b));
  });
  it('is not changed when updatedAt matches', () => {
    expect(changedSince({ updatedMs: 10, fingerprint: 'a' }, { updatedMs: 10, fingerprint: 'b' })).toBe(false);
  });
  it('is changed when updatedAt and the fields both differ', () => {
    expect(changedSince({ updatedMs: 10, fingerprint: 'a' }, { updatedMs: 20, fingerprint: 'b' })).toBe(true);
  });
  it('ignores a new timestamp over the same fields (a server timestamp replacing its estimate)', () => {
    expect(changedSince({ updatedMs: 10, fingerprint: 'a' }, { updatedMs: 20, fingerprint: 'a' })).toBe(false);
  });
  it('falls back to the fields when no timestamp is known', () => {
    expect(changedSince({ updatedMs: null, fingerprint: 'a' }, { updatedMs: 20, fingerprint: 'a' })).toBe(false);
    expect(changedSince({ updatedMs: null, fingerprint: 'a' }, { updatedMs: 20, fingerprint: 'b' })).toBe(true);
  });
});
