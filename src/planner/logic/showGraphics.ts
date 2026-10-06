import type { Award, AwardVariant, Contender } from '../types';
import { slugify } from './importIds';

/*
 * What the show graphics need from an award (docs/show-graphics-contract.md).
 * The awards are jokes and their rules are whatever the host says, so nothing
 * here refuses anything: ties, surprise winners, the same nominee twice and
 * any number of nominees are all fine. Checks only warn about what won't fit
 * on screen.
 */

export const VARIANTS: AwardVariant[] = ['standard', 'film-only', 'honoree'];

export const VARIANT_LABEL: Record<AwardVariant, string> = {
  standard: 'Standard',
  'film-only': 'Film only',
  honoree: 'Honoree (no winner)',
};

/** More nominees than this may not fit the nominee frame. */
export const NOMINEE_WARN_LIMIT = 7;
/** The honoree frame holds this many. */
export const HONOREE_LIMIT = 2;
/** Names and short names longer than this may not fit. */
export const NAME_WARN_LENGTH = 40;

type Labelled = Pick<Contender, 'label' | 'personName' | 'film'>;

/** A missing variant means `standard`. */
export function variantOf(award: Pick<Award, 'variant'>): AwardVariant {
  return award.variant ?? 'standard';
}

/** `Person — Film`, or whichever of the two exists, else the existing label. */
export function composeLabel(c: Labelled): string {
  const person = c.personName?.trim() ?? '';
  const film = c.film?.trim() ?? '';
  if (person && film) return `${person} — ${film}`;
  return person || film || (c.label ?? '').trim();
}

/* ---------- slugs ---------- */

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

interface Sluggable {
  /** Set when the award already exists, so it does not clash with itself. */
  id?: string;
  name: string;
  slug?: string;
  contenders: Contender[];
}

/**
 * Fills in missing slugs and never changes an existing one, so renaming never
 * breaks a run cue.
 * - Award: `<kebab name>-<year>`, unique within the season.
 * - Contender: from the person name, else the film, else the label; unique
 *   within the award (`-2`, `-3`, ... for repeats such as the same
 *   performance nominated twice).
 */
export function ensureSlugs<T extends Sluggable>(
  award: T,
  seasonAwards: ReadonlyArray<{ id?: string; slug?: string }>,
  year: number,
): T & { slug: string } {
  let slug = award.slug;
  if (!slug) {
    const taken = new Set<string>();
    for (const other of seasonAwards) {
      if (other.slug && !(award.id && other.id === award.id)) taken.add(other.slug);
    }
    slug = uniqueSlug(`${slugify(award.name)}-${year}`, taken);
  }

  const contenders = award.contenders ?? [];
  const takenContenders = new Set(contenders.flatMap((c) => (c.slug ? [c.slug] : [])));
  const withSlugs = contenders.map((c) => {
    if (c.slug) return c;
    const source = c.personName?.trim() || c.film?.trim() || c.label?.trim() || '';
    const next = uniqueSlug(slugify(source), takenContenders);
    takenContenders.add(next);
    return { ...c, slug: next };
  });

  return { ...award, slug, contenders: withSlugs };
}

/* ---------- winners ---------- */

type Decidable = Pick<Award, 'variant' | 'contenders' | 'winnerContenderIds'>;

/** The winning contenders, in the order of `winnerContenderIds`. Unknown ids and repeats are skipped. */
export function winnersOf(award: Pick<Award, 'contenders' | 'winnerContenderIds'>): Contender[] {
  const contenders = award.contenders ?? [];
  const out: Contender[] = [];
  for (const id of award.winnerContenderIds ?? []) {
    const c = contenders.find((x) => x.id === id);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** True with at least one winner, or, for an honoree award, with 1 or 2 honorees (nominees) marked. */
export function isDecided(award: Decidable): boolean {
  if (winnersOf(award).length > 0) return true;
  if (variantOf(award) !== 'honoree') return false;
  const honorees = (award.contenders ?? []).filter((c) => c.nominee).length;
  return honorees >= 1 && honorees <= HONOREE_LIMIT;
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/* ---------- warnings ---------- */

function clip(text: string): string {
  return text.length > 30 ? `${text.slice(0, 29)}…` : text;
}

/**
 * Plain-language warnings about what may not fit on screen. They never block
 * a save: an unconventional award is the host's call.
 */
export function layoutWarnings(
  award: Pick<Award, 'variant' | 'shortName' | 'contenders' | 'winnerContenderIds'>,
): string[] {
  const warnings: string[] = [];
  const contenders = (award.contenders ?? []).filter((c) => composeLabel(c));
  const nominees = contenders.filter((c) => c.nominee);

  if (variantOf(award) === 'honoree') {
    if (nominees.length > HONOREE_LIMIT) {
      warnings.push(`${nominees.length} honorees. The honoree frame holds ${HONOREE_LIMIT}, so the rest may not fit on screen.`);
    }
  } else if (nominees.length > NOMINEE_WARN_LIMIT) {
    warnings.push(`${nominees.length} nominees. More than ${NOMINEE_WARN_LIMIT} may not fit on screen.`);
  }

  const shortName = award.shortName?.trim() ?? '';
  if (shortName.length > NAME_WARN_LENGTH) {
    warnings.push(`The short name is ${shortName.length} characters. Over ${NAME_WARN_LENGTH} may not fit on screen.`);
  }

  // Only what the show draws: nominees and winners.
  const shown = contenders.filter((c) => c.nominee || award.winnerContenderIds?.includes(c.id));
  for (const c of shown) {
    const parts = c.personName?.trim() || c.film?.trim() ? [c.personName, c.film] : [c.label];
    for (const part of parts) {
      const text = part?.trim() ?? '';
      if (text.length > NAME_WARN_LENGTH) {
        warnings.push(`“${clip(text)}” is ${text.length} characters. Names over ${NAME_WARN_LENGTH} may not fit on screen.`);
      }
    }
  }
  return warnings;
}

/* ---------- stale panel guard ---------- */

/** Milliseconds of a Firestore Timestamp (or anything shaped like one), else null. */
export function stampMs(ts: unknown): number | null {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof ts.toMillis === 'function') {
    const ms = (ts as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

const META_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'updatedBy']);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** The award's own fields as one comparable string: no id, no timestamps, `undefined` ignored. */
export function awardFingerprint(award: object): string {
  const own = Object.fromEntries(Object.entries(award).filter(([k]) => !META_KEYS.has(k)));
  return JSON.stringify(canonical(own));
}

export interface AwardVersion {
  updatedMs: number | null;
  fingerprint: string;
}

/**
 * Has the stored award changed since the panel loaded it? A different
 * `updatedAt` says yes, unless the fields are identical: a pending server
 * timestamp reads back as a local estimate first, which is not a real change.
 */
export function changedSince(loaded: AwardVersion, stored: AwardVersion): boolean {
  if (loaded.updatedMs !== null && loaded.updatedMs === stored.updatedMs) return false;
  return loaded.fingerprint !== stored.fingerprint;
}
