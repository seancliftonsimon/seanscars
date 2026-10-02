import type { Award, ChecklistItem, Invitation, IsoDate, Piece, Publish, Season, WithId } from '../types';
import type { ScheduleTotals } from './clock';
import { describeOverUnder } from './clockFormat';
import { deckStage } from './contributors';
import { plural } from './dates';
import { isComplete } from './steps';

/*
 * Show-week readiness, derived from what's already in the planner. Each
 * item says what's outstanding and links to it.
 */

export interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  href: string;
}

export interface ReadinessInput {
  season: Pick<Season, 'timerDocId' | 'showDate'>;
  totals: ScheduleTotals;
  segmentCount: number;
  pieces: WithId<Piece>[];
  awards: WithId<Award>[];
  checklist: WithId<ChecklistItem>[];
  invitations: WithId<Invitation>[];
  /** Newest first. */
  publishes: WithId<Publish>[];
  /** The plan differs from the last publish (see publishDiff.changedSincePublish). */
  changedSinceLivePublish: boolean;
  today: IsoDate;
}

export function readiness(input: ReadinessInput): ReadinessItem[] {
  const { season, totals, pieces, awards, checklist, invitations, publishes } = input;
  const incomplete = pieces.filter((p) => !isComplete(p));
  const decks = pieces.filter((p) => p.kind === 'contributor-deck');
  const decksNotIn = decks.filter((p) => deckStage(p) !== 'inDeck');
  const undecided = awards.filter((a) => a.stage !== 'cut' && a.stage !== 'idea' && !a.winnerContenderId);
  const dueBy = season.showDate ?? input.today;
  const tasksOpen = checklist.filter((c) => !c.done && (!c.dueDate || c.dueDate <= dueBy));
  const noReply = invitations.filter((i) => i.status === 'invited');
  const live = publishes.find((p) => p.targetDocId === season.timerDocId);

  return [
    {
      id: 'clock',
      label: 'The show fits its time',
      done: input.segmentCount > 0 && totals.state !== 'over',
      detail: input.segmentCount === 0 ? 'No run of show yet.' : describeOverUnder(totals) + '.',
      href: '/plan/show',
    },
    {
      id: 'pieces',
      label: 'Every piece is finished',
      done: incomplete.length === 0,
      detail: incomplete.length ? `${plural(incomplete.length, 'piece')} still in progress.` : 'All done.',
      href: '/plan/make?view=pieces&show=incomplete',
    },
    {
      id: 'decks',
      label: 'Guest presentations checked and in the master deck',
      done: decksNotIn.length === 0,
      detail: decks.length === 0 ? 'No guest presentations.' : decksNotIn.length ? `${decksNotIn.length} of ${decks.length} not in the master deck yet.` : `All ${decks.length} in.`,
      href: '/plan/make?view=guests',
    },
    {
      id: 'awards',
      label: 'Every award has a winner',
      done: undecided.length === 0,
      detail: undecided.length ? `Still to decide: ${undecided.map((a) => a.name).join(', ')}.` : 'All decided.',
      href: '/plan/make?view=awards',
    },
    {
      id: 'guests',
      label: 'Everyone has answered',
      done: noReply.length === 0,
      detail: noReply.length ? `${plural(noReply.length, 'guest')} haven’t replied.` : 'Final numbers are in.',
      href: '/plan/guests?view=waiting',
    },
    {
      id: 'tasks',
      label: 'Checklist done',
      done: tasksOpen.length === 0,
      detail: tasksOpen.length ? `${plural(tasksOpen.length, 'task')} due by show day still open.` : 'Nothing left before show day.',
      href: '/plan/prep?view=checklist',
    },
    {
      id: 'published',
      label: 'Published to the live timer',
      done: Boolean(live),
      detail: live ? 'Published to the live timer.' : publishes.length ? 'Only published to the test copy so far.' : 'Not published yet.',
      href: '/plan/show/ready?publish=1',
    },
    {
      id: 'unchanged',
      label: 'Timer matches the plan',
      done: Boolean(live) && !input.changedSinceLivePublish,
      detail: !live ? 'Publish to the live timer first.' : input.changedSinceLivePublish ? 'The plan changed since the last live publish.' : 'No changes since the last live publish.',
      href: '/plan/show/ready?publish=1',
    },
  ];
}

/**
 * The document this build of the site's Backstage Timer reads. Mirrors the
 * timer's own rule (src/pages/BackstageTimer.tsx, which the planner never
 * changes): VITE_RUN_OF_SHOW_DOC_ID, else its built-in default.
 */
export const TIMER_DEFAULT_DOC_ID = 'seanscars-2026-rundown';
export function timerTargetDocId(envValue: string | undefined): string {
  return envValue?.trim() || TIMER_DEFAULT_DOC_ID;
}
