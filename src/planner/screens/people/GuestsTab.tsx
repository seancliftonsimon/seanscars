import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUp, MoreHorizontal, Filter, Plus } from 'lucide-react';
import { wasInvited, INVITATION_LABELS } from '../../logic/guestOverview';
import { createRecord, peopleCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { presentingIds } from '../../logic/headcount';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Invitation, InvitationStatus, InviteMethod } from '../../types';
import './people.css';

interface Props {
  seasonId: string;
  data: SeasonData;
  search: string;
  adding: boolean;
  onCloseAdd: () => void;
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
export default function GuestsTab({ seasonId, data, onOpenPerson, search, adding, onCloseAdd }: Props) {
  const [showEveryone, setShowEveryone] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [sort, setSort] = useState('name');
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
        if (quickFilter === 'sent' && (!inv || !wasInvited(inv))) return false;
        if (quickFilter === 'presenting' && !presenting.has(person.id)) return false;
        if (quickFilter === 'brunch' && !inv?.brunch) return false;
        if (['confirmed', 'declined', 'invited', 'invite?'].includes(quickFilter) && inv?.status !== quickFilter) return false;
        if (!q) return true;
        return [person.name, person.email ?? '', ...(person.aliases ?? [])].some((s) => s.toLowerCase().includes(q));
      })
      .sort((a, b) => (sort === 'status' ? rank(a.inv?.status) - rank(b.inv?.status) : 0) || (sort === 'name-desc' ? -1 : 1) * a.person.name.localeCompare(b.person.name));
  }, [data.people, invById, showEveryone, statusFilter, search, quickFilter, sort, presenting]);

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
      onCloseAdd();
    }, "Couldn't add");
    setBusy(false);
  }

  const selectedCount = rows.filter((r) => r.inv && selected.has(r.person.id)).length;

  return (
    <div className="pl-people-guests">
      <div className="pl-people-toolbar">
        <div className="pl-filter-chips" aria-label="Guest views">
          {[['all', 'All guests'], ['sent', 'Invited'], ['confirmed', 'Confirmed'], ['declined', 'Declined'], ['invited', 'No response'], ['invite?', 'Not invited'], ['presenting', 'Presenting'], ['brunch', 'Brunch']].map(([value, label]) =>
            <button key={value} type="button" className={`pl-filter-chip${quickFilter === value ? ' is-active' : ''}`} aria-pressed={quickFilter === value} onClick={() => setQuickFilter(value)}>{label}</button>)}
        </div>
        <details className="pl-more-filters"><summary><Filter size={16} aria-hidden="true" />More filters{statusFilter !== 'all' || showEveryone ? ' •' : ''}</summary><div className="pl-filter-popover">
          <label className="pl-field"><span>Invitation status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | InvitationStatus)}><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{INVITATION_LABELS[s]}</option>)}</select></label>
          <label className="pl-check"><input type="checkbox" checked={showEveryone} onChange={(e) => setShowEveryone(e.target.checked)} /><span>Include people outside this season</span></label>
        </div></details>
        <label className="pl-sort-field"><span>Sort:</span><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort guests"><option value="name">Name A → Z</option><option value="name-desc">Name Z → A</option><option value="status">Status</option></select></label>
      </div>
      {adding && <form className="pl-people-add pl-panel" onSubmit={addPerson}>
        <label className="pl-field pl-grow"><span>New guest’s name</span><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" aria-label="New person name" autoFocus /></label>
        <button type="submit" className="pl-btn pl-btn-primary" disabled={busy || !newName.trim()}><Plus size={16} aria-hidden="true" />{busy ? 'Adding…' : 'Add to guest list'}</button>
        <button type="button" className="pl-btn pl-btn-quiet" onClick={onCloseAdd} disabled={busy}>Cancel</button>
      </form>}

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
        <p className="pl-empty">No guests match this view. Try All guests or clear the search.</p>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table pl-people-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible guests" checked={rows.some((r) => r.inv) && rows.filter((r) => r.inv).every((r) => selected.has(r.person.id))} onChange={(e) => { const next = new Set(selected); rows.filter((r) => r.inv).forEach((r) => e.target.checked ? next.add(r.person.id) : next.delete(r.person.id)); setSelected(next); }} /></th>
                <th>Name {sort === 'name' && <ArrowUp size={12} aria-hidden="true" />}</th>
                <th>Status</th>
                <th>+1</th>
                <th>Brunch</th>
                <th>Method</th>
                <th>Invited</th>
                <th>Presenting</th>
                <th>Notes</th><th><span className="pl-sr-only">Details</span></th>
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
                    <div className="pl-person-identity"><span className={`pl-avatar pl-avatar-${[...person.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 6}`} aria-hidden="true">{person.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span><button type="button" className="pl-link-btn pl-people-name" onClick={() => onOpenPerson(person.id)}>
                      {person.name}
                    </button></div>
                  </td>
                  {inv ? (
                    <>
                      <td>
                        <select
                          className={`pl-status-select pl-status-${inv.status === 'invite?' ? 'not-invited' : inv.status}`}
                          value={inv.status}
                          onChange={(e) => void patch(person.id, { status: e.target.value as InvitationStatus })}
                          aria-label={`Status for ${person.name}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{INVITATION_LABELS[s]}</option>
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
                            <option key={m} value={m}>{m === 'hand' ? 'In person' : m[0].toUpperCase() + m.slice(1)}</option>
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
                  <td><input type="checkbox" checked={presenting.has(person.id)} disabled aria-label={`${person.name} presenting`} title="Based on contributor presentation pieces" /></td>
                  <td className="pl-people-notes">{inv && <input key={inv.notes ?? ''} defaultValue={inv.notes ?? ''} aria-label={`Invitation notes for ${person.name}`} onBlur={(e) => { const notes = e.target.value.trim(); if (notes !== (inv.notes ?? '')) void patch(person.id, { notes: notes || undefined }); }} />}</td>
                  <td><button type="button" className="pl-btn pl-row-menu" onClick={() => onOpenPerson(person.id)} aria-label={`Edit details for ${person.name}`}><MoreHorizontal size={18} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
