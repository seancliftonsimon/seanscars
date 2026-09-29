import type { Invitation, InvitationStatus, Person, Piece, RecordMeta, Rsvp, WithId } from '../types';
import { normalizeName } from './importers';
import { defaultSteps } from './steps';

/** 'enthusiastically' → 'confirmed', 'tentatively' → 'maybe', 'regretfully' → 'declined'; anything else → null. */
export function statusFromRsvp(rsvp: string): InvitationStatus | null {
  switch ((rsvp ?? '').trim().toLowerCase()) {
    case 'enthusiastically':
      return 'confirmed';
    case 'tentatively':
      return 'maybe';
    case 'regretfully':
      return 'declined';
    default:
      return null;
  }
}

/** The form sends brunch as boolean or 'Yes'/'No'. */
export function rsvpBrunch(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return (value ?? '').trim().toLowerCase() === 'yes';
}

export function rsvpFullName(r: Pick<Rsvp, 'firstName' | 'lastName'>): string {
  return `${r.firstName ?? ''} ${r.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
}

export interface RsvpMatch {
  personId: string;
  reason: 'email' | 'name' | 'alias';
}

/** Suggest a person: email first, then full name, then alias. */
export function matchRsvp(
  r: Pick<Rsvp, 'firstName' | 'lastName' | 'email'>,
  people: WithId<Person>[],
): RsvpMatch | null {
  const email = (r.email ?? '').trim().toLowerCase();
  if (email !== '') {
    const p = people.find((x) => (x.email ?? '').trim().toLowerCase() === email);
    if (p) return { personId: p.id, reason: 'email' };
  }
  const name = normalizeName(rsvpFullName(r));
  if (name === '') return null;
  const byName = people.find((p) => normalizeName(p.name) === name);
  if (byName) return { personId: byName.id, reason: 'name' };
  const byAlias = people.find((p) => (p.aliases ?? []).some((a) => normalizeName(a) === name));
  if (byAlias) return { personId: byAlias.id, reason: 'alias' };
  return null;
}

/** The invitation after applying an RSVP (see sprint 6). */
export function applyRsvpToInvitation(
  existing: Invitation | null,
  r: Pick<Rsvp, 'rsvp' | 'brunch'>,
  rsvpId: string,
  todayIso: string,
): Omit<Invitation, keyof RecordMeta> {
  const base: Omit<Invitation, keyof RecordMeta> = existing
    ? {
        status: existing.status,
        plusOnes: existing.plusOnes,
        brunch: existing.brunch,
        method: existing.method,
        invitedAt: existing.invitedAt,
        respondedAt: existing.respondedAt,
        rsvpIds: existing.rsvpIds ?? [],
        notes: existing.notes,
      }
    : { status: 'invite?', plusOnes: 0, brunch: false, rsvpIds: [] };
  const status = statusFromRsvp(r.rsvp);
  const out: Omit<Invitation, keyof RecordMeta> = {
    ...base,
    status: status ?? base.status,
    brunch: rsvpBrunch(r.brunch),
    respondedAt: todayIso,
    rsvpIds: base.rsvpIds.includes(rsvpId) ? [...base.rsvpIds] : [...base.rsvpIds, rsvpId],
  };
  for (const k of Object.keys(out) as (keyof typeof out)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

/** Email to save on the person, or undefined when the person already has one or the RSVP has none. */
export function emailToSave(person: Pick<Person, 'email'>, r: Pick<Rsvp, 'email'>): string | undefined {
  if ((person.email ?? '').trim() !== '') return undefined;
  const email = (r.email ?? '').trim();
  return email === '' ? undefined : email;
}

/** Draft contributor piece for an RSVP that chose 'present'. */
export function contributorPieceFromRsvp(
  r: Pick<Rsvp, 'awardName'>,
  personId: string,
  order: number,
  todayIso: string,
): Omit<Piece, keyof RecordMeta> {
  const steps = defaultSteps('contributor-deck').map((s) =>
    s.key === 'asked' ? { ...s, status: 'done' as const } : s,
  );
  return {
    title: (r.awardName ?? '').trim() || 'Untitled awards',
    kind: 'contributor-deck',
    ownerPersonIds: [personId],
    order,
    steps,
    links: [],
    notes: `From RSVP ${todayIso}`,
  };
}

/** Sort newest first by createdAt; null (pending server timestamp) counts as newest. */
export function sortRsvpsNewestFirst<T extends { createdAt: { toMillis(): number } | null }>(
  rsvps: T[],
): T[] {
  const now = Date.now();
  const ms = (x: T) => (x.createdAt ? x.createdAt.toMillis() : now);
  return [...rsvps].sort((a, b) => ms(b) - ms(a));
}
