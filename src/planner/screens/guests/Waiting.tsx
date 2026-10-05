import { Clock, Copy, MessageCircle, PartyPopper } from 'lucide-react';
import { seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import type { Derived } from '../../hooks/useDerived';
import { Chip, ChipSelect } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { INVITATION_OPTIONS } from '../../components/status';
import { formatDay, plural } from '../../logic/dates';
import { INVITATION_STATUS_LABEL, INVITE_METHOD_LABEL } from '../../logic/labels';
import { needsNudge, reminderMessage } from '../../logic/invites';

function rsvpUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/rsvp`;
}

/** Invited, no reply: longest silence first, with a one-tap nudge and a ready message. */
export default function Waiting({ derived, onOpenPerson, highlight }: { derived: Derived; onOpenPerson: (id: string) => void; highlight: string | null }) {
  const { season, data, today } = usePlanner();
  const { logNudge } = useActions();
  const update = useUndoableUpdate();
  const toast = useToast();
  if (!season) return null;
  const { waiting } = derived;

  if (waiting.length === 0) {
    return (
      <EmptyState icon={PartyPopper} title="No one to chase">
        {derived.send.sent ? 'Everyone you’ve invited has answered.' : 'Once invitations are out, anyone who hasn’t replied shows up here, longest silence first.'}
      </EmptyState>
    );
  }

  async function copy(name: string) {
    const text = reminderMessage(name, season!.name, season!.showDate, rsvpUrl());
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `Reminder for ${name.split(' ')[0]} copied` });
    } catch {
      window.prompt('Copy this reminder:', text);
    }
  }

  const overdue = waiting.filter(needsNudge).length;

  return (
    <div className="pl-stack">
      <p className="pl-muted">
        {plural(waiting.length, 'guest')} haven’t replied{overdue ? `; ${overdue} for two weeks or more` : ''}. Copy a reminder, send it your usual way, then log the nudge.
      </p>
      <ul className="pl-list" aria-label="Waiting on replies">
        {waiting.map((w) => {
          const person = data.peopleById.get(w.id);
          const inv = data.invitations.find((i) => i.id === w.id);
          if (!person || !inv) return null;
          const old = needsNudge(w);
          return (
            <li key={w.id}>
              <div className={`pl-list-row${highlight === w.id ? ' is-highlight' : ''}`}>
                <div className="pl-list-main">
                  <button type="button" className="pl-list-title" onClick={() => onOpenPerson(w.id)}>
                    {person.name}
                  </button>
                  <span className="pl-list-meta">
                    {w.daysWaiting !== null ? (
                      <Chip tone={old ? 'warn' : 'faint'} icon={Clock}>
                        {plural(w.daysWaiting, 'day')}
                      </Chip>
                    ) : (
                      <span>No sent date</span>
                    )}
                    {w.method && <span>{INVITE_METHOD_LABEL[w.method]}</span>}
                    {w.invitedAt && <span>sent {formatDay(w.invitedAt)}</span>}
                    {w.nudgedAt && <span>nudged {formatDay(w.nudgedAt)}</span>}
                  </span>
                </div>
                <div className="pl-list-actions">
                  <button type="button" className="pl-btn pl-btn-sm" onClick={() => void copy(person.name)}>
                    <Copy size={14} aria-hidden /> Copy reminder
                  </button>
                  <button type="button" className="pl-btn pl-btn-sm" onClick={() => void logNudge(inv, person.name)}>
                    <MessageCircle size={14} aria-hidden /> Log nudge
                  </button>
                  <ChipSelect
                    value={inv.status}
                    options={INVITATION_OPTIONS}
                    label={`Answer for ${person.name}`}
                    onChange={(status) =>
                      void update(seasonSubDoc(season.id, 'invitations', inv.id), inv, { status, respondedAt: status === 'invited' ? inv.respondedAt : (inv.respondedAt ?? today) }, `${person.name}: ${INVITATION_STATUS_LABEL[status]}`)
                    }
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
