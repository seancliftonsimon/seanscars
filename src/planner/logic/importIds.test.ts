import { describe, expect, it } from 'vitest';
import { duplicateIds, importDocId, slugify } from './importIds';

describe('slugify', () => {
  it('lowercases, strips accents and joins words with dashes', () => {
    expect(slugify('  Zoë  Example & Co. ')).toBe('zoe-example-co');
  });

  it('falls back to "item" when nothing is left', () => {
    expect(slugify('!!!')).toBe('item');
  });

  it('caps the length without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('importDocId', () => {
  it('prefixes the slug', () => {
    expect(importDocId('film', 'the example movie')).toBe('imp-film-the-example-movie');
  });
});

describe('duplicateIds', () => {
  it('returns later items whose id repeats', () => {
    const items = ['A b', 'a-b', 'c'];
    expect(duplicateIds(items, (s) => slugify(s))).toEqual(['a-b']);
  });
});
