import { useMemo, useState, type FormEvent } from 'react';
import { Coffee, Mic, Plus, UserPlus, Users } from 'lucide-react';
import { getDocs } from 'firebase/firestore';
import { createRecord, deleteRecord, peopleCol, personDoc, seasonCol, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSeason } from '../../hooks/useSeason';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import type { Derived } from '../../hooks/useDerived';
import { ChipSelect } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { Stepper } from '../../components/ui/Stepper';
import { INVITATION_OPTIONS } from '../../components/status';
import { INVITATION_STATUS_LABEL, INVITATION_STATUS_ORDER } from '../../logic/labels';
import { presentingIds } from '../../logic/headcount';
import { plural } from '../../logic/dates';
import type { InvitationStatus, PhaseId } from '../../types';

type Filter = 'all' | InvitationStatus | 'off';

const NEW_INVITATION = { status: 'invite?' as const, plusOnes: 0, brunch: false, rsvpIds: [] as string[] };

/** Statuses that only make sense once invitations are out. */
const AFTER_SEND: InvitationStatus[] = ['invited', 'maybe', 'declined'];

interface Props {
  derived: Derived;
  phase: PhaseId;
  onOpenPerson: (id: string) => void;
}

/** Build and sort the guest list, with the projection updating as you go. */
export default function GuestList({ derived, phase, onOpenPerson }: Props) {
  const { season, data } = usePlanner();
  const { seasons } = useSeason();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const invitesOut = phase !== 'setup' && phase !== 'lists';
  const invById = useMemo(() => new Map(data.invitations.map((i) => [i.id, i])), [data.invitations]);
  const presenting = useMemo(() => presentingIds(data.pieces), [data.pieces]);
  const prev = seasons.filter((s) => season && s.year < season.year).sort((a, b) => b.year - a.year)[0];

  const counts = derived.projection.counts;
  const offList = data.people.filter((p) => !invById.has(p.id)).length;
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'On this year’s list', n: data.invitations.filter((i) => i.status !== 'not-inviting').length },
    ...INVITATION_STATUS_ORDER.filter((s) => invitesOut || !AFTER_SEND.includes(s) || counts[s] > 0).map((s) => ({
      id: s as Filter,
      label: INVITATION_STATUS_LABEL[s],
      n: counts[s],
    })),
    { id: 'off', label: 'Not on the list', n: offList },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (s?: InvitationStatus) => (s ? INVITATION_STATUS_ORDER.indexOf(s) : 99);
    return data.people
      .map((person) => ({ person, inv: invById.get(person.id) }))
      .filter(({ person, inv }) => {
        if (q) return [person.name, person.email ?? '', ...(person.aliases ?? [])].some((s) => s.toLowerCase().includes(q));
        if (filter === 'off') return !inv;
        if (!inv) return false;
        if (filter === 'all') return inv.status !== 'not-inviting';
        return inv.status === filter;
      })
      .sort((a, b) => rank(a.inv?.status) - rank(b.inv?.status) || a.person.name.localeCompare(b.person.name));
  }, [data.people, invById, filter, query]);

  if (!season) return null;
  const sid = season.id;

  async function addPerson(e: FormEvent) {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;
    let id = '';
    const ok = await write(async () => {
      id = await createRecord(peopleCol(), { name });
      await createRecord(seasonSubDoc(sid, 'invitations', id), NEW_INVITATION);
    });
    if (ok) {
      setQuery('');
      toast({
        message: `${name} added to the list`,
        undo: async () => {
          await deleteRecord(seasonSubDoc(sid, 'invitations', id));
          await deleteRecord(personDoc(id));
        },
      });
    }
  }

  async function putOnList(personId: string, name: string) {
    await write(() => createRecord(seasonSubDoc(sid, 'invitations', personId), NEW_INVITATION), `${name} is on the list`, () =>
      deleteRecord(seasonSubDoc(sid, 'invitations', personId)),
    );
  }

  async function addReturning() {
    if (!prev) return;
    setBusy(true);
    const snap = await getDocs(seasonCol(prev.id, 'invitations'));
    const came = snap.docs.map((d) => d.data()).filter((i) => (i.status === 'confirmed' || i.status === 'maybe') && !invById.has(i.id) && data.peopleById.has(i.id));
    const created: string[] = [];
    await write(
      async () => {
        for (const i of came) {
          await createRecord(seasonSubDoc(sid, 'invitations', i.id), { ...NEW_INVITATION, plusOnes: i.plusOnes ?? 0 });
          created.push(i.id);
        }
      },
      came.length ? `Added ${plural(came.length, 'returning guest')} from ${prev.year}` : `Everyone who came in ${prev.year} is already on the list`,
      came.length ? () => Promise.all(created.map((id) => deleteRecord(seasonSubDoc(sid, 'invitations', id)))) : undefined,
    );
    setBusy(false);
  }

  const showAdd = query.trim() !== '' && !rows.some((r) => r.person.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="pl-stack pl-guestlist">
      <form className="pl-toolbar" onSubmit={addPerson} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find or add a guest…"
          aria-label="Find or add a guest"
        />
        {showAdd && (
          <button type="submit" className="pl-btn pl-btn-primary">
            <UserPlus size={16} aria-hidden /> Add “{query.trim()}”
          </button>
        )}
        {prev && (
          <button type="button" className="pl-btn" onClick={() => void addReturning()} disabled={busy}>
            <Users size={16} aria-hidden /> Add {prev.year} guests
          </button>
        )}
      </form>

      {!query && (
        <div className="pl-filters" role="group" aria-label="Show">
          {filters.map((f) => (
            <button key={f.id} type="button" className="pl-filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="pl-count">{f.n}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        data.invitations.length === 0 && !query ? (
          <EmptyState icon={Users} title="Start the guest list">
            Type a name above to add someone{prev ? `, or bring in everyone who came in ${prev.year}` : ''}. As you sort people into
            “On the list” and “Not this year”, the headcount above tells you whether you’ll fit.
          </EmptyState>
        ) : (
          <p className="pl-muted">{query ? 'No one matches. Press Enter to add them.' : 'No one here.'}</p>
        )
      ) : (
        <ul className="pl-list" aria-label="Guests">
          {rows.map(({ person, inv }) => (
            <li key={person.id}>
              <div className="pl-list-row pl-guest-row">
                <div className="pl-list-main">
                  <button type="button" className="pl-list-title" onClick={() => onOpenPerson(person.id)}>
                    {person.name}
                  </button>
                  {(inv?.notes || presenting.has(person.id)) && (
                    <span className="pl-list-meta">
                      {presenting.has(person.id) && (
                        <span className="pl-meta-flag"><Mic size={12} aria-hidden /> Presenting</span>
                      )}
                      {inv?.notes && <span className="pl-truncate">{inv.notes}</span>}
                    </span>
                  )}
                </div>
                <div className="pl-list-actions">
                  {inv ? (
                    <>
                      <ChipSelect
                        value={inv.status}
                        options={INVITATION_OPTIONS}
                        label={`Status for ${person.name}`}
                        onChange={(status) =>
                          void update(seasonSubDoc(sid, 'invitations', person.id), inv, { status }, `${person.name}: ${INVITATION_STATUS_LABEL[status]}`)
                        }
                      />
                      <span className="pl-plus">
                        <span className="pl-small pl-faint">+1s</span>
                        <Stepper
                          value={inv.plusOnes}
                          label={`Plus-ones for ${person.name}`}
                          onChange={(plusOnes) => void update(seasonSubDoc(sid, 'invitations', person.id), inv, { plusOnes }, `${person.name}: ${plural(plusOnes, 'plus-one')}`)}
                        />
                      </span>
                      {(inv.status === 'confirmed' || inv.status === 'maybe' || inv.brunch) && <button
                        type="button"
                        className="pl-toggle"
                        aria-pressed={inv.brunch}
                        onClick={() => void update(seasonSubDoc(sid, 'invitations', person.id), inv, { brunch: !inv.brunch }, `${person.name}: ${inv.brunch ? 'no brunch' : 'brunch'}`)}
                        title="Coming to brunch"
                      >
                        <Coffee size={12} aria-hidden /> Brunch
                      </button>}
                    </>
                  ) : (
                    <button type="button" className="pl-btn pl-btn-sm" onClick={() => void putOnList(person.id, person.name)}>
                      <Plus size={14} aria-hidden /> Put on the list
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
