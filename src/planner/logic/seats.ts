import type { Invitation, InvitationStatus, Person, WithId } from '../types';
import { INVITATION_STATUS_ORDER } from './labels';

/*
 * The seat map: who takes a seat, in what order, and who could be added back.
 * Pure, so the Seats view stays a thin render of these helpers.
 */

/** Statuses that hold seats. Declined and "not this year" give theirs up. */
export const SEATED_STATUSES: InvitationStatus[] = ['confirmed', 'maybe', 'invited', 'invite?'];

export const isSeated = (s: InvitationStatus) => SEATED_STATUSES.includes(s);

export interface Party {
  personId: string;
  name: string;
  status: InvitationStatus;
  plusOnes: number;
  plusOneNames: string[];
  /** 1 + plusOnes */
  size: number;
}

export interface Seat {
  /** 0-based seat number, in fill order. */
  index: number;
  /** null for an empty seat. */
  party: Party | null;
  /** 0 = the guest themself, 1.. = their plus-ones. */
  slot: number;
  /** Past capacity: a seat the room doesn't have. */
  over: boolean;
}

type MillisLike = { toMillis?: () => number } | null | undefined;
const millis = (t: MillisLike) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

/**
 * Everyone holding seats, in fill order: by status (coming first), then by
 * when they were put on the list, so a new addition takes the next free seat
 * instead of reshuffling everyone; then by name.
 */
export function buildParties(
  people: Pick<WithId<Person>, 'id' | 'name'>[],
  invitations: (Pick<WithId<Invitation>, 'id' | 'status' | 'plusOnes' | 'plusOneNames'> & { createdAt?: MillisLike })[],
): Party[] {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const rank = (s: InvitationStatus) => INVITATION_STATUS_ORDER.indexOf(s);
  return invitations
    .filter((i) => isSeated(i.status))
    .map((i) => {
      const plusOnes = Math.max(0, Math.floor(Number(i.plusOnes) || 0));
      return {
        party: {
          personId: i.id,
          name: names.get(i.id) ?? 'Unknown guest',
          status: i.status,
          plusOnes,
          plusOneNames: (i.plusOneNames ?? []).slice(0, plusOnes),
          size: 1 + plusOnes,
        },
        created: millis(i.createdAt),
      };
    })
    .sort(
      (a, b) =>
        rank(a.party.status) - rank(b.party.status) || a.created - b.created || a.party.name.localeCompare(b.party.name),
    )
    .map((x) => x.party);
}

/** Seats in fill order: each party sits together. Always at least `capacity` seats; extra ones are `over`. */
export function assignSeats(parties: Party[], capacity: number): Seat[] {
  const seats: Seat[] = [];
  for (const party of parties) {
    for (let slot = 0; slot < party.size; slot++) {
      seats.push({ index: seats.length, party, slot, over: seats.length >= capacity });
    }
  }
  while (seats.length < capacity) seats.push({ index: seats.length, party: null, slot: 0, over: false });
  return seats;
}

export interface SeatTally {
  guests: number;
  plusOnes: number;
  total: number;
  capacity: number;
  /** capacity − total; negative when over. */
  free: number;
  byStatus: Record<InvitationStatus, number>;
}

export function tallySeats(parties: Party[], capacity: number): SeatTally {
  const byStatus = Object.fromEntries(INVITATION_STATUS_ORDER.map((s) => [s, 0])) as Record<InvitationStatus, number>;
  let plusOnes = 0;
  for (const p of parties) {
    byStatus[p.status] += p.size;
    plusOnes += p.plusOnes;
  }
  const total = parties.length + plusOnes;
  return { guests: parties.length, plusOnes, total, capacity, free: capacity - total, byStatus };
}

/**
 * Row lengths for a theater of `count` seats: full rows of `perRow`, with the
 * remainder in the back row.
 */
export function rowLengths(count: number, perRow = 10): number[] {
  const rows: number[] = [];
  for (let left = count; left > 0; left -= perRow) rows.push(Math.min(perRow, left));
  return rows;
}

/** A row letter: A–Z, then AA, AB… */
export function rowLetter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : rowLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

/** What a seat says about who is in it. */
export function seatLabel(seat: Seat): string {
  if (!seat.party) return 'Empty seat';
  if (seat.slot === 0) return seat.party.name;
  const named = seat.party.plusOneNames[seat.slot - 1]?.trim();
  return named ? `${named} (${seat.party.name}’s guest)` : `${seat.party.name}’s guest ${seat.slot}`;
}

export interface Suggestion {
  personId: string;
  name: string;
  notes?: string;
  /** Their invitation this season, if they have one (declined or not this year). */
  status?: InvitationStatus;
  /** Set when they already hold a seat as someone's plus-one. */
  countedWith?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * People not holding a seat this season, to add back in one tap. Someone who
 * is already named as a seated guest's plus-one (or is an alias of a seated
 * guest) is flagged so they aren't counted twice.
 */
export function suggestions(
  people: Pick<WithId<Person>, 'id' | 'name' | 'notes' | 'aliases'>[],
  invitations: Pick<WithId<Invitation>, 'id' | 'status'>[],
  parties: Party[],
): Suggestion[] {
  const inv = new Map(invitations.map((i) => [i.id, i]));
  const seatedIds = new Set(parties.map((p) => p.personId));
  const counted = new Map<string, string>();
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const party of parties) {
    for (const n of party.plusOneNames) if (n.trim()) counted.set(norm(n), party.name);
    for (const a of byId.get(party.personId)?.aliases ?? []) counted.set(norm(a), party.name);
  }
  return people
    .filter((p) => !seatedIds.has(p.id))
    .map((p) => ({
      personId: p.id,
      name: p.name,
      notes: p.notes,
      status: inv.get(p.id)?.status,
      countedWith: counted.get(norm(p.name)),
    }))
    .sort((a, b) => Number(!!a.countedWith) - Number(!!b.countedWith) || a.name.localeCompare(b.name));
}

/** Names list resized to `n` plus-ones (trailing blanks dropped). */
export function resizeNames(names: string[] | undefined, n: number): string[] {
  const out = (names ?? []).slice(0, n);
  while (out.length && !out[out.length - 1]?.trim()) out.pop();
  return out;
}
