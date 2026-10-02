import { describe, expect, it } from 'vitest';
import type { Invitation, WithId } from '../types';
import { anySent, isSent, needsNudge, reminderMessage, sendProgress, waitingOnReply } from './invites';

const inv = (id: string, over: Partial<Invitation> = {}): WithId<Invitation> => ({
  id, status: 'invite?', plusOnes: 0, brunch: false, rsvpIds: [], ...over,
});

describe('invites', () => {
  it('knows what counts as sent', () => {
    expect(isSent(inv('a'))).toBe(false);
    expect(isSent(inv('a', { status: 'confirmed' }))).toBe(false); // said yes in person, nothing sent
    expect(isSent(inv('a', { status: 'invited' }))).toBe(true);
    expect(isSent(inv('a', { status: 'confirmed', respondedAt: '2027-01-01' }))).toBe(true);
    expect(isSent(inv('a', { invitedAt: '2027-01-01' }))).toBe(true);
  });
  it('counts send progress', () => {
    const list = [inv('a'), inv('b'), inv('c', { status: 'invited' }), inv('d', { status: 'not-inviting' })];
    expect(sendProgress(list)).toEqual({ sent: 1, toSend: 2, total: 3 });
    expect(anySent([inv('a')])).toBe(false);
    expect(anySent(list)).toBe(true);
  });
  it('sorts people waiting on a reply by time since last contact', () => {
    const list = [
      inv('a', { status: 'invited', invitedAt: '2027-01-01' }),
      inv('b', { status: 'invited', invitedAt: '2027-01-01', nudgedAt: '2027-01-20' }),
      inv('c', { status: 'invited' }),
      inv('d', { status: 'confirmed', invitedAt: '2026-12-01' }),
    ];
    const w = waitingOnReply(list, '2027-01-25');
    expect(w.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(w[0]).toMatchObject({ daysWaiting: 24, daysSinceContact: 24 });
    expect(w[1]).toMatchObject({ daysWaiting: 24, daysSinceContact: 5 });
    expect(needsNudge(w[0])).toBe(true);
    expect(needsNudge(w[1])).toBe(false);
    expect(needsNudge(w[2])).toBe(false);
  });
  it('writes a reminder with first name and date', () => {
    const m = reminderMessage('Avery Quill', '2027 Award Sharemony', '2027-02-27', 'https://x.test/#/rsvp');
    expect(m).toContain('Hi Avery!');
    expect(m).toContain('Sat, Feb 27, 2027');
    expect(m).toContain('https://x.test/#/rsvp');
  });
});
