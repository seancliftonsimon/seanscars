import { useMemo, useState, type FormEvent } from 'react';
import { createRecord, peopleCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { presentingIds } from '../../logic/headcount';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Invitation, InvitationStatus, InviteMethod } from '../../types';
import './people.css';

interface Props {
  seasonId: string;
  data: SeasonData;
  onOpenPerson: (personId: string) => void;
}

const STATUSES: InvitationStatus[] = ['invite?', 'invited', 'confirmed', 'maybe', 'declined', 'not-inviting'];
const STATUS_ORDER: InvitationStatus[] = ['confirmed', 'maybe', 'invited', 'invite?', 'declined', 'not-inviting'];
const METHODS: InviteMethod[] = ['text', 'mail', 'hand', 'email'];

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const NEW_INVITATION = { status: 'invite?', plusOnes: 0, brunch: false, rsvpIds: [] } as const;

/** Guest list for one season: one row per invited person. */
export default function GuestsTab({ seasonId, data, onOpenPerson }: Props) {
  const [showEveryone, setShowEveryone] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvitationStatus>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const invById = useMemo(() => new Map(data.invitations.map((i) => [i.id, i])), [data.invitations]);
  const presenting = useMemo(() => presentingIds(data.pieces), [data.pieces]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (s?: InvitationStatus) => (s ? STATUS_ORDER.indexOf(s) : STATUS_ORDER.length);
    return data.people
      .map((person) => ({ person, inv: invById.get(person.id) }))
      .filter(({ person, inv }) => {
        if (!inv && !showEveryone) return false;
        if (statusFilter !== 'all' && inv?.status !== statusFilter) return false;
        if (!q) return true;
        return [person.name, person.email ?? '', ...(person.aliases ?? [])].some((s) => s.toLowerCase().includes(q));
      })
      .sort((a, b) => rank(a.inv?.status) - rank(b.inv?.status) || a.person.name.localeCompare(b.person.name));
  }, [data.people, invById, showEveryone, statusFilter, search]);

  async function run(action: () => Promise<void>, failure: string) {
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage(`${failure}: ${errorMessage(err)}`);
    }
  }

  const patch = (personId: string, fields: Partial<Omit<Invitation, 'id'>>) =>
    run(() => updateRecord(seasonSubDoc(seasonId, 'invitations', personId), fields), "Couldn't save");

  const invite = (personId: string) =>
    run(() => createRecord(seasonSubDoc(seasonId, 'invitations', personId), { ...NEW_INVITATION, rsvpIds: [] }).then(() => undefined), "Couldn't invite");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function markInvited() {
    const today = todayIso();
    const ids = rows.filter((r) => r.inv && selected.has(r.person.id)).map((r) => r.person.id);
    setBusy(true);
    await run(async () => {
      await Promise.all(ids.map((id) => updateRecord(seasonSubDoc(seasonId, 'invitations', id), { status: 'invited', invitedAt: today })));
      setSelected(new Set());
    }, "Couldn't update");
    setBusy(false);
  }

  async function addPerson(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    await run(async () => {
      const id = await createRecord(peopleCol(), { name });
      await createRecord(seasonSubDoc(seasonId, 'invitations', id), { ...NEW_INVITATION, rsvpIds: [] });
      setNewName('');
    }, "Couldn't add");
    setBusy(false);
  }

  const selectedCount = rows.filter((r) => r.inv && selected.has(r.person.id)).length;

  return (
    <div className="pl-people-guests">
      <div className="pl-people-toolbar">
        <input
          type="search"
          placeholder="Search name, alias, email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search guests"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | InvitationStatus)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="pl-check">
          <input type="checkbox" checked={showEveryone} onChange={(e) => setShowEveryone(e.target.checked)} />
          <span>Show everyone</span>
        </label>
      </div>

      <form className="pl-people-add" onSubmit={addPerson}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add person (name)" aria-label="New person name" />
        <button type="submit" className="pl-btn" disabled={busy || !newName.trim()}>
          Add person
        </button>
      </form>

      {selectedCount > 0 && (
        <div className="pl-people-bulk">
          <span>{selectedCount} selected</span>
          <button type="button" className="pl-btn" onClick={() => void markInvited()} disabled={busy}>
            Mark invited today
          </button>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      {message && <p className="pl-error">{message}</p>}

      {rows.length === 0 ? (
        <p className="pl-empty">No guests match.</p>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table pl-people-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Name</th>
                <th>Status</th>
                <th>+1</th>
                <th>Brunch</th>
                <th>Method</th>
                <th>Invited</th>
                <th>Presenting</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, inv }) => (
                <tr key={person.id} className={selected.has(person.id) ? 'is-selected' : undefined}>
                  <td>
                    {inv && (
                      <input
                        type="checkbox"
                        checked={selected.has(person.id)}
                        onChange={() => toggle(person.id)}
                        aria-label={`Select ${person.name}`}
                      />
                    )}
                  </td>
                  <td>
                    <button type="button" className="pl-link-btn pl-people-name" onClick={() => onOpenPerson(person.id)}>
                      {person.name}
                    </button>
                  </td>
                  {inv ? (
                    <>
                      <td>
                        <select
                          value={inv.status}
                          onChange={(e) => void patch(person.id, { status: e.target.value as InvitationStatus })}
                          aria-label={`Status for ${person.name}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          key={inv.plusOnes}
                          type="number"
                          min={0}
                          className="pl-people-plus"
                          defaultValue={inv.plusOnes}
                          onBlur={(e) => {
                            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            e.target.value = String(n);
                            if (n !== inv.plusOnes) void patch(person.id, { plusOnes: n });
                          }}
                          aria-label={`Plus-ones for ${person.name}`}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={inv.brunch}
                          onChange={(e) => void patch(person.id, { brunch: e.target.checked })}
                          aria-label={`Brunch for ${person.name}`}
                        />
                      </td>
                      <td>
                        <select
                          value={inv.method ?? ''}
                          onChange={(e) => void patch(person.id, { method: (e.target.value || undefined) as InviteMethod | undefined })}
                          aria-label={`Method for ${person.name}`}
                        >
                          <option value="">—</option>
                          {METHODS.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          value={inv.invitedAt ?? ''}
                          onChange={(e) => void patch(person.id, { invitedAt: e.target.value || undefined })}
                          aria-label={`Invited date for ${person.name}`}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <span className="pl-muted">—</span>{' '}
                        <button type="button" className="pl-btn" onClick={() => void invite(person.id)}>
                          Invite?
                        </button>
                      </td>
                      <td colSpan={4} />
                    </>
                  )}
                  <td>{presenting.has(person.id) && <span className="pl-tag">yes</span>}</td>
                  <td className="pl-muted pl-people-notes" title={inv?.notes}>
                    {inv?.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
