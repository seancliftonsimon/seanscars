import { describe, expect, it } from 'vitest';
import { projectHeadcount } from './headcount';
import { venueFit } from './venues';

describe('venueFit', () => {
  const p = projectHeadcount(
    [
      { status: 'confirmed', plusOnes: 1, brunch: false },
      { status: 'invited', plusOnes: 1, brunch: false },
      { status: 'invite?', plusOnes: 2, brunch: false },
    ],
    null,
  ); // confirmed 2, likely 4, everyone 7
  it('compares capacity with the projections', () => {
    expect(venueFit({ capacity: 7 }, p)).toBe('fits');
    expect(venueFit({ capacity: 5 }, p)).toBe('tight');
    expect(venueFit({ capacity: 3 }, p)).toBe('small');
    expect(venueFit({}, p)).toBe('unknown');
  });
});
