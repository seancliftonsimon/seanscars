import { describe, expect, it } from 'vitest';
import { seedFor } from './seed';
import { derivePhase } from '../logic/phase';
import { todayIso } from '../logic/dates';
import type { Invitation, Season } from '../types';

function phaseOf(scenario: string) {
  const docs = seedFor(scenario, (ms) => ({ ms }));
  const season = docs.find((d) => d.path === 'seasons/2027')?.data as unknown as Season | undefined;
  if (!season) return null;
  const sub = (name: string) => docs.filter((d) => d.path.startsWith(`seasons/2027/${name}/`));
  return derivePhase(
    {
      season,
      invitations: sub('invitations').map((d) => d.data as unknown as Invitation),
      segmentCount: sub('segments').length,
      awardCount: sub('awards').length,
    },
    todayIso(),
  ).id;
}

describe('fake seed scenarios', () => {
  it('each lands in the phase it is named after', () => {
    expect(seedFor('empty', () => null)).toEqual([]);
    expect(phaseOf('fresh')).toBe('setup');
    expect(phaseOf('lists')).toBe('lists');
    expect(phaseOf('invites')).toBe('invites');
    expect(phaseOf('production')).toBe('production');
    expect(phaseOf('showweek')).toBe('showweek');
    expect(phaseOf('after')).toBe('after');
  });
  it('uses only example.com emails', () => {
    const emails = seedFor('invites', () => null).flatMap((d) => (typeof d.data.email === 'string' ? [d.data.email] : []));
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every((e) => e.endsWith('@example.com'))).toBe(true);
  });
});
