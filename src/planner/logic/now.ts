import type {
  ChecklistItem,
  Invitation,
  IsoDate,
  Piece,
  Season,
  Segment,
  WithId,
} from '../types';
import { computeSchedule, type ScheduleTotals } from './clock';
import { isDecided } from './showGraphics';
import { deliveryStep, isComplete, nextStep } from './steps';
import { blockedCount, derivedWaiting, type WaitingData } from './waiting';

export type NowKind = 'question' | 'award' | 'venue' | 'piece' | 'invitation' | 'checklist';

export interface NowItem {
  key: string;
  kind: NowKind;
  id: string;
  title: string;
  context: string;
  href: string;
  overdue?: boolean;
  dim?: boolean;
}

export interface NowData extends WaitingData {
  segments: WithId<Segment>[];
  invitations: WithId<Invitation>[];
  checklist: WithId<ChecklistItem>[];
  peopleById: ReadonlyMap<string, { name: string }>;
}

export interface NowView {
  clock: ScheduleTotals;
  decide: NowItem[];
  chase: NowItem[];
  make: NowItem[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Whole days from a to b ('YYYY-MM-DD'); positive when b is later. */
export function daysBetween(aIso: string, bIso: string): number {
  return Math.round(dayNumber(bIso) - dayNumber(aIso));
}

/** 'Mon D' from 'YYYY-MM-DD', e.g. 'Nov 6'. No Date timezone shifts. */
function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1] ?? '?'} ${d}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Ascending by date; undated last. */
function byDue(a: IsoDate | undefined, b: IsoDate | undefined): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function dueInfo(due: IsoDate, today: IsoDate): string {
  const d = daysBetween(today, due);
  if (d < 0) return `due ${formatDay(due)} (${plural(-d, 'day', 'days')} overdue)`;
  if (d === 0) return 'due today';
  return `due in ${plural(d, 'day', 'days')}`;
}

export function computeNow(
  season: Pick<Season, 'showStartTime' | 'runtimeCapSec' | 'bufferTargetSec'>,
  data: NowData,
  todayIso: string,
): NowView {
  const clock = computeSchedule(season, data.segments, data.pieces).totals;

  /* ---------- decide ---------- */
  const openQuestions = data.questions
    .filter((q) => q.status === 'open')
    .map((q) => ({ q, blocked: blockedCount({ kind: 'question', id: q.id }, data) }))
    .sort((a, b) => byDue(a.q.dueDate, b.q.dueDate) || b.blocked - a.blocked);

  const decide: NowItem[] = openQuestions.map(({ q, blocked }) => {
    const parts = [q.dueDate ? `Due ${formatDay(q.dueDate)}` : 'No due date'];
    if (blocked > 0) parts.push(`${plural(blocked, 'item waits', 'items wait')} on this`);
    return {
      key: `question:${q.id}`,
      kind: 'question',
      id: q.id,
      title: q.question,
      context: parts.join(' · '),
      href: `/plan/prep?question=${q.id}`,
      overdue: q.dueDate ? q.dueDate < todayIso : undefined,
    };
  });

  const awardItems = data.awards
    .filter((a) => !isDecided(a))
    .map((a) => ({
      a,
      n: data.pieces.filter((p) => {
        const r = derivedWaiting(p, data);
        return r !== null && r.derived && r.kind === 'award' && r.id === a.id;
      }).length,
    }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n);
  for (const { a, n } of awardItems) {
    decide.push({
      key: `award:${a.id}`,
      kind: 'award',
      id: a.id,
      title: a.name,
      context: `${plural(n, 'piece', 'pieces')} waiting on the winner`,
      href: `/plan/make?award=${a.id}`,
    });
  }

  // "No venue" is skipped when an open question already mentions a venue.
  const venueBooked = data.venues.some((v) => v.status === 'booked');
  const venueQuestion = openQuestions.some(({ q }) => /venue/i.test(q.question));
  if (!venueBooked && !venueQuestion) {
    const k = data.venues.filter(
      (v) => v.status === 'researching' || v.status === 'inquired' || v.status === 'holding',
    ).length;
    decide.push({
      key: 'venue:none',
      kind: 'venue',
      id: '',
      title: 'No venue booked',
      context: `${plural(k, 'option', 'options')} under consideration`,
      href: '/plan/prep?view=venues',
    });
  }

  /* ---------- chase ---------- */
  const chase: NowItem[] = [];

  const names = (p: Piece) =>
    p.ownerPersonIds.map((id) => data.peopleById.get(id)?.name ?? 'Unknown').join(' & ');

  const deck = data.pieces
    .filter((p) => {
      if (p.kind !== 'contributor-deck' || !p.dueDate) return false;
      const step = deliveryStep(p);
      return step !== null && step.status !== 'done' && daysBetween(todayIso, p.dueDate) <= 7;
    })
    .sort((a, b) => byDue(a.dueDate, b.dueDate)); // overdue dates sort first naturally
  for (const p of deck) {
    const who = names(p);
    chase.push({
      key: `piece:${p.id}`,
      kind: 'piece',
      id: p.id,
      title: p.title,
      context: `${who ? `${who} · ` : ''}Not submitted yet · ${dueInfo(p.dueDate!, todayIso)}`,
      href: `/plan/make?piece=${p.id}`,
      overdue: p.dueDate! < todayIso,
    });
  }

  const invites = data.invitations
    .filter(
      (i) =>
        i.status === 'invited' &&
        i.invitedAt &&
        daysBetween(i.nudgedAt && i.nudgedAt > i.invitedAt ? i.nudgedAt : i.invitedAt, todayIso) > 14,
    )
    .sort((a, b) => byDue(a.invitedAt, b.invitedAt));
  for (const i of invites) {
    chase.push({
      key: `invitation:${i.id}`,
      kind: 'invitation',
      id: i.id,
      title: data.peopleById.get(i.id)?.name ?? 'Unknown person',
      context: `Invited ${formatDay(i.invitedAt!)}, no reply for ${plural(
        daysBetween(i.invitedAt!, todayIso),
        'day',
        'days',
      )}`,
      href: `/plan/guests?view=waiting&person=${i.id}`,
    });
  }

  // Inquired venues with no logged contact date sort first (most stale).
  const staleVenues = data.venues
    .filter(
      (v) =>
        v.status === 'inquired' &&
        (!v.lastContactDate || daysBetween(v.lastContactDate, todayIso) > 7),
    )
    .sort((a, b) => byDue(a.lastContactDate ?? '0000-00-00', b.lastContactDate ?? '0000-00-00'));
  for (const v of staleVenues) {
    chase.push({
      key: `venue:${v.id}`,
      kind: 'venue',
      id: v.id,
      title: v.name,
      context: v.lastContactDate
        ? `Asked, last contact ${formatDay(v.lastContactDate)} (${plural(
            daysBetween(v.lastContactDate, todayIso),
            'day',
            'days',
          )} ago)`
        : 'Asked · No contact date logged',
      href: `/plan/prep?venue=${v.id}`,
    });
  }

  /* ---------- make ---------- */
  const make: NowItem[] = [];
  const segOrder = new Map(
    [...data.segments]
      .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((s, i) => [s.id, { pos: i, title: s.title }]),
  );
  const pos = (p: Piece) =>
    (p.segmentId ? segOrder.get(p.segmentId)?.pos : undefined) ?? Number.MAX_SAFE_INTEGER;

  const mine = data.pieces.filter((p) => p.ownerPersonIds.length === 0 && !isComplete(p));
  const ready: { p: WithId<Piece> }[] = [];
  const waiting: { p: WithId<Piece>; label: string }[] = [];
  for (const p of mine) {
    const w = derivedWaiting(p, data);
    if (w) waiting.push({ p, label: w.label });
    else ready.push({ p });
  }
  const sorter = (a: { p: WithId<Piece> }, b: { p: WithId<Piece> }) =>
    byDue(a.p.dueDate, b.p.dueDate) || pos(a.p) - pos(b.p);
  const pieceHref = (p: Piece & { id: string }) => `/plan/make?piece=${p.id}`;

  for (const { p } of ready.sort(sorter)) {
    const seg = p.segmentId ? segOrder.get(p.segmentId) : undefined;
    const parts = [`Next: ${nextStep(p)?.label ?? 'Done'}`];
    if (seg) parts.push(seg.title);
    if (p.dueDate) parts.push(`due ${formatDay(p.dueDate)}`);
    make.push({
      key: `piece:${p.id}`,
      kind: 'piece',
      id: p.id,
      title: p.title,
      context: parts.join(' · '),
      href: pieceHref(p),
      overdue: p.dueDate ? p.dueDate < todayIso : undefined,
    });
  }
  for (const { p, label } of waiting.sort(sorter)) {
    make.push({
      key: `piece:${p.id}`,
      kind: 'piece',
      id: p.id,
      title: p.title,
      context: `Waiting on ${label}`,
      href: pieceHref(p),
      dim: true,
    });
  }

  const tasks = data.checklist
    .filter((c) => !c.done && c.dueDate && daysBetween(todayIso, c.dueDate) <= 14)
    .sort((a, b) => byDue(a.dueDate, b.dueDate));
  for (const c of tasks) {
    make.push({
      key: `checklist:${c.id}`,
      kind: 'checklist',
      id: c.id,
      title: c.text,
      context: `${c.area ? `${c.area} · ` : ''}due ${formatDay(c.dueDate!)}`,
      href: `/plan/prep?task=${c.id}`,
      overdue: c.dueDate! < todayIso,
    });
  }

  return { clock, decide, chase, make };
}
