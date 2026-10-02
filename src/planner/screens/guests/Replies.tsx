import { useState } from 'react';
import { Coffee, Inbox, Mic, PartyPopper } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { createRecord, deleteRecord, peopleCol, personDoc, rsvpDoc, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useToast } from '../../components/ui/toastContext';
import { errorMessage } from '../../errors';
import { Chip } from '../../components/ui/Chip';
import { EmptyState, Skeleton } from '../../components/ui/Basics';
import { invitationChip } from '../../components/status';
import { nextOrder } from '../../logic/records';
import { INVITATION_STATUS_LABEL } from '../../logic/labels';
import { applyRsvpToInvitation, contributorPieceFromRsvp, emailToSave, matchRsvp, rsvpBrunch, rsvpFullName, statusFromRsvp } from '../../logic/rsvp';
import type { Rsvp, WithId } from '../../types';

const NEW_PERSON = '__new__';

function when(ts: Timestamp | null): string {
  return ts ? ts.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'just now';
}

/** One RSVP: who it is, what they said, and one tap to file it. */
function ReplyCard({ rsvp, onOpenPerson }: { rsvp: WithId<Rsvp>; onOpenPerson: (id: string) => void }) {
  const { season, data, today } = usePlanner();
  const toast = useToast();
  const match = matchRsvp(rsvp, data.people);
  const name = rsvpFullName(rsvp);
  const status = statusFromRsvp(rsvp.rsvp);
  const [choice, setChoice] = useState(match?.personId ?? NEW_PERSON);
  const [plusOnes, setPlusOnes] = useState('');
  const presenting = rsvp.attendanceType === 'present';
  const [makePiece, setMakePiece] = useState(presenting);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!match);
  if (!season) return null;
  const sid = season.id;
  const current = choice !== NEW_PERSON ? data.invitations.find((i) => i.id === choice) : undefined;
  const chosenName = choice === NEW_PERSON ? `${name || 'Unnamed'} (new)` : data.peopleById.get(choice)?.name;
  const chip = status ? invitationChip(status) : null;

  async function apply() {
    setBusy(true);
    try {
      let personId = choice;
      const createdPerson = personId === NEW_PERSON;
      let pieceId: string | null = null;
      if (createdPerson) {
        personId = await createRecord(peopleCol(), { name, email: rsvp.email.trim() || undefined });
      } else {
        const person = data.peopleById.get(personId);
        const email = person ? emailToSave(person, rsvp) : undefined;
        if (email) await updateRecord(personDoc(personId), { email });
      }
      const existing = data.invitations.find((i) => i.id === personId) ?? null;
      const next = applyRsvpToInvitation(existing, rsvp, rsvp.id, today);
      const plus = plusOnes.trim() === '' ? undefined : Number(plusOnes);
      const invitation = plus !== undefined && Number.isInteger(plus) && plus >= 0 ? { ...next, plusOnes: plus } : next;
      const ref = seasonSubDoc(sid, 'invitations', personId);
      if (existing) await updateRecord(ref, invitation);
      else await createRecord(ref, invitation);
      if (presenting && makePiece) {
        pieceId = await createRecord(seasonCol(sid, 'pieces'), contributorPieceFromRsvp(rsvp, personId, nextOrder(data.pieces), today));
      }
      await updateRecord(rsvpDoc(rsvp.id), { processed: true, matchedPersonId: personId });
      const who = data.peopleById.get(personId)?.name ?? name;
      toast({
        message: `Filed: ${who} — ${status ? INVITATION_STATUS_LABEL[status] : 'reply saved'}`,
        // Undo puts the RSVP back in the inbox and the invitation back as it was.
        undo: async () => {
          if (existing) {
            await updateRecord(ref, {
              status: existing.status,
              plusOnes: existing.plusOnes,
              brunch: existing.brunch,
              respondedAt: existing.respondedAt,
              rsvpIds: existing.rsvpIds ?? [],
            });
          } else {
            await deleteRecord(ref);
          }
          if (createdPerson) await deleteRecord(personDoc(personId));
          if (pieceId) await deleteRecord(seasonSubDoc(sid, 'pieces', pieceId));
          await updateRecord(rsvpDoc(rsvp.id), { processed: false, matchedPersonId: undefined });
        },
      });
    } catch (err) {
      toast({ message: `Couldn’t file it: ${errorMessage(err)}`, tone: 'danger' });
      setBusy(false);
    }
  }

  async function ignore() {
    setBusy(true);
    try {
      await updateRecord(rsvpDoc(rsvp.id), { processed: true });
      toast({ message: 'Ignored', undo: () => updateRecord(rsvpDoc(rsvp.id), { processed: false }) });
    } catch (err) {
      toast({ message: `Couldn’t ignore: ${errorMessage(err)}`, tone: 'danger' });
      setBusy(false);
    }
  }

  return (
    <article className="pl-card pl-reply">
      <header className="pl-row is-between">
        <div className="pl-row">
          <strong className="pl-reply-name">{name || 'No name'}</strong>
          {chip ? <Chip tone={chip.tone} icon={chip.icon}>{chip.label}</Chip> : <Chip tone="faint">{rsvp.rsvp || 'No answer'}</Chip>}
          {rsvpBrunch(rsvp.brunch) && <Chip tone="accent" icon={Coffee}>Brunch</Chip>}
          {presenting && <Chip tone="info" icon={Mic}>Presenting</Chip>}
        </div>
        <span className="pl-small pl-faint">{when(rsvp.createdAt)}</span>
      </header>
      <p className="pl-small pl-muted">
        {rsvp.email || 'No email'}
        {presenting && rsvp.awardName ? ` · wants to present “${rsvp.awardName}”` : ''}
      </p>
      {rsvp.guestsComment && <blockquote className="pl-reply-comment">{rsvp.guestsComment}</blockquote>}

      {editing ? (
        <div className="pl-reply-edit">
          <label className="pl-field">
            <span>File under</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={busy}>
              <option value={NEW_PERSON}>New person: {name || 'unnamed'}</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pl-field pl-field-narrow">
            <span>Plus-ones</span>
            <input type="number" min={0} inputMode="numeric" value={plusOnes} placeholder={String(current?.plusOnes ?? 0)} onChange={(e) => setPlusOnes(e.target.value)} disabled={busy} />
          </label>
          {presenting && (
            <label className="pl-check">
              <input type="checkbox" checked={makePiece} onChange={(e) => setMakePiece(e.target.checked)} disabled={busy} />
              <span>Start a guest presentation “{rsvp.awardName?.trim() || 'Untitled awards'}”</span>
            </label>
          )}
        </div>
      ) : (
        <p className="pl-reply-match">
          Matches{' '}
          <button type="button" className="pl-link-btn" onClick={() => onOpenPerson(choice)}>
            {chosenName}
          </button>{' '}
          <span className="pl-faint">(same {match?.reason})</span>
          {current && <span className="pl-faint"> · now {INVITATION_STATUS_LABEL[current.status]}{current.plusOnes ? `, +${current.plusOnes}` : ''}</span>}
          {presenting && makePiece && <span className="pl-faint"> · will start their presentation</span>}
        </p>
      )}

      <div className="pl-row">
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void apply()} disabled={busy}>
          {busy ? 'Filing…' : `File as ${status ? INVITATION_STATUS_LABEL[status] : 'reply'}`}
        </button>
        {!editing && (
          <button type="button" className="pl-btn" onClick={() => setEditing(true)} disabled={busy}>
            Change…
          </button>
        )}
        <button type="button" className="pl-btn pl-btn-quiet" onClick={() => void ignore()} disabled={busy}>
          Ignore
        </button>
      </div>
    </article>
  );
}

export default function Replies({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const { inbox, inboxLoading } = usePlanner();
  if (inboxLoading) return <Skeleton rows={3} label="Loading RSVPs" />;
  if (inbox.length === 0) {
    return (
      <EmptyState icon={PartyPopper} title="All caught up">
        No new RSVPs. Replies from the site’s RSVP form land here; filing one updates the guest list and the headcount.
      </EmptyState>
    );
  }
  return (
    <div className="pl-stack">
      <p className="pl-muted pl-small">
        <Inbox size={14} aria-hidden /> {inbox.length} new. Most match someone on your list; check the name, then file.
      </p>
      {inbox.map((r) => (
        <ReplyCard key={r.id} rsvp={r} onOpenPerson={onOpenPerson} />
      ))}
    </div>
  );
}
