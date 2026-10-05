import type { Invitation, InvitationStatus, Piece } from '../types';

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

/* ---------- projections (guest list) ---------- */

export interface Projection {
  people: number;
  plusOnes: number;
  /** people + plusOnes */
  total: number;
  /** capacity − total (negative = over); null without a capacity. */
  remaining: number | null;
}

export interface HeadcountProjection {
  capacity: number | null;
  /** Only people who said yes. */
  confirmed: Projection;
  /** Confirmed, plus everyone invited and every maybe. */
  likely: Projection;
  /** Everyone on the list this year (adds people not invited yet). */
  everyone: Projection;
  /** Confirmed people having brunch, and their plus-ones. */
  brunch: { people: number; plusOnes: number; total: number };
  counts: Record<InvitationStatus, number>;
}

const LIKELY: InvitationStatus[] = ['confirmed', 'invited', 'maybe'];
const EVERYONE: InvitationStatus[] = [...LIKELY, 'invite?'];

function project(
  invitations: Pick<Invitation, 'status' | 'plusOnes'>[],
  statuses: InvitationStatus[],
  capacity: number | null,
): Projection {
  let people = 0;
  let plusOnes = 0;
  for (const i of invitations) {
    if (!statuses.includes(i.status)) continue;
    people += 1;
    plusOnes += Math.max(0, i.plusOnes || 0);
  }
  const total = people + plusOnes;
  return { people, plusOnes, total, remaining: capacity === null ? null : capacity - total };
}

/** Best case / likely / everyone-says-yes headcounts, all counting plus-ones. */
export function projectHeadcount(
  invitations: Pick<Invitation, 'status' | 'plusOnes' | 'brunch'>[],
  capacity: number | undefined | null,
): HeadcountProjection {
  const cap = capacity ?? null;
  const counts: Record<InvitationStatus, number> = {
    'invite?': 0, invited: 0, confirmed: 0, maybe: 0, declined: 0, 'not-inviting': 0,
  };
  const brunch = { people: 0, plusOnes: 0, total: 0 };
  for (const i of invitations) {
    counts[i.status] += 1;
    if (i.status === 'confirmed' && i.brunch) {
      brunch.people += 1;
      brunch.plusOnes += Math.max(0, i.plusOnes || 0);
    }
  }
  brunch.total = brunch.people + brunch.plusOnes;
  return {
    capacity: cap,
    confirmed: project(invitations, ['confirmed'], cap),
    likely: project(invitations, LIKELY, cap),
    everyone: project(invitations, EVERYONE, cap),
    brunch,
    counts,
  };
}

export type ProjectionBasis = 'confirmed' | 'likely' | 'everyone';

export interface CapacityVerdict {
  tone: 'ok' | 'tight' | 'over' | 'unknown';
  text: string;
  basis: ProjectionBasis;
}

const BASIS_PHRASE: Record<ProjectionBasis, string> = {
  confirmed: 'with everyone who has said yes',
  likely: 'if everyone invited and every maybe comes',
  everyone: 'if everyone you’ve listed says yes',
};

/** One plain sentence: "You’re 6 over if everyone you’ve listed says yes". */
export function capacityVerdict(p: HeadcountProjection, basis: ProjectionBasis): CapacityVerdict {
  const proj = p[basis];
  const phrase = BASIS_PHRASE[basis];
  if (p.capacity === null) {
    return { tone: 'unknown', basis, text: `${proj.total} guests ${phrase}. Set a capacity to compare.` };
  }
  const r = proj.remaining as number;
  if (r < 0) return { tone: 'over', basis, text: `You’re ${-r} over capacity ${phrase}.` };
  if (r === 0) return { tone: 'tight', basis, text: `Exactly at capacity ${phrase}.` };
  const tight = r <= Math.max(2, Math.round(p.capacity * 0.05));
  return { tone: tight ? 'tight' : 'ok', basis, text: `${r} ${r === 1 ? 'seat' : 'seats'} to spare ${phrase}.` };
}
