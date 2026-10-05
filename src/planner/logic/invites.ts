import type { Invitation, InviteMethod, IsoDate, WithId } from '../types';
import { daysBetween, formatLongDay } from './dates';

/*
 * Invitation workflow: what has gone out, what is ready to send, and who
 * hasn't replied.
 */

/** An invitation counts as sent once it has a sent date, is "invited", or has a reply. */
export function isSent(inv: Pick<Invitation, 'status' | 'invitedAt' | 'respondedAt'>): boolean {
  return Boolean(inv.invitedAt) || inv.status === 'invited' || Boolean(inv.respondedAt);
}

export interface SendProgress {
  sent: number;
  /** On the list ("invite?") and not sent yet. */
  toSend: number;
  /** sent + toSend */
  total: number;
}

export function sendProgress(invs: Pick<Invitation, 'status' | 'invitedAt' | 'respondedAt'>[]): SendProgress {
  let sent = 0;
  let toSend = 0;
  for (const i of invs) {
    if (isSent(i)) sent += 1;
    else if (i.status === 'invite?') toSend += 1;
  }
  return { sent, toSend, total: sent + toSend };
}

export function anySent(invs: Pick<Invitation, 'status' | 'invitedAt' | 'respondedAt'>[]): boolean {
  return invs.some(isSent);
}

export interface WaitingGuest {
  id: string;
  invitedAt?: IsoDate;
  nudgedAt?: IsoDate;
  method?: InviteMethod;
  /** Days since the invitation (or null when no date was logged). */
  daysWaiting: number | null;
  /** Days since the last contact: the later of sent and nudged. */
  daysSinceContact: number | null;
}

/** Invited, no reply yet; longest since last contact first, undated last. */
export function waitingOnReply(invs: WithId<Invitation>[], today: IsoDate): WaitingGuest[] {
  return invs
    .filter((i) => i.status === 'invited')
    .map((i) => {
      const last = [i.invitedAt, i.nudgedAt].filter(Boolean).sort().pop();
      return {
        id: i.id,
        invitedAt: i.invitedAt,
        nudgedAt: i.nudgedAt,
        method: i.method,
        daysWaiting: i.invitedAt ? daysBetween(i.invitedAt, today) : null,
        daysSinceContact: last ? daysBetween(last, today) : null,
      };
    })
    .sort((a, b) => (b.daysSinceContact ?? -1) - (a.daysSinceContact ?? -1) || a.id.localeCompare(b.id));
}

/** Waiting long enough to deserve a nudge (two weeks since last contact). */
export const NUDGE_AFTER_DAYS = 14;

export function needsNudge(w: WaitingGuest): boolean {
  return w.daysSinceContact !== null && w.daysSinceContact >= NUDGE_AFTER_DAYS;
}

/** A short, friendly reminder Sean can paste into a text or email. */
export function reminderMessage(name: string, showName: string, showDate: IsoDate | undefined, rsvpUrl: string): string {
  const first = name.trim().split(/\s+/)[0] || 'there';
  const when = showDate ? ` on ${formatLongDay(showDate)}` : '';
  return `Hi ${first}! Just checking whether you can make the ${showName}${when}. You can RSVP here: ${rsvpUrl} — no pressure, a quick yes, maybe or no helps me plan. Thanks!`;
}
