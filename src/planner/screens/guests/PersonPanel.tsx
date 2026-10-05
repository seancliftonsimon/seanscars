import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { createRecord, personDoc, seasonSubDoc, updateRecord, type RecordInput } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { ChipSelect } from '../../components/ui/Chip';
import { Stepper } from '../../components/ui/Stepper';
import { InlineText } from '../../components/ui/InlineText';
import { INVITATION_OPTIONS } from '../../components/status';
import { INVITATION_STATUS_LABEL, INVITE_METHOD_LABEL, INVITE_METHODS } from '../../logic/labels';
import { plural } from '../../logic/dates';
import { errorMessage } from '../../errors';
import { useDoc } from '../../hooks/useDoc';
import { useSeason } from '../../hooks/useSeason';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Invitation, Link } from '../../types';
import './people.css';

interface Props {
  personId: string;
  data: SeasonData;
  onClose: () => void;
}

function SeasonInvitation({ seasonId, label, personId }: { seasonId: string; label: string; personId: string }) {
  const { data: inv, loading } = useDoc(seasonSubDoc(seasonId, 'invitations', personId));
  let text = '—';
  if (loading) text = '…';
  else if (inv) {
    const parts: string[] = [INVITATION_STATUS_LABEL[inv.status]];
    if (inv.plusOnes > 0) parts.push(`+${inv.plusOnes}`);
    if (inv.brunch) parts.push('brunch');
    text = parts.join(', ');
  }
  return (
    <li>
      <b>{label}</b>: {text}
    </li>
  );
}

/** Drawer to edit one person, with their invitations across seasons and pieces. */
export default function PersonPanel({ personId, data, onClose }: Props) {
  const person = data.peopleById.get(personId);
  // Remount the form when the person changes so the draft resets.
  return (
    <aside className="pl-side-panel" aria-label={person ? `Edit ${person.name}` : 'Person'}>
      <header className="pl-side-panel-header">
        <h2>{person?.name ?? 'Person'}</h2>
        <button type="button" className="pl-btn pl-btn-quiet" onClick={onClose}>
          Close
        </button>
      </header>
      {person && <ThisSeason personId={personId} />}
      {person ? <PersonForm key={personId} personId={personId} data={data} /> : <p className="pl-empty">Person not found.</p>}
    </aside>
  );
}

function PersonForm({ personId, data }: { personId: string; data: SeasonData }) {
  const person = data.peopleById.get(personId)!;
  const { seasons } = useSeason();
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email ?? '');
  const [aliases, setAliases] = useState((person.aliases ?? []).join(', '));
  const [notes, setNotes] = useState(person.notes ?? '');
  const [links, setLinks] = useState<Link[]>(person.links ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pieces = data.pieces.filter((p) => p.ownerPersonIds.includes(personId));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give them a name.');
      return;
    }
    setError(null);
    const list = aliases.split(',').map((a) => a.trim()).filter(Boolean);
    const cleanLinks = links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url)
      .map((l) => ({ label: l.label || l.url, url: l.url }));
    setBusy(true);
    setMessage(null);
    try {
      await updateRecord(personDoc(personId), {
        name: name.trim(),
        email: email.trim() || undefined,
        aliases: list.length ? list : undefined,
        notes: notes.trim() || undefined,
        links: cleanLinks.length ? cleanLinks : undefined,
      });
      setMessage('Saved.');
    } catch (err) {
      setMessage(`Couldn't save: ${errorMessage(err)}`);
    }
    setBusy(false);
  }

  const setLink = (i: number, patch: Partial<Link>) =>
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <form className="pl-form pl-people-panel" onSubmit={save} noValidate>
      <label className="pl-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        {error && <small className="pl-error">{error}</small>}
      </label>
      <label className="pl-field">
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="pl-field">
        <span>Aliases</span>
        <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Comma-separated" />
      </label>
      <label className="pl-field">
        <span>Notes</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <fieldset className="pl-field">
        <legend>Links</legend>
        {links.map((l, i) => (
          <div key={i} className="pl-people-link-row">
            <input value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Label" aria-label={`Link ${i + 1} label`} />
            <input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://" aria-label={`Link ${i + 1} URL`} />
            {l.url.trim() && (
              <a href={l.url.trim()} target="_blank" rel="noreferrer">
                Open
              </a>
            )}
            <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={`Remove link ${i + 1}`}>
              Remove
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="pl-btn" onClick={() => setLinks([...links, { label: '', url: '' }])}>
            Add link
          </button>
        </div>
      </fieldset>
      <div className="pl-form-actions">
        <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="pl-form-message">{message}</span>}
      </div>

      <section>
        <h3 className="pl-people-subhead">Every season</h3>
        <ul className="pl-people-list">
          {seasons.map((s) => (
            <SeasonInvitation key={s.id} seasonId={s.id} label={String(s.year)} personId={personId} />
          ))}
        </ul>
      </section>
      <section>
        <h3 className="pl-people-subhead">Pieces</h3>
        {pieces.length === 0 ? (
          <p className="pl-muted">None this season.</p>
        ) : (
          <ul className="pl-people-list">
            {pieces.map((p) => (
              <li key={p.id}>
                <RouterLink to={`/plan/make?piece=${encodeURIComponent(p.id)}`}>{p.title}</RouterLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}

/** This season's invitation, edited in place (each change has Undo). */
function ThisSeason({ personId }: { personId: string }) {
  const { season, data } = usePlanner();
  const update = useUndoableUpdate();
  if (!season) return null;
  const inv = data.invitations.find((i) => i.id === personId);
  const name = data.peopleById.get(personId)?.name ?? 'them';
  const ref = seasonSubDoc(season.id, 'invitations', personId);

  if (!inv) {
    return (
      <section className="pl-person-season">
        <h3 className="pl-people-subhead">{season.year}</h3>
        <p className="pl-muted">Not on this year’s list.</p>
        <button type="button" className="pl-btn pl-btn-sm" onClick={() => void createRecord(ref, { status: 'invite?', plusOnes: 0, brunch: false, rsvpIds: [] })}>
          Put on the list
        </button>
      </section>
    );
  }
  const set = (patch: Partial<RecordInput<Invitation>>, msg: string) => void update(ref, inv, patch, `${name}: ${msg}`);
  return (
    <section className="pl-person-season" aria-label={`${season.year} invitation`}>
      <h3 className="pl-people-subhead">{season.year}</h3>
      <dl className="pl-props">
        <dt>Status</dt>
        <dd>
          <ChipSelect value={inv.status} options={INVITATION_OPTIONS} label="Status" onChange={(status) => set({ status }, INVITATION_STATUS_LABEL[status])} />
        </dd>
        <dt>Plus-ones</dt>
        <dd>
          <Stepper value={inv.plusOnes} label="Plus-ones" onChange={(plusOnes) => set({ plusOnes }, plural(plusOnes, 'plus-one'))} />
        </dd>
        <dt>Brunch</dt>
        <dd>
          <button type="button" className="pl-toggle" aria-pressed={inv.brunch} onClick={() => set({ brunch: !inv.brunch }, inv.brunch ? 'no brunch' : 'brunch')}>
            <Coffee size={12} aria-hidden /> {inv.brunch ? 'Coming to brunch' : 'No brunch'}
          </button>
        </dd>
        <dt>Invited by</dt>
        <dd>
          <span className="pl-seg-ctl" role="group" aria-label="Invited by">
            {INVITE_METHODS.map((m) => (
              <button key={m} type="button" aria-pressed={inv.method === m} onClick={() => set({ method: inv.method === m ? undefined : m }, INVITE_METHOD_LABEL[m])}>
                {INVITE_METHOD_LABEL[m]}
              </button>
            ))}
          </span>
        </dd>
        <dt>Sent</dt>
        <dd>
          <input type="date" className="pl-date-inline" value={inv.invitedAt ?? ''} aria-label="Invitation sent on" onChange={(e) => set({ invitedAt: e.target.value || undefined }, 'sent date')} />
        </dd>
        {inv.nudgedAt && (
          <>
            <dt>Last nudged</dt>
            <dd>{inv.nudgedAt}</dd>
          </>
        )}
        <dt>Notes</dt>
        <dd>
          <InlineText value={inv.notes ?? ''} label="Invitation notes" onSave={(notes) => set({ notes: notes || undefined }, 'notes saved')} placeholder="Add a note…" />
        </dd>
      </dl>
    </section>
  );
}
