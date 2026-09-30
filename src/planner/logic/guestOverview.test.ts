import { describe, expect, it } from 'vitest';
import { guestOverview, wasInvited } from './guestOverview';
import type { Invitation, InvitationStatus } from '../types';
const invitation = (status: InvitationStatus, plusOnes = 0): Invitation => ({ status, plusOnes, brunch: false, rsvpIds: [] });
describe('guest overview', () => {
  it('separates confirmed attendance from invitation and response counts', () => {
    const result = guestOverview([invitation('confirmed', 2), invitation('invited', 1), invitation('maybe', 1), invitation('declined', 3), invitation('invite?', 1), invitation('not-inviting', 9)], 20);
    expect(result.guests).toBe(5);
    expect(result.sent).toBe(4);
    expect(result.responses).toBe(3);
    expect(result.plusOnes).toBe(5);
    expect(result.attendance.total).toBe(3);
    expect(result.attendance.remaining).toBe(17);
  });
  it('counts a sent invitation even if its current status has been reset', () => {
    expect(wasInvited({ status: 'invite?', invitedAt: '2026-09-29' })).toBe(true);
    expect(wasInvited({ status: 'invite?' })).toBe(false);
  });
  it('handles an empty guest list and unknown capacity without inventing attendance', () => {
    const result = guestOverview([]);
    expect(result.guests).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.responses).toBe(0);
    expect(result.attendance.capacity).toBeNull();
  });
});
