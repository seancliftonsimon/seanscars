import { describe, expect, it } from 'vitest';
import type { Invitation } from '../types';
import { derivePhase, INFO_BLOCKS, PHASES, relevance } from './phase';

const TODAY = '2027-01-01';
const inv = (over: Partial<Invitation> = {}) => ({ status: 'invite?' as const, ...over });
const base = { segmentCount: 5, awardCount: 3 };

describe('derivePhase', () => {
  it('is setup without a show date or anything planned', () => {
    expect(derivePhase({ season: {}, invitations: [], ...base }, TODAY).id).toBe('setup');
    expect(derivePhase({ season: { showDate: '2027-04-01' }, invitations: [], segmentCount: 0, awardCount: 0 }, TODAY).id).toBe('setup');
  });
  it('is lists until an invitation is sent', () => {
    const p = derivePhase({ season: { showDate: '2027-04-01' }, invitations: [inv(), inv({ status: 'confirmed' })], ...base }, TODAY);
    expect(p).toMatchObject({ id: 'lists', daysToShow: 90 });
  });
  it('is invitations out while many replies are pending and the show is far', () => {
    const invitations = [inv({ status: 'invited' }), inv({ status: 'invited' }), inv({ status: 'confirmed', respondedAt: TODAY })];
    expect(derivePhase({ season: { showDate: '2027-03-01' }, invitations, ...base }, TODAY).id).toBe('invites');
  });
  it('is production when replies are mostly in or the show is within four weeks', () => {
    const mostly = [inv({ status: 'invited' }), ...Array(5).fill(inv({ status: 'confirmed', respondedAt: TODAY }))];
    expect(derivePhase({ season: { showDate: '2027-03-01' }, invitations: mostly, ...base }, TODAY).id).toBe('production');
    const pending = [inv({ status: 'invited' })];
    expect(derivePhase({ season: { showDate: '2027-01-20' }, invitations: pending, ...base }, TODAY).id).toBe('production');
  });
  it('is show week within seven days and after once passed', () => {
    expect(derivePhase({ season: { showDate: '2027-01-08' }, invitations: [], ...base }, TODAY).id).toBe('showweek');
    expect(derivePhase({ season: { showDate: '2026-12-31' }, invitations: [], ...base }, TODAY).id).toBe('after');
  });
  it('lets a manual override win but remembers the derived phase', () => {
    const p = derivePhase({ season: { showDate: '2027-04-01', phaseOverride: 'production' }, invitations: [], ...base }, TODAY);
    expect(p).toMatchObject({ id: 'production', derived: 'lists', overridden: true });
  });
});

describe('relevance matrix', () => {
  it('hides reply counts until invitations are out', () => {
    expect(relevance('rsvpCounts', 'setup')).toBe('hidden');
    expect(relevance('rsvpCounts', 'lists')).toBe('hidden');
    expect(relevance('rsvpCounts', 'invites')).not.toBe('hidden');
  });
  it('leads with projected headcount while building the list', () => {
    expect(relevance('projectedHeadcount', 'lists')).toBe('headline');
  });
  it('gives every phase at least one headline', () => {
    for (const p of PHASES) expect(INFO_BLOCKS.some((b) => relevance(b, p.id) === 'headline')).toBe(true);
  });
});
