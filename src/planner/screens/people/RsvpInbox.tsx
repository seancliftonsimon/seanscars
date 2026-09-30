import { useSeason } from '../../hooks/useSeason';
import { useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import {
  createRecord,
  peopleCol,
  personDoc,
  rsvpDoc,
  seasonCol,
  seasonSubDoc,
  updateRecord,
} from '../../firestore';
import { errorMessage } from '../../errors';
import { nextOrder } from '../../logic/records';
import {
  applyRsvpToInvitation,
  contributorPieceFromRsvp,
  emailToSave,
  matchRsvp,
  rsvpBrunch,
  rsvpFullName,
  statusFromRsvp,
} from '../../logic/rsvp';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Rsvp, WithId } from '../../types';

const NEW_PERSON = '__new__';

/** Local 'YYYY-MM-DD' (no UTC shift). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function when(ts: Timestamp | null): string {
  return ts ? ts.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
}

interface CardProps {
  seasonId: string;
  rsvp: WithId<Rsvp>;
  data: SeasonData;
  onOpenPerson: (personId: string) => void;
}

/** One RSVP: suggested match, plus-ones, optional contributor piece, then apply or ignore. */
function RsvpCard({ seasonId, rsvp, data, onOpenPerson }: CardProps) {
  const { season } = useSeason();
  const match = matchRsvp(rsvp, data.people);
  const name = rsvpFullName(rsvp);
  const status = statusFromRsvp(rsvp.rsvp);
  const [choice, setChoice] = useState(match?.personId ?? NEW_PERSON);
  const current = choice !== NEW_PERSON ? data.invitations.find((i) => i.id === choice) : undefined;
  const [plusOnes, setPlusOnes] = useState<string>('');
  const presenting = rsvp.attendanceType === 'present';
  const [makePiece, setMakePiece] = useState(presenting);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setMessage(null);
    try {
      let personId = choice;
      if (personId === NEW_PERSON) {
        personId = await createRecord(peopleCol(), { name, email: rsvp.email.trim() || undefined });
      } else {
        const person = data.peopleById.get(personId);
        const email = person ? emailToSave(person, rsvp) : undefined;
        if (email) await updateRecord(personDoc(personId), { email });
      }

      const existing = data.invitations.find((i) => i.id === personId) ?? null;
      const next = applyRsvpToInvitation(existing, rsvp, rsvp.id, todayIso());
      const plus = plusOnes.trim() === '' ? undefined : Number(plusOnes);
      const invitation = plus !== undefined && Number.isInteger(plus) && plus >= 0 ? { ...next, plusOnes: plus } : next;
      const invitationRef = seasonSubDoc(seasonId, 'invitations', personId);
      if (existing) await updateRecord(invitationRef, invitation);
      else await createRecord(invitationRef, invitation);

      if (presenting && makePiece) {
        await createRecord(
          seasonCol(seasonId, 'pieces'),
          contributorPieceFromRsvp(rsvp, personId, nextOrder(data.pieces), todayIso(), season?.pieceTemplates),
        );
      }
      await updateRecord(rsvpDoc(rsvp.id), { processed: true, matchedPersonId: personId });
    } catch (err) {
      setMessage(`Couldn't apply: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  async function ignore() {
    setBusy(true);
    try {
      await updateRecord(rsvpDoc(rsvp.id), { processed: true });
    } catch (err) {
      setMessage(`Couldn't ignore: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  return (
    <article className="pl-panel pl-people-rsvp">
      <header className="pl-people-rsvp-head">
        <strong>{name || 'No name'}</strong>
        <span className={status === 'declined' ? 'pl-tag' : 'pl-tag pl-tag-switch'}>{status ?? rsvp.rsvp ?? 'no answer'}</span>
        {rsvpBrunch(rsvp.brunch) && <span className="pl-tag">brunch</span>}
        {presenting && <span className="pl-tag">presenting</span>}
        <span className="pl-muted pl-people-rsvp-when">{when(rsvp.createdAt)}</span>
      </header>
      <p className="pl-muted">
        {rsvp.email || 'no email'}
        {presenting && rsvp.awardName ? ` · awards: “${rsvp.awardName}”` : ''}
      </p>
      {rsvp.guestsComment && <blockquote className="pl-people-rsvp-comment">{rsvp.guestsComment}</blockquote>}

      <div className="pl-people-rsvp-actions">
        <label className="pl-field">
          <span>
            Person{' '}
            {match && choice === match.personId && <em className="pl-muted">(matched by {match.reason})</em>}
          </span>
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
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={plusOnes}
            placeholder={String(current?.plusOnes ?? 0)}
            onChange={(e) => setPlusOnes(e.target.value)}
            disabled={busy}
          />
        </label>
        {presenting && (
          <label className="pl-check">
            <input type="checkbox" checked={makePiece} onChange={(e) => setMakePiece(e.target.checked)} disabled={busy} />
            <span>Create contributor piece “{rsvp.awardName?.trim() || 'Untitled awards'}”</span>
          </label>
        )}
      </div>
      {current && (
        <p className="pl-muted">
          Currently {current.status}
          {current.plusOnes ? `, +${current.plusOnes}` : ''}.{' '}
          <button type="button" className="pl-link-btn" onClick={() => onOpenPerson(choice)}>
            Open person
          </button>
        </p>
      )}
      <div className="pl-form-actions">
        <button type="button" className="pl-btn pl-btn-primary" onClick={apply} disabled={busy}>
          {busy ? 'Applying…' : status ? `Apply: ${status}` : 'Apply'}
        </button>
        <button type="button" className="pl-btn" onClick={ignore} disabled={busy}>
          Ignore
        </button>
        {message && <span className="pl-error">{message}</span>}
      </div>
    </article>
  );
}

interface Props {
  seasonId: string;
  data: SeasonData;
  /** Unprocessed RSVPs, newest first. */
  rsvps: WithId<Rsvp>[];
  onOpenPerson: (personId: string) => void;
}

/** RSVPs from the site that haven't been filed yet. */
export default function RsvpInbox({ seasonId, data, rsvps, onOpenPerson }: Props) {
  if (rsvps.length === 0) {
    return <p className="pl-empty">No new RSVPs. Replies from the site's RSVP form land here.</p>;
  }
  return (
    <div className="pl-people-inbox">
      {rsvps.map((r) => (
        <RsvpCard key={r.id} seasonId={seasonId} rsvp={r} data={data} onOpenPerson={onOpenPerson} />
      ))}
    </div>
  );
}
