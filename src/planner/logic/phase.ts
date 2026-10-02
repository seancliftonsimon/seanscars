import type { Invitation, IsoDate, PhaseId, Season } from '../types';
import { daysBetween } from './dates';
import { isSent } from './invites';

/*
 * The season's phase, derived from data so Sean never has to set it. The
 * home screen leads with what matters in that phase (see RELEVANCE). A
 * manual override on the season wins, and nothing is ever unreachable:
 * a "hidden" block is only left off the home screen.
 */

export interface PhaseInfo {
  id: PhaseId;
  label: string;
  /** What this phase is about, in one line. */
  focus: string;
}

export const PHASES: PhaseInfo[] = [
  { id: 'setup', label: 'Set up', focus: 'Pick a date, a venue and the shape of the show.' },
  { id: 'lists', label: 'Build the lists', focus: 'Decide who to invite and what goes in the show.' },
  { id: 'invites', label: 'Invitations out', focus: 'Send invitations, file replies, nudge the quiet ones.' },
  { id: 'production', label: 'Production', focus: 'Make the pieces and line up the presenters.' },
  { id: 'showweek', label: 'Show week', focus: 'Lock the numbers, publish the timer, print.' },
  { id: 'after', label: 'After the show', focus: 'Thank people and set up next year.' },
];

export const phaseInfo = (id: PhaseId) => PHASES.find((p) => p.id === id) as PhaseInfo;

/** Show week starts this many days out. */
export const SHOW_WEEK_DAYS = 7;
/** "Production" once the show is this close, even if replies are still coming in. */
export const PRODUCTION_DAYS = 28;

export interface PhaseInput {
  season: Pick<Season, 'showDate' | 'phaseOverride'>;
  invitations: Pick<Invitation, 'status' | 'invitedAt' | 'respondedAt'>[];
  segmentCount: number;
  awardCount: number;
}

export interface DerivedPhase {
  id: PhaseId;
  /** The phase the data says, ignoring the override. */
  derived: PhaseId;
  overridden: boolean;
  /** Plain-language reason for the derived phase. */
  reason: string;
  /** Days until the show (negative after), or null without a date. */
  daysToShow: number | null;
}

export function derivePhase(input: PhaseInput, today: IsoDate): DerivedPhase {
  const { season, invitations, segmentCount, awardCount } = input;
  const daysToShow = season.showDate ? daysBetween(today, season.showDate) : null;
  const sent = invitations.filter(isSent);
  const unanswered = sent.filter((i) => i.status === 'invited').length;

  let derived: PhaseId;
  let reason: string;
  if (daysToShow === null) {
    derived = 'setup';
    reason = 'The show date isn’t set yet.';
  } else if (daysToShow < 0) {
    derived = 'after';
    reason = 'The show date has passed.';
  } else if (daysToShow <= SHOW_WEEK_DAYS) {
    derived = 'showweek';
    reason = `The show is ${daysToShow === 0 ? 'today' : `${daysToShow} day${daysToShow === 1 ? '' : 's'} away`}.`;
  } else if (segmentCount === 0 && awardCount === 0 && invitations.length === 0) {
    derived = 'setup';
    reason = 'No run of show, awards or guest list yet.';
  } else if (sent.length === 0) {
    derived = 'lists';
    reason = 'No invitation has been sent yet.';
  } else if (daysToShow > PRODUCTION_DAYS && unanswered * 4 > sent.length) {
    derived = 'invites';
    reason = `${unanswered} of ${sent.length} invitations haven’t been answered.`;
  } else {
    derived = 'production';
    reason = daysToShow <= PRODUCTION_DAYS ? `The show is ${daysToShow} days away.` : 'Most invitations have been answered.';
  }

  const override = season.phaseOverride && PHASES.some((p) => p.id === season.phaseOverride) ? season.phaseOverride : null;
  return { id: override ?? derived, derived, overridden: Boolean(override && override !== derived), reason, daysToShow };
}

/* ---------- relevance matrix ---------- */

export type Relevance = 'headline' | 'supporting' | 'hidden';

export type InfoBlock =
  | 'setupSteps'
  | 'venueChoice'
  | 'projectedHeadcount'
  | 'sendProgress'
  | 'rsvpInbox'
  | 'rsvpCounts'
  | 'waitingOnReplies'
  | 'finalNumbers'
  | 'clockVerdict'
  | 'makeQueue'
  | 'contributorPipeline'
  | 'awardDecisions'
  | 'openQuestions'
  | 'checklistDue'
  | 'readiness'
  | 'publishStatus'
  | 'ideasInbox'
  | 'wrapUp';

const H: Relevance = 'headline';
const S: Relevance = 'supporting';
const X: Relevance = 'hidden';

/** Columns: setup, lists, invites, production, showweek, after. */
const MATRIX: Record<InfoBlock, [Relevance, Relevance, Relevance, Relevance, Relevance, Relevance]> = {
  setupSteps: [H, X, X, X, X, X],
  venueChoice: [H, S, X, X, X, X],
  projectedHeadcount: [S, H, H, S, X, X],
  sendProgress: [X, S, H, X, X, X],
  rsvpInbox: [X, X, H, S, S, X],
  rsvpCounts: [X, X, S, S, X, X],
  waitingOnReplies: [X, X, S, H, S, X],
  finalNumbers: [X, X, X, S, H, S],
  clockVerdict: [X, S, S, H, H, X],
  makeQueue: [X, S, S, H, S, X],
  contributorPipeline: [X, X, S, H, S, X],
  awardDecisions: [S, H, S, S, X, X],
  openQuestions: [S, S, S, S, S, X],
  checklistDue: [S, S, S, S, H, S],
  readiness: [X, X, X, S, H, X],
  publishStatus: [X, X, X, X, S, X],
  ideasInbox: [S, S, X, X, X, S],
  wrapUp: [X, X, X, X, X, H],
};

export const INFO_BLOCK_LABEL: Record<InfoBlock, string> = {
  setupSteps: 'Season setup steps',
  venueChoice: 'Venue comparison',
  projectedHeadcount: 'Projected headcount vs capacity (with plus-ones)',
  sendProgress: 'Invitations sent progress',
  rsvpInbox: 'New RSVPs to file',
  rsvpCounts: 'Reply counts (coming, maybe, can’t, no reply)',
  waitingOnReplies: 'Waiting on replies / nudges',
  finalNumbers: 'Final numbers, brunch, door list',
  clockVerdict: 'Show clock verdict',
  makeQueue: 'My queue (next steps)',
  contributorPipeline: 'Guest presentations pipeline',
  awardDecisions: 'Awards waiting on a decision',
  openQuestions: 'Open questions',
  checklistDue: 'Checklist due soon',
  readiness: 'Show-week readiness',
  publishStatus: 'Timer publish status',
  ideasInbox: 'Ideas inbox',
  wrapUp: 'Wrap-up and next season',
};

const PHASE_INDEX: Record<PhaseId, number> = { setup: 0, lists: 1, invites: 2, production: 3, showweek: 4, after: 5 };

export function relevance(block: InfoBlock, phase: PhaseId): Relevance {
  return MATRIX[block][PHASE_INDEX[phase]];
}

export const INFO_BLOCKS = Object.keys(MATRIX) as InfoBlock[];
