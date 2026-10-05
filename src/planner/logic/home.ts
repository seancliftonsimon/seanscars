import type { PhaseId } from '../types';
import { plural } from './dates';
import { capacityVerdict, type HeadcountProjection, type ProjectionBasis } from './headcount';
import type { SendProgress, WaitingGuest } from './invites';
import { needsNudge } from './invites';
import type { NowItem, NowView } from './now';
import type { ClockVerdict } from './verdict';

/*
 * The home screen's "Next up": every candidate action with a priority,
 * so the two or three most worth doing now come first. Items carry an
 * inline action where one makes sense, and always a link to the record.
 */

export type InlineAction =
  | { kind: 'answer'; questionId: string }
  | { kind: 'tick'; taskId: string }
  | { kind: 'advance'; pieceId: string }
  | { kind: 'nudge'; personId: string };

export interface HomeAction {
  key: string;
  title: string;
  detail: string;
  href: string;
  priority: number;
  urgent: boolean;
  inline?: InlineAction;
  /** Where it came from, for grouping the full list. */
  group: 'decide' | 'chase' | 'make' | 'plan';
}

export interface HomeInput {
  phase: PhaseId;
  now: NowView;
  projection: HeadcountProjection;
  send: SendProgress;
  waiting: WaitingGuest[];
  inboxCount: number;
  clock: ClockVerdict;
  segmentCount: number;
  awardCount: number;
  hasShowDate: boolean;
  /** Open readiness items, for show week. */
  readinessOpen: number;
  seasonYear: number;
}

/** Which projection the capacity warning uses in each phase. */
export function projectionBasis(phase: PhaseId): ProjectionBasis {
  if (phase === 'setup' || phase === 'lists') return 'everyone';
  if (phase === 'invites' || phase === 'production') return 'likely';
  return 'confirmed';
}

function inlineFor(item: NowItem): InlineAction | undefined {
  if (item.kind === 'question') return { kind: 'answer', questionId: item.id };
  if (item.kind === 'checklist') return { kind: 'tick', taskId: item.id };
  if (item.kind === 'piece' && !item.dim && item.context.startsWith('Next:')) return { kind: 'advance', pieceId: item.id };
  if (item.kind === 'invitation') return { kind: 'nudge', personId: item.id };
  return undefined;
}

function fromNow(item: NowItem, group: HomeAction['group'], base: number): HomeAction {
  return {
    key: item.key,
    title: item.title,
    detail: item.context,
    href: item.href,
    priority: item.overdue ? 90 : item.dim ? 20 : base,
    urgent: Boolean(item.overdue),
    inline: inlineFor(item),
    group,
  };
}

export function homeActions(input: HomeInput): HomeAction[] {
  const { phase, now } = input;
  const out: HomeAction[] = [];
  const add = (a: HomeAction) => out.push(a);

  if (!input.hasShowDate) {
    add({ key: 'setup:date', title: 'Set the show date', detail: 'Everything else counts down from it.', href: '/plan/season', priority: 100, urgent: false, group: 'plan' });
  }
  if (input.segmentCount === 0 && input.awardCount === 0) {
    add({ key: 'setup:rollover', title: `Start ${input.seasonYear} from last year`, detail: 'Copies returning awards, your segments and last year’s guests.', href: '/plan/season', priority: 95, urgent: false, group: 'plan' });
  }
  if (input.inboxCount > 0) {
    add({ key: 'rsvps', title: `File ${plural(input.inboxCount, 'new RSVP')}`, detail: 'Replies from the site, waiting to be matched to guests.', href: '/plan/guests?view=replies', priority: 96, urgent: false, group: 'chase' });
  }
  if (phase === 'showweek' && input.readinessOpen > 0) {
    add({ key: 'ready', title: `Show-week checklist: ${input.readinessOpen} to go`, detail: 'Pieces, presentations, timer, print.', href: '/plan/show/ready', priority: 92, urgent: true, group: 'plan' });
  }

  const basis = projectionBasis(phase);
  const verdict = capacityVerdict(input.projection, basis);
  if (verdict.tone === 'over' && phase !== 'after') {
    add({ key: 'capacity', title: verdict.text, detail: 'Review the guest list, or raise the capacity if the venue allows.', href: '/plan/guests', priority: 88, urgent: false, group: 'plan' });
  }

  const { send } = input;
  if (send.toSend > 0 && (phase === 'lists' || phase === 'invites')) {
    add({
      key: 'send',
      title: send.sent === 0 ? 'Send invitations' : `Send the rest of the invitations`,
      detail: `${send.sent} of ${send.total} sent.`,
      href: '/plan/guests?view=send',
      priority: phase === 'invites' ? 72 : 70,
      urgent: false,
      group: 'plan',
    });
  }

  const nudge = input.waiting.filter(needsNudge);
  if (nudge.length > 0 && phase !== 'lists' && phase !== 'setup' && phase !== 'after') {
    add({ key: 'nudge', title: `Nudge ${plural(nudge.length, 'guest')} who haven’t replied`, detail: 'No reply in two weeks or more.', href: '/plan/guests?view=waiting', priority: 80, urgent: false, group: 'chase' });
  }

  if (input.segmentCount > 0 && input.clock.state !== 'ok' && phase !== 'after') {
    const late = phase === 'production' || phase === 'showweek';
    add({
      key: 'clock',
      title: input.clock.headline,
      detail: input.clock.advice ?? '',
      href: '/plan/show',
      priority: input.clock.state === 'over' ? (late ? 86 : 55) : late ? 60 : 40,
      urgent: input.clock.state === 'over' && late,
      group: 'make',
    });
  }

  for (const item of now.decide) {
    if (item.kind === 'venue' && item.id === '') {
      add({ ...fromNow(item, 'decide', phase === 'setup' || phase === 'lists' ? 85 : 70), href: item.href });
    } else add(fromNow(item, 'decide', item.kind === 'award' ? 62 : 58));
  }
  for (const item of now.chase) {
    // Invitations are summed up in the nudge item; keep them in the full list only.
    add(fromNow(item, 'chase', item.kind === 'invitation' ? 30 : 75));
  }
  now.make.forEach((item, i) => add(fromNow(item, 'make', item.kind === 'checklist' ? 60 : 65 - Math.min(i, 10))));

  if (phase === 'after') {
    add({ key: 'next-season', title: `Set up ${input.seasonYear + 1}`, detail: 'Start next year from this one when you’re ready.', href: '/plan/season', priority: 50, urgent: false, group: 'plan' });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
