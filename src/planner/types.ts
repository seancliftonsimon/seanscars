import type { Timestamp } from 'firebase/firestore';

/*
 * Planner record types. These mirror the canonical data model in the
 * planning README exactly (paths, field names, units).
 *
 * Conventions:
 * - Times of day: 'HH:MM' 24-hour strings.
 * - Durations: whole seconds, in fields ending `Sec`.
 * - Dates: 'YYYY-MM-DD'.
 * - List order: numeric `order` with gaps of 1000.
 */

export type TimeOfDay = string; // 'HH:MM'
export type IsoDate = string; // 'YYYY-MM-DD'

/** Metadata written by createRecord / updateRecord. */
export interface RecordMeta {
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
}

/** A record as read back from Firestore: its fields plus the doc id. */
export type WithId<T> = T & { id: string };

export interface Link {
  label: string;
  url: string;
}

/* ---------- plannerConfig/access ---------- */

export interface PlannerAccess {
  emails: string[];
}

/* ---------- seasons/{seasonId} ---------- */

export interface Season extends RecordMeta {
  year: number;
  name: string;
  showDate?: IsoDate;
  doorsTime?: TimeOfDay;
  showStartTime: TimeOfDay;
  runtimeCapSec: number;
  bufferTargetSec: number;
  capacity?: number;
  venueOptionId?: string;
  timerDocId: string;
  masterDeckUrl?: string;
  driveFolderUrl?: string;
  theme?: string;
  archived: boolean;
  /**
   * Optional manual phase for the home screen (see logic/phase.ts). Unset =
   * derived from the season's data. Stored on the season so the phone and
   * the desktop agree.
   */
  phaseOverride?: PhaseId;
}

export type PhaseId = 'setup' | 'lists' | 'invites' | 'production' | 'showweek' | 'after';

/* ---------- seasons/{s}/segments/{id} ---------- */

export type SegmentType = 'live' | 'pretape' | 'song' | 'intermission';
export type PlaybackSource = 'slides' | 'video' | 'browser' | 'live-music' | 'none';

export interface Segment extends RecordMeta {
  order: number;
  title: string;
  type: SegmentType;
  playbackSource: PlaybackSource;
  plannedSec: number;
  hardTime?: TimeOfDay;
  /** Empty = Sean or house. */
  ownerPersonIds: string[];
  presenterLabel?: string;
  notes?: string;
}

/* ---------- seasons/{s}/awards/{id} ---------- */

export type AwardStage = 'idea' | 'contenders' | 'nominees' | 'winner' | 'cut';

export interface Contender {
  id: string;
  label: string;
  filmId?: string;
  nominee: boolean;
  note?: string;
}

export interface Award extends RecordMeta {
  order: number;
  name: string;
  recognizes?: string;
  stage: AwardStage;
  returning: boolean;
  segmentId?: string;
  contenders: Contender[];
  winnerContenderId?: string;
  notes?: string;
}

/* ---------- seasons/{s}/pieces/{id} ---------- */

export type PieceKind = 'award-video' | 'song' | 'slides-bit' | 'contributor-deck' | 'other';
export type StepStatus = 'todo' | 'doing' | 'done';

export interface PieceStep {
  key: string;
  label: string;
  status: StepStatus;
}

export type WaitingOnKind = 'award' | 'piece' | 'venue' | 'question';

export interface WaitingOn {
  kind: WaitingOnKind;
  id: string;
}

export interface Piece extends RecordMeta {
  title: string;
  kind: PieceKind;
  /** Empty = Sean. */
  ownerPersonIds: string[];
  awardId?: string;
  segmentId?: string;
  order: number;
  steps: PieceStep[];
  dueDate?: IsoDate;
  estSec?: number;
  confirmedSec?: number;
  measuredSec?: number;
  links: Link[];
  waitingOn?: WaitingOn;
  notes?: string;
}

/* ---------- people/{personId} (not per season) ---------- */

export interface Person extends RecordMeta {
  name: string;
  email?: string;
  aliases?: string[];
  notes?: string;
  links?: Link[];
}

/* ---------- seasons/{s}/invitations/{personId} ---------- */

export type InvitationStatus =
  | 'invite?'
  | 'invited'
  | 'confirmed'
  | 'maybe'
  | 'declined'
  | 'not-inviting';

export type InviteMethod = 'text' | 'mail' | 'hand' | 'email';

export interface Invitation extends RecordMeta {
  status: InvitationStatus;
  plusOnes: number;
  brunch: boolean;
  method?: InviteMethod;
  invitedAt?: IsoDate;
  respondedAt?: IsoDate;
  rsvpIds: string[];
  notes?: string;
  /** Optional: last time Sean nudged them for a reply. */
  nudgedAt?: IsoDate;
}

/* ---------- seasons/{s}/venues/{id} ---------- */

export type VenueStatus = 'researching' | 'inquired' | 'holding' | 'booked' | 'declined';

export interface Venue extends RecordMeta {
  name: string;
  status: VenueStatus;
  datesOffered?: string;
  quoteUsd?: number;
  capacity?: number;
  depositDue?: IsoDate;
  lastContactDate?: IsoDate;
  links: Link[];
  notes?: string;
}

/* ---------- seasons/{s}/questions/{id} ---------- */

export type QuestionStatus = 'open' | 'decided';

export interface Question extends RecordMeta {
  question: string;
  dueDate?: IsoDate;
  status: QuestionStatus;
  answer?: string;
  options?: string;
  notes?: string;
}

/* ---------- seasons/{s}/checklist/{id} ---------- */

export interface ChecklistItem extends RecordMeta {
  text: string;
  area?: string;
  dueDate?: IsoDate;
  done: boolean;
  waitingOn?: WaitingOn;
  order: number;
}

/* ---------- seasons/{s}/films/{id} ---------- */

export type FilmReaction = 'loved' | 'liked' | 'meh' | 'disliked';

export interface Film extends RecordMeta {
  title: string;
  seen: boolean;
  reaction?: FilmReaction;
  eligible: boolean;
  onBallot: boolean;
  ideas?: string;
}

/* ---------- seasons/{s}/ideas/{id} ---------- */

export type IdeaTag = 'song' | 'award' | 'bit' | 'theme' | 'other';

export interface Idea extends RecordMeta {
  text: string;
  tag: IdeaTag;
  link?: string;
  promotedTo?: { kind: string; id: string };
}

/* ---------- seasons/{s}/songs/{id} ---------- */

/** One line of a parody: the original beside Sean's rewrite. */
export interface SongLine {
  id: string;
  original: string;
  mine: string;
  /** Who sings it, e.g. "Cassie", "Both", "Choir". */
  singer?: string;
  /** Performance cue, e.g. "doubled lead", "chorus only". */
  cue?: string;
}

export interface SongSection {
  id: string;
  /** "Verse 1", "Chorus", "Bridge"… */
  label: string;
  lines: SongLine[];
  /** Id of an earlier section whose rewrite this one repeats (a chorus written once). */
  repeatOf?: string;
}

/** A song being parodied: the original lyrics and the rewrite, side by side. */
export interface Song extends RecordMeta {
  title: string;
  artist?: string;
  /** The song piece (a single song or a medley) this belongs to; unset = not placed yet. */
  pieceId?: string;
  /** Order within its piece (medley order) or the songbook. */
  order: number;
  sections: SongSection[];
  /** Rhyme brainstorm, free text. */
  scratch?: string;
  notes?: string;
}

/* ---------- seasons/{s}/publishes/{id} ---------- */

export interface Publish extends RecordMeta {
  at: Timestamp | null;
  targetDocId: string;
  segmentCount: number;
  totalSec: number;
  byEmail: string;
  payloadUpdatedAtMs: number;
  /** The segments as published, so later timer edits can be listed. */
  segments?: TimerSegment[];
  /** The start time as published, for the same comparisons. */
  showStartTime?: TimeOfDay;
}

/* ---------- rsvps/{id} (public create-only) ---------- */

export interface Rsvp {
  firstName: string;
  lastName: string;
  email: string;
  rsvp: string;
  guestsComment: string;
  attendanceType: string;
  awardName: string;
  /** The current RSVP form sends 'Yes' | 'No'. */
  brunch: string | boolean;
  createdAt: Timestamp | null;
  source: string;
  seasonHint?: string | number;
  /* Planner-only fields (set by the planner, never by the public form). */
  processed?: boolean;
  matchedPersonId?: string;
}

/* ---------- showConfigs/{timerDocId} (owned by the timer) ---------- */

export type TimerSegmentType = 'live' | 'pretape' | 'intermission';

export interface TimerSegment {
  id: string;
  title: string;
  presenter: string;
  type: TimerSegmentType;
  durationSec: number;
}

export interface ShowConfig {
  showStartTime: TimeOfDay;
  segments: TimerSegment[];
  updatedAtMs: number;
}

/* ---------- season subcollections ---------- */

/** Maps each season subcollection name to its record type. */
export interface SeasonSubcollections {
  segments: Segment;
  awards: Award;
  pieces: Piece;
  invitations: Invitation;
  venues: Venue;
  questions: Question;
  checklist: ChecklistItem;
  films: Film;
  ideas: Idea;
  publishes: Publish;
  songs: Song;
}

export type SeasonSubcollection = keyof SeasonSubcollections;
