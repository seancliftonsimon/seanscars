import type { Invitation, InvitationStatus, Likelihood, Person, WithId } from '../types';

/*
 * The seat map: who takes a seat, in what order, how many are really
 * expected, and who could be added back. Pure, so the Seats view stays a
 * thin render of these helpers.
 */

/** Statuses that hold seats. Declined and "not this year" give theirs up. */
export const SEATED_STATUSES: InvitationStatus[] = ['confirmed', 'maybe', 'invited', 'invite?'];

export const isSeated = (s: InvitationStatus) => SEATED_STATUSES.includes(s);

/**
 * How a seated party looks from here: their reply if they gave one
 * (coming, or an RSVP maybe), otherwise Sean's guess.
 */
export type Outlook = 'coming' | Likelihood;

export const OUTLOOKS: Outlook[] = ['coming', 'likely', 'maybe', 'unlikely'];

export const OUTLOOK_LABEL: Record<Outlook, string> = {
  coming: 'Coming',
  likely: 'Likely',
  maybe: 'Maybe',
  unlikely: 'Likely not',
};

export const LIKELIHOODS: Likelihood[] = ['likely', 'maybe', 'unlikely'];

/** Share of a seat each outlook is expected to fill. */
export const OUTLOOK_WEIGHT: Record<Outlook, number> = {
  coming: 1,
  likely: 1,
  maybe: 0.5,
  unlikely: 0.2,
};

export function outlookOf(status: InvitationStatus, likelihood: Likelihood | undefined): Outlook {
  if (status === 'confirmed') return 'coming';
  if (status === 'maybe') return 'maybe';
  return likelihood ?? 'likely';
}

export interface Party {
  personId: string;
  name: string;
  status: InvitationStatus;
  outlook: Outlook;
  plusOnes: number;
  plusOneNames: string[];
  /** 1 + plusOnes */
  size: number;
  seatOrder?: number;
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
 * Everyone holding seats, in seat-map order. Parties Sean has placed by hand
 * (with a seatOrder) come first, in that order. Everyone else follows,
 * grouped by outlook, then by when they were put on the list, so a new
 * addition takes the next free seat instead of reshuffling the room.
 */
export function buildParties(
  people: Pick<WithId<Person>, 'id' | 'name'>[],
  invitations: (Pick<WithId<Invitation>, 'id' | 'status' | 'plusOnes' | 'plusOneNames' | 'likelihood' | 'seatOrder'> & { createdAt?: MillisLike })[],
): Party[] {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const rank = (o: Outlook) => OUTLOOKS.indexOf(o);
  return invitations
    .filter((i) => isSeated(i.status))
    .map((i) => {
      const plusOnes = Math.max(0, Math.floor(Number(i.plusOnes) || 0));
      const order = typeof i.seatOrder === 'number' && Number.isFinite(i.seatOrder) ? i.seatOrder : undefined;
      return {
        party: {
          personId: i.id,
          name: names.get(i.id) ?? 'Unknown guest',
          status: i.status,
          outlook: outlookOf(i.status, i.likelihood),
          plusOnes,
          plusOneNames: (i.plusOneNames ?? []).slice(0, plusOnes),
          size: 1 + plusOnes,
          ...(order !== undefined ? { seatOrder: order } : {}),
        } as Party,
        created: millis(i.createdAt),
      };
    })
    .sort((a, b) => {
      const ao = a.party.seatOrder;
      const bo = b.party.seatOrder;
      if (ao !== undefined && bo !== undefined && ao !== bo) return ao - bo;
      if ((ao === undefined) !== (bo === undefined)) return ao === undefined ? 1 : -1;
      return rank(a.party.outlook) - rank(b.party.outlook) || a.created - b.created || a.party.name.localeCompare(b.party.name);
    })
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
  /** Seats held: everyone on the list, plus-ones included. */
  total: number;
  /** Seats expected to be filled, weighting each outlook. Rounded. */
  expected: number;
  capacity: number;
  /** capacity − total; negative when over. */
  free: number;
  /** capacity − expected; negative when over. */
  expectedFree: number;
  /** Seats held per outlook. */
  byOutlook: Record<Outlook, number>;
}

export function tallySeats(parties: Party[], capacity: number): SeatTally {
  const byOutlook = Object.fromEntries(OUTLOOKS.map((o) => [o, 0])) as Record<Outlook, number>;
  let plusOnes = 0;
  let expected = 0;
  for (const p of parties) {
    byOutlook[p.outlook] += p.size;
    plusOnes += p.plusOnes;
    expected += p.size * OUTLOOK_WEIGHT[p.outlook];
  }
  const total = parties.length + plusOnes;
  const exp = Math.round(expected);
  return { guests: parties.length, plusOnes, total, expected: exp, capacity, free: capacity - total, expectedFree: capacity - exp, byOutlook };
}

/** Seats expected from `seats` held at `outlook`, rounded to a whole person. */
export const expectedFrom = (seats: number, outlook: Outlook) => Math.round(seats * OUTLOOK_WEIGHT[outlook]);

/**
 * Moves party `dragId` next to `targetId`: after it when moving later in the
 * room, before it when moving earlier. `targetId` null moves it to the end.
 * Returns the new order of person ids.
 */
export function moveParty(order: string[], dragId: string, targetId: string | null): string[] {
  const from = order.indexOf(dragId);
  if (from < 0 || dragId === targetId) return order;
  const rest = order.filter((id) => id !== dragId);
  if (targetId === null) return [...rest, dragId];
  const to = order.indexOf(targetId);
  if (to < 0) return order;
  const at = rest.indexOf(targetId) + (to > from ? 1 : 0);
  return [...rest.slice(0, at), dragId, ...rest.slice(at)];
}

/** Which side of the target a dragged party would land on (see moveParty). */
export function dropSide(order: string[], dragId: string, targetId: string): 'before' | 'after' {
  return order.indexOf(targetId) > order.indexOf(dragId) ? 'after' : 'before';
}

/** seatOrder values (gaps of 1000) for the parties whose stored order must change. */
export function seatOrderPatches(parties: Pick<Party, 'personId' | 'seatOrder'>[], order: string[]): { personId: string; seatOrder: number }[] {
  const current = new Map(parties.map((p) => [p.personId, p.seatOrder]));
  return order
    .map((personId, i) => ({ personId, seatOrder: (i + 1) * 1000 }))
    .filter(({ personId, seatOrder }) => current.get(personId) !== seatOrder);
}

/** "Ana Deros" → "Ana D."; a single name stays as it is. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Short names that stay distinct: "Hannah Thomas" and "Hannah Tennies" become
 * "Hannah Th." and "Hannah Te." instead of two "Hannah T.". Identical full
 * names keep the same short name.
 */
export function uniqueShortNames(names: string[]): Map<string, string> {
  const full = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const parts = full.map((n) => n.split(/\s+/));
  const len = full.map(() => 1);
  const label = (i: number) => {
    const p = parts[i];
    if (p.length < 2) return p[0];
    const last = p[p.length - 1];
    return len[i] >= last.length ? `${p[0]} ${last}` : `${p[0]} ${last[0].toUpperCase()}${last.slice(1, len[i])}.`;
  };
  for (let guard = 0; guard < 20; guard++) {
    const seen = new Map<string, number[]>();
    full.forEach((_, i) => seen.set(label(i), [...(seen.get(label(i)) ?? []), i]));
    const clashes = [...seen.values()].filter((ix) => ix.length > 1);
    if (!clashes.length) break;
    for (const ix of clashes) for (const i of ix) len[i]++;
  }
  return new Map(full.map((n, i) => [n, label(i)]));
}

/** "Ana Deros" → "AD"; "Nes" → "Ne". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Row lengths for a theater of `count` seats: full rows of `perRow`, remainder in the back row. */
export function rowLengths(count: number, perRow = 10): number[] {
  const rows: number[] = [];
  for (let left = count; left > 0; left -= perRow) rows.push(Math.min(perRow, left));
  return rows;
}

/** A row letter: A–Z, then AA, AB… */
export function rowLetter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : rowLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

/** The name of a plus-one seat's occupant, if Sean gave one. */
export const plusOneName = (seat: Seat) => (seat.party && seat.slot > 0 ? seat.party.plusOneNames[seat.slot - 1]?.trim() || '' : '');

/** What a seat says about who is in it. */
export function seatLabel(seat: Seat): string {
  if (!seat.party) return 'Empty seat';
  if (seat.slot === 0) return seat.party.name;
  const named = plusOneName(seat);
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
