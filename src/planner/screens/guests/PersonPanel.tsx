import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { personDoc, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { useDoc } from '../../hooks/useDoc';
import { useSeason } from '../../hooks/useSeason';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Link } from '../../types';
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
    const parts: string[] = [inv.status];
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
        <h3 className="pl-people-subhead">Invitations</h3>
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
                <RouterLink to={`/plan/awards?tab=pieces&piece=${encodeURIComponent(p.id)}`}>{p.title}</RouterLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}
