import type { Invitation, Piece } from '../types';

export interface Headcount {
  confirmedPeople: number;
  confirmedPlusOnes: number;
  total: number;
  capacity: number | null;
  /** capacity − total (may be negative); null without a capacity. */
  remaining: number | null;
  /** Status maybe: people only, plus-ones not counted. */
  maybe: number;
  /** Status 'invite?'. */
  inviteQ: number;
  /** Status 'invited' (no answer yet). */
  unanswered: number;
  declined: number;
  /** Confirmed people with brunch true. Counts people only, not their plus-ones. */
  brunch: number;
}

export function headcount(
  invitations: Pick<Invitation, 'status' | 'plusOnes' | 'brunch'>[],
  capacity: number | undefined | null,
): Headcount {
  const h: Headcount = {
    confirmedPeople: 0,
    confirmedPlusOnes: 0,
    total: 0,
    capacity: capacity ?? null,
    remaining: null,
    maybe: 0,
    inviteQ: 0,
    unanswered: 0,
    declined: 0,
    brunch: 0,
  };
  for (const i of invitations) {
    switch (i.status) {
      case 'confirmed':
        h.confirmedPeople += 1;
        h.confirmedPlusOnes += i.plusOnes || 0;
        if (i.brunch) h.brunch += 1;
        break;
      case 'maybe':
        h.maybe += 1;
        break;
      case 'invite?':
        h.inviteQ += 1;
        break;
      case 'invited':
        h.unanswered += 1;
        break;
      case 'declined':
        h.declined += 1;
        break;
    }
  }
  h.total = h.confirmedPeople + h.confirmedPlusOnes;
  h.remaining = h.capacity === null ? null : h.capacity - h.total;
  return h;
}

/** Person ids that own at least one contributor-deck piece ("presenting"). */
export function presentingIds(pieces: Pick<Piece, 'kind' | 'ownerPersonIds'>[]): Set<string> {
  const ids = new Set<string>();
  for (const p of pieces) {
    if (p.kind === 'contributor-deck') for (const id of p.ownerPersonIds) ids.add(id);
  }
  return ids;
}
