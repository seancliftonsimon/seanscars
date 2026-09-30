import type { Invitation } from '../types';
import { headcount } from './headcount';

export function wasInvited(invitation: Pick<Invitation, 'status' | 'invitedAt'>): boolean {
  return Boolean(invitation.invitedAt) || ['invited', 'confirmed', 'maybe', 'declined'].includes(invitation.status);
}

/** Attendance counts include only confirmed guests; invitation/response cards count people. */
export function guestOverview(invitations: Invitation[], capacity?: number) {
  const attendance = headcount(invitations, capacity);
  const guests = invitations.filter((i) => i.status !== 'not-inviting');
  const sent = guests.filter(wasInvited).length;
  const responses = guests.filter((i) => ['confirmed', 'maybe', 'declined'].includes(i.status)).length;
  const plusOnes = guests.filter((i) => i.status !== 'declined').reduce((sum, i) => sum + Math.max(0, i.plusOnes || 0), 0);
  return { attendance, guests: guests.length, sent, responses, plusOnes };
}

export const INVITATION_LABELS = {
  'invite?': 'Not invited', invited: 'Invited', confirmed: 'Confirmed',
  maybe: 'Maybe', declined: 'Declined', 'not-inviting': 'Not inviting',
};
