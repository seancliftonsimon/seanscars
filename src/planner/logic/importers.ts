import type {
  Award,
  ChecklistItem,
  Film,
  FilmReaction,
  Idea,
  IdeaTag,
  Invitation,
  Person,
  Piece,
  Question,
  RecordMeta,
  Segment,
  SegmentType,
  ShowConfig,
  Venue,
  VenueStatus,
} from '../types';
import { ORDER_GAP, stripUndefined } from './records';
import { isIsoDate } from './season';
import { defaultSteps } from './steps';

/*
 * Pure mappers from parsed CSV rows (and the timer's show config) to
 * planner records. Nothing here touches Firestore: the import page shows
 * `problems` in a preview and decides what to write. An item with problems
 * is still returned. `importKey` is the natural key used to make re-imports
 * update matching records instead of duplicating them.
 */

/** A record's own fields: everything except the write-time metadata. */
export type Fields<T> = Omit<T, keyof RecordMeta>;

export type Row = Record<string, string>;

/** Presenter labels that mean Sean or the house, so there is no owner. */
export const HOUSE_PRESENTERS = ['Sharemony', 'Sean Simon', 'Seancademy'];

/** Lowercased, diacritic-free, whitespace-collapsed form used as a key. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Splits 'Ada & Ben' into names, dropping blanks and house presenters. */
export function splitPresenters(presenter: string): string[] {
  const house = HOUSE_PRESENTERS.map((h) => h.toLowerCase());
  return presenter
    .split('&')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !house.includes(part.toLowerCase()));
}

/** 171*60 → '171:00', 65 → '1:05'. */
export function formatMSS(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function seasonTotalSec(segments: { plannedSec: number }[]): number {
  return segments.reduce((sum, s) => sum + s.plannedSec, 0);
}

/** Headers each importer's CSV must have (lowercase). */
export const REQUIRED_HEADERS: Record<
  | 'attendees'
  | 'maybeInvites'
  | 'awards2026'
  | 'films'
  | 'ideas'
  | 'venues'
  | 'questions'
  | 'postmortem',
  string[]
> = {
  attendees: ['name', 'plus_ones', 'brunch', 'notes'],
  maybeInvites: ['name', 'notes'],
  awards2026: ['name', 'block', 'recognizes', 'format', 'video_seconds', 'winner'],
  films: ['title', 'seen', 'reaction', 'ideas'],
  ideas: ['tag', 'text'],
  venues: ['name', 'status', 'dates_offered', 'quote_usd', 'capacity', 'notes', 'link'],
  questions: ['question', 'due', 'notes'],
  postmortem: ['area', 'text', 'priority'],
};

/* ---------- small helpers ---------- */

const YES = /^(y|yes|true|1)$/i;
const WHOLE_NUMBER = /^\d+$/;

/** Trimmed value of a column, '' when missing. */
function cell(row: Row, key: string): string {
  return (row[key] ?? '').trim();
}

/** The trimmed string, or undefined when blank. */
function opt(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const orderFor = (index: number): number => (index + 1) * ORDER_GAP;

/* ---------- timer segments ---------- */

export interface TimerSegmentImport {
  /** The timer segment id. */
  importKey: string;
  segment: Fields<Segment>;
  /** Names to link to people; the writer fills `ownerPersonIds` from these. */
  ownerNames: string[];
  problems: string[];
}

const TIMER_TYPES = ['live', 'pretape', 'intermission'];

export function mapTimerSegments(config: ShowConfig): TimerSegmentImport[] {
  return config.segments.map((seg, i) => {
    const problems: string[] = [];
    if (!seg.title || seg.title.trim() === '') problems.push('Title is empty.');
    if (!Number.isInteger(seg.durationSec) || seg.durationSec <= 0) {
      problems.push(`Duration must be a positive whole number of seconds (got ${seg.durationSec}).`);
    }
    if (!TIMER_TYPES.includes(seg.type)) problems.push(`Unknown type "${seg.type}".`);

    const type: SegmentType = TIMER_TYPES.includes(seg.type) ? seg.type : 'live';
    const playbackSource =
      type === 'pretape' ? 'video' : type === 'intermission' ? 'none' : 'slides';

    return {
      importKey: seg.id,
      segment: stripUndefined({
        order: orderFor(i),
        title: seg.title,
        type,
        playbackSource,
        plannedSec: seg.durationSec,
        ownerPersonIds: [],
        presenterLabel: opt(seg.presenter ?? ''),
      }),
      ownerNames: splitPresenters(seg.presenter ?? ''),
      problems,
    };
  });
}

/* ---------- attendees and maybe-invites ---------- */

export interface AttendeeImport {
  importKey: string;
  person: Fields<Person>;
  invitation: Fields<Invitation>;
  problems: string[];
}

export function mapAttendees(rows: Row[]): AttendeeImport[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const problems: string[] = [];
    const name = cell(row, 'name');
    const key = normalizeName(name);
    if (name === '') problems.push('Name is blank.');
    else if (seen.has(key)) problems.push(`Duplicate name "${name}".`);
    seen.add(key);

    const rawPlus = cell(row, 'plus_ones');
    let plusOnes = 0;
    if (rawPlus !== '') {
      if (WHOLE_NUMBER.test(rawPlus)) plusOnes = parseInt(rawPlus, 10);
      else problems.push(`Plus-ones "${rawPlus}" is not a whole number.`);
    }

    return {
      importKey: key,
      person: { name },
      invitation: stripUndefined({
        status: 'confirmed' as const,
        plusOnes,
        brunch: YES.test(cell(row, 'brunch')),
        rsvpIds: [],
        notes: opt(cell(row, 'notes')),
      }),
      problems,
    };
  });
}

export interface MaybeInviteImport {
  importKey: string;
  person: Fields<Person>;
  problems: string[];
}

export function mapMaybeInvites(rows: Row[]): MaybeInviteImport[] {
  return rows.map((row) => {
    const name = cell(row, 'name');
    return {
      importKey: normalizeName(name),
      person: stripUndefined({ name, notes: opt(cell(row, 'notes')) }),
      problems: name === '' ? ['Name is blank.'] : [],
    };
  });
}

/* ---------- 2026 awards ---------- */

export interface AwardImport {
  importKey: string;
  award: Fields<Award>;
  piece: Omit<Fields<Piece>, 'awardId'>;
  problems: string[];
}

/**
 * Segment titles each CSV block may belong to, most specific first. The
 * 2026 timer doc splits the Seanscars block into "A few more Seanscar
 * awards" (after intermission) and "The Seanscars" (finale).
 */
const BLOCK_SEGMENT_TITLES: Record<string, string[]> = {
  opening: ['Welcome & Initial Awards'],
  'after-intermission': ['A few more Seanscar awards', 'Seanscars'],
  finale: ['Seanscars'],
};

/** Title compared case-insensitively and without a leading "The". */
function titleKey(title: string): string {
  return normalizeName(title).replace(/^the /, '');
}

export function mapAwards2026(rows: Row[], segments: { id: string; title: string }[]): AwardImport[] {
  return rows.map((row, i) => {
    const problems: string[] = [];
    const name = cell(row, 'name');
    if (name === '') problems.push('Name is blank.');

    const block = cell(row, 'block').toLowerCase();
    let segmentId: string | undefined;
    if (block !== '') {
      const titles = BLOCK_SEGMENT_TITLES[block];
      if (!titles) {
        problems.push(`Unknown block "${cell(row, 'block')}".`);
      } else {
        const match = titles
          .map((title) => segments.find((s) => titleKey(s.title) === titleKey(title)))
          .find(Boolean);
        if (match) segmentId = match.id;
        else problems.push(`No segment titled "${titles.join('" or "')}" for block "${block}".`);
      }
    }

    const rawSeconds = cell(row, 'video_seconds');
    let measuredSec: number | undefined;
    if (rawSeconds !== '') {
      if (WHOLE_NUMBER.test(rawSeconds)) measuredSec = parseInt(rawSeconds, 10);
      else problems.push(`Video seconds "${rawSeconds}" is not a whole number.`);
    }

    const winner = cell(row, 'winner');
    const format = cell(row, 'format');
    const order = orderFor(i);

    return {
      importKey: normalizeName(name),
      award: stripUndefined({
        order,
        name,
        recognizes: opt(cell(row, 'recognizes')),
        stage: winner !== '' ? ('winner' as const) : ('nominees' as const),
        returning: true,
        segmentId,
        contenders: winner !== '' ? [{ id: 'winner', label: winner, nominee: true }] : [],
        winnerContenderId: winner !== '' ? 'winner' : undefined,
        notes: format !== '' ? `Format: ${format}` : undefined,
      }),
      piece: stripUndefined({
        title: name,
        kind: 'award-video' as const,
        ownerPersonIds: [],
        segmentId,
        order,
        steps: defaultSteps('award-video', 'done'),
        measuredSec,
        links: [],
      }),
      problems,
    };
  });
}

/* ---------- 2027 pools and logistics ---------- */

export interface FilmImport {
  importKey: string;
  film: Fields<Film>;
  problems: string[];
}

const REACTIONS: FilmReaction[] = ['loved', 'liked', 'meh', 'disliked'];

export function mapFilms(rows: Row[]): FilmImport[] {
  return rows.map((row) => {
    const problems: string[] = [];
    const title = cell(row, 'title');
    if (title === '') problems.push('Title is blank.');

    const rawReaction = cell(row, 'reaction');
    const reaction = REACTIONS.find((r) => r === rawReaction.toLowerCase());
    if (rawReaction !== '' && !reaction) problems.push(`Unknown reaction "${rawReaction}".`);

    return {
      importKey: normalizeName(title),
      film: stripUndefined({
        title,
        seen: YES.test(cell(row, 'seen')),
        reaction,
        eligible: true,
        onBallot: false,
        ideas: opt(cell(row, 'ideas')),
      }),
      problems,
    };
  });
}

export interface IdeaImport {
  importKey: string;
  idea: Fields<Idea>;
  problems: string[];
}

const IDEA_TAGS: IdeaTag[] = ['song', 'award', 'bit', 'theme', 'other'];

export function mapIdeas(rows: Row[]): IdeaImport[] {
  return rows.map((row) => {
    const problems: string[] = [];
    const text = cell(row, 'text');
    if (text === '') problems.push('Text is blank.');

    const rawTag = cell(row, 'tag');
    const found = IDEA_TAGS.find((t) => t === rawTag.toLowerCase());
    if (!found) problems.push(`Unknown tag "${rawTag}"; using "other".`);

    return {
      importKey: normalizeName(text),
      idea: { text, tag: found ?? 'other' },
      problems,
    };
  });
}

export interface VenueImport {
  importKey: string;
  venue: Fields<Venue>;
  problems: string[];
}

const VENUE_STATUSES: VenueStatus[] = ['researching', 'inquired', 'holding', 'booked', 'declined'];

export function mapVenues(rows: Row[]): VenueImport[] {
  return rows.map((row) => {
    const problems: string[] = [];
    const name = cell(row, 'name');
    if (name === '') problems.push('Name is blank.');

    const rawStatus = cell(row, 'status');
    const status = VENUE_STATUSES.find((s) => s === rawStatus.toLowerCase());
    if (!status) problems.push(`Unknown status "${rawStatus}"; using "researching".`);

    const rawQuote = cell(row, 'quote_usd');
    let quoteUsd: number | undefined;
    if (rawQuote !== '') {
      const n = Number(rawQuote.replace(/[$,\s]/g, ''));
      if (Number.isFinite(n)) quoteUsd = n;
      else problems.push(`Quote "${rawQuote}" is not a number.`);
    }

    const rawCapacity = cell(row, 'capacity');
    const firstInt = rawCapacity.match(/\d+/);
    const capacity = firstInt ? parseInt(firstInt[0], 10) : undefined;
    const notes = [
      opt(cell(row, 'notes')),
      rawCapacity !== '' && !WHOLE_NUMBER.test(rawCapacity) ? `Capacity: ${rawCapacity}` : undefined,
    ]
      .filter((n): n is string => n !== undefined)
      .join('\n');

    const link = cell(row, 'link');

    return {
      importKey: normalizeName(name),
      venue: stripUndefined({
        name,
        status: status ?? 'researching',
        datesOffered: opt(cell(row, 'dates_offered')),
        quoteUsd,
        capacity,
        links: link !== '' ? [{ label: 'Link', url: link }] : [],
        notes: opt(notes),
      }),
      problems,
    };
  });
}

export interface QuestionImport {
  importKey: string;
  question: Fields<Question>;
  problems: string[];
}

export function mapQuestions(rows: Row[]): QuestionImport[] {
  return rows.map((row) => {
    const problems: string[] = [];
    const text = cell(row, 'question');
    if (text === '') problems.push('Question is blank.');

    const due = cell(row, 'due');
    let dueDate: string | undefined;
    if (due !== '') {
      if (isIsoDate(due)) dueDate = due;
      else problems.push(`Due date "${due}" must be YYYY-MM-DD.`);
    }

    return {
      importKey: normalizeName(text),
      question: stripUndefined({
        question: text,
        dueDate,
        status: 'open' as const,
        notes: opt(cell(row, 'notes')),
      }),
      problems,
    };
  });
}

export interface PostmortemImport {
  importKey: string;
  item: Fields<ChecklistItem>;
  problems: string[];
}

export function mapPostmortem(rows: Row[]): PostmortemImport[] {
  return rows.map((row, i) => {
    const text = cell(row, 'text');
    const optional = cell(row, 'priority').toLowerCase() === 'optional';
    return {
      importKey: normalizeName(text),
      item: stripUndefined({
        text: optional ? `(optional) ${text}` : text,
        area: opt(cell(row, 'area')),
        done: false,
        order: orderFor(i),
      }),
      problems: text === '' ? ['Text is blank.'] : [],
    };
  });
}
