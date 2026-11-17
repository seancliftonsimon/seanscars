import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { History, Pencil, UserPlus, X } from 'lucide-react';
import { createRecord, deleteRecord, peopleCol, personDoc, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { ChipSelect } from '../../components/ui/Chip';
import { Stepper } from '../../components/ui/Stepper';
import { INVITATION_OPTIONS } from '../../components/status';
import { INVITATION_STATUS_LABEL } from '../../logic/labels';
import { plural } from '../../logic/dates';
import {
  SEATED_STATUSES,
  assignSeats,
  buildParties,
  resizeNames,
  rowLengths,
  rowLetter,
  seatLabel,
  suggestions,
  tallySeats,
  type Party,
  type Seat,
  type Suggestion,
} from '../../logic/seats';
import type { Invitation, InvitationStatus, WithId } from '../../types';
import './seats.css';

/** Seats in the room when the season has no capacity set. */
export const DEFAULT_SEATS = 58;
const PER_ROW = 10;
const NEW_INVITATION = { status: 'invite?' as const, plusOnes: 0, brunch: false, rsvpIds: [] as string[] };

interface Props {
  onOpenPerson: (id: string) => void;
}

/**
 * Seats: the room as a seat map that fills as people (and their plus-ones)
 * go on the list, with past guests one tap away.
 */
export default function Seats({ onOpenPerson }: Props) {
  const { season, data } = usePlanner();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const toast = useToast();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [name, setName] = useState('');
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const capacity = season?.capacity && season.capacity > 0 ? season.capacity : DEFAULT_SEATS;
  const invById = useMemo(() => new Map(data.invitations.map((i) => [i.id, i])), [data.invitations]);
  const parties = useMemo(() => buildParties(data.people, data.invitations), [data.people, data.invitations]);
  const seats = useMemo(() => assignSeats(parties, capacity), [parties, capacity]);
  const tally = useMemo(() => tallySeats(parties, capacity), [parties, capacity]);
  const sugg = useMemo(() => suggestions(data.people, data.invitations, parties), [data.people, data.invitations, parties]);

  useEffect(() => {
    if (!focus) return;
    rowRefs.current.get(focus)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focus]);

  if (!season) return null;
  const sid = season.id;
  const lit = hover ?? focus;

  const setPlusOnes = (party: Party, inv: WithId<Invitation>, n: number) => {
    const patch: Partial<Invitation> = { plusOnes: n };
    if (inv.plusOneNames?.length) patch.plusOneNames = resizeNames(inv.plusOneNames, n);
    void update(seasonSubDoc(sid, 'invitations', party.personId), inv, patch, `${party.name}: ${plural(n, 'plus-one')}`);
  };

  const setNames = (party: Party, inv: WithId<Invitation>, names: string[]) => {
    const next = resizeNames(names.map((n) => n.trim()), party.plusOnes);
    const prev = inv.plusOneNames ?? [];
    if (next.length === prev.length && next.every((n, i) => n === prev[i])) return;
    void update(seasonSubDoc(sid, 'invitations', party.personId), inv, { plusOneNames: next }, `${party.name}’s guests renamed`);
  };

  const takeOff = (party: Party, inv: WithId<Invitation>) =>
    void update(seasonSubDoc(sid, 'invitations', party.personId), inv, { status: 'not-inviting' }, `${party.name} is off the list (${plural(party.size, 'seat')} freed)`);

  async function addBack(s: Suggestion) {
    const inv = invById.get(s.personId);
    if (inv) {
      await update(seasonSubDoc(sid, 'invitations', s.personId), inv, { status: 'invite?' }, `${s.name} is back on the list`);
    } else {
      await write(() => createRecord(seasonSubDoc(sid, 'invitations', s.personId), NEW_INVITATION), `${s.name} is on the list`, () =>
        deleteRecord(seasonSubDoc(sid, 'invitations', s.personId)),
      );
    }
    setFocus(s.personId);
  }

  async function addNew(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const existing = data.people.find((p) => p.name.trim().toLowerCase() === n.toLowerCase());
    if (existing) {
      const s = sugg.find((x) => x.personId === existing.id);
      if (s) await addBack(s);
      else setFocus(existing.id);
      setName('');
      return;
    }
    let id = '';
    const ok = await write(async () => {
      id = await createRecord(peopleCol(), { name: n });
      await createRecord(seasonSubDoc(sid, 'invitations', id), NEW_INVITATION);
    });
    if (ok) {
      setName('');
      setFocus(id);
      toast({
        message: `${n} added to the list`,
        undo: async () => {
          await deleteRecord(seasonSubDoc(sid, 'invitations', id));
          await deleteRecord(personDoc(id));
        },
      });
    }
  }

  const fresh = sugg.filter((s) => !s.countedWith);
  const counted = sugg.filter((s) => s.countedWith);
  const query = name.trim().toLowerCase();
  const matches = (s: Suggestion) => !query || s.name.toLowerCase().includes(query);

  return (
    <div className="pl-seats">
      <section className="pl-card pl-seats-room" aria-labelledby="seats-head">
        <div className="pl-seats-score">
          <h2 id="seats-head" className="pl-seats-big">
            <span className={tally.free < 0 ? 'is-over' : undefined}>{tally.total}</span>
            <span className="pl-seats-of"> / {capacity} seats</span>
          </h2>
          <p className={`pl-seats-free ${tally.free < 0 ? 'is-over' : tally.free <= 3 ? 'is-tight' : ''}`}>
            {tally.free < 0 ? `${plural(-tally.free, 'person', 'people')} over` : tally.free === 0 ? 'Full house' : `${plural(tally.free, 'seat')} free`}
          </p>
          <p className="pl-small pl-faint">
            {plural(tally.guests, 'guest')} + {plural(tally.plusOnes, 'plus-one')}
          </p>
        </div>

        <ul className="pl-seats-legend" aria-label="Seats by status">
          {SEATED_STATUSES.map((s) => (
            <li key={s} className={`is-${s === 'invite?' ? 'listed' : s}`}>
              <span className="pl-seat-swatch" aria-hidden /> {INVITATION_STATUS_LABEL[s]} <strong>{tally.byStatus[s]}</strong>
            </li>
          ))}
          <li className="is-plus">
            <span className="pl-seat-swatch" aria-hidden /> Plus-one
          </li>
        </ul>

        <SeatMap seats={seats} capacity={capacity} lit={lit} onHover={setHover} onPick={(id) => setFocus(id)} tally={tally.total} />
      </section>

      <div className="pl-seats-side">
        <section className="pl-stack" aria-labelledby="seats-add">
          <h2 id="seats-add" className="pl-seats-h">Add people</h2>
          <form className="pl-toolbar" onSubmit={addNew}>
            <input
              type="search"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type a name, or filter past guests…"
              aria-label="Add a guest by name"
            />
            {name.trim() && (
              <button type="submit" className="pl-btn pl-btn-primary">
                <UserPlus size={16} aria-hidden /> Add
              </button>
            )}
          </form>
          {fresh.some(matches) && (
            <div className="pl-seats-suggest" role="group" aria-label="Past guests not on the list">
              {fresh.filter(matches).map((s) => (
                <button key={s.personId} type="button" className="pl-seats-chip" onClick={() => void addBack(s)} title={s.notes ? `${s.name}: ${s.notes}` : `Add ${s.name}`}>
                  <span className="pl-seats-chip-name">
                    <History size={12} aria-hidden /> {s.name}
                    {s.status && <span className="pl-faint"> · {INVITATION_STATUS_LABEL[s.status]}</span>}
                  </span>
                  {s.notes && <span className="pl-seats-chip-note">{s.notes}</span>}
                </button>
              ))}
            </div>
          )}
          {counted.some(matches) && (
            <details className="pl-details pl-small">
              <summary>Already sitting as someone’s plus-one ({counted.filter(matches).length})</summary>
              <ul className="pl-seats-counted">
                {counted.filter(matches).map((s) => (
                  <li key={s.personId}>
                    {s.name} <span className="pl-faint">with {s.countedWith}</span>
                    <button type="button" className="pl-btn pl-btn-quiet pl-btn-sm" onClick={() => void addBack(s)}>
                      Give their own invite
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="pl-stack" aria-labelledby="seats-list">
          <h2 id="seats-list" className="pl-seats-h">
            Who’s sitting <span className="pl-count">{parties.length}</span>
          </h2>
          {parties.length === 0 ? (
            <p className="pl-muted">No one yet. Add people above and watch the room fill.</p>
          ) : (
            <ul className="pl-list" aria-label="Parties holding seats">
              {parties.map((party) => {
                const inv = invById.get(party.personId);
                if (!inv) return null;
                return (
                  <li
                    key={party.personId}
                    ref={(el) => {
                      if (el) rowRefs.current.set(party.personId, el);
                      else rowRefs.current.delete(party.personId);
                    }}
                    onMouseEnter={() => setHover(party.personId)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <PartyRow
                      party={party}
                      lit={lit === party.personId}
                      onOpen={() => onOpenPerson(party.personId)}
                      onStatus={(status) =>
                        void update(seasonSubDoc(sid, 'invitations', party.personId), inv, { status }, `${party.name}: ${INVITATION_STATUS_LABEL[status]}`)
                      }
                      onPlusOnes={(n) => setPlusOnes(party, inv, n)}
                      onNames={(names) => setNames(party, inv, names)}
                      onRemove={() => takeOff(party, inv)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const statusClass = (s: InvitationStatus) => `is-${s === 'invite?' ? 'listed' : s}`;

function SeatMap({
  seats,
  capacity,
  lit,
  onHover,
  onPick,
  tally,
}: {
  seats: Seat[];
  capacity: number;
  lit: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  tally: number;
}) {
  const rows = rowLengths(capacity, PER_ROW);
  const overflow = seats.slice(capacity);
  const starts = rows.map((_, r) => r * PER_ROW);
  const seatEl = (seat: Seat) => {
    const p = seat.party;
    const cls = [
      'pl-seat',
      p ? statusClass(p.status) : 'is-empty',
      p && seat.slot > 0 ? 'is-plus' : '',
      seat.over ? 'is-over' : '',
      p && lit === p.personId ? 'is-lit' : '',
      lit && p && lit !== p.personId ? 'is-dim' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <span
        key={`${seat.index}:${p?.personId ?? ''}:${seat.slot}`}
        className={cls}
        title={seatLabel(seat)}
        onMouseEnter={() => onHover(p?.personId ?? null)}
        onMouseLeave={() => onHover(null)}
        onClick={() => p && onPick(p.personId)}
      >
        {p && seat.slot > 0 ? '+' : ''}
      </span>
    );
  };
  return (
    <div className="pl-seatmap" role="img" aria-label={`${tally} of ${capacity} seats taken`}>
      <div className="pl-seatmap-screen" aria-hidden>
        Screen
      </div>
      {rows.map((len, r) => {
        const row = seats.slice(starts[r], starts[r] + len);
        const half = Math.ceil(PER_ROW / 2);
        return (
          <div key={r} className="pl-seatmap-row" aria-hidden>
            <span className="pl-seatmap-letter">{rowLetter(r)}</span>
            <span className="pl-seatmap-block">{row.slice(0, Math.min(half, Math.ceil(len / 2))).map(seatEl)}</span>
            <span className="pl-seatmap-aisle" />
            <span className="pl-seatmap-block">{row.slice(Math.min(half, Math.ceil(len / 2))).map(seatEl)}</span>
            <span className="pl-seatmap-letter">{rowLetter(r)}</span>
          </div>
        );
      })}
      {overflow.length > 0 && (
        <div className="pl-seatmap-over" aria-hidden>
          <span className="pl-seatmap-over-label">No seat: {overflow.length}</span>
          <span className="pl-seatmap-over-seats">{overflow.map(seatEl)}</span>
        </div>
      )}
    </div>
  );
}

function PartyRow({
  party,
  lit,
  onOpen,
  onStatus,
  onPlusOnes,
  onNames,
  onRemove,
}: {
  party: Party;
  lit: boolean;
  onOpen: () => void;
  onStatus: (s: InvitationStatus) => void;
  onPlusOnes: (n: number) => void;
  onNames: (names: string[]) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const startEdit = () => {
    setDraft(Array.from({ length: party.plusOnes }, (_, k) => party.plusOneNames[k] ?? ''));
    setEditing(true);
  };
  const save = () => {
    onNames(draft);
    setEditing(false);
  };
  const named = party.plusOneNames.filter((n) => n.trim());
  const unnamed = party.plusOnes - named.length;

  return (
    <div className={`pl-list-row pl-seats-row${lit ? ' is-highlight' : ''}`}>
      <span className={`pl-seat pl-seat-key ${statusClass(party.status)}`} aria-hidden>
        {party.size}
      </span>
      <div className="pl-list-main">
        <button type="button" className="pl-list-title" onClick={onOpen}>
          {party.name}
        </button>
        {party.plusOnes > 0 && !editing && (
          <span className="pl-list-meta pl-small">
            <span className="pl-faint">
              with {[...named, ...(unnamed > 0 ? [named.length ? `${unnamed} more` : plural(unnamed, 'guest')] : [])].join(', ')}
            </span>
            <button type="button" className="pl-seats-link" onClick={startEdit} aria-label={`Name ${party.name}’s plus-ones`}>
              <Pencil size={11} aria-hidden /> {named.length ? 'Edit' : 'Name them'}
            </button>
          </span>
        )}
        {editing && (
          <form
            className="pl-seats-names"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {draft.map((v, k) => (
              <input
                key={k}
                value={v}
                autoFocus={k === 0}
                placeholder={`Guest ${k + 1}`}
                aria-label={`${party.name}’s guest ${k + 1}`}
                onChange={(e) => setDraft((d) => d.map((x, j) => (j === k ? e.target.value : x)))}
              />
            ))}
            <button type="submit" className="pl-btn pl-btn-sm pl-btn-primary">Save</button>
            <button type="button" className="pl-btn pl-btn-sm pl-btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        )}
      </div>
      <div className="pl-list-actions">
        <ChipSelect value={party.status} options={INVITATION_OPTIONS} label={`Status for ${party.name}`} onChange={onStatus} />
        <span className="pl-plus">
          <span className="pl-small pl-faint">+1s</span>
          <Stepper value={party.plusOnes} label={`Plus-ones for ${party.name}`} onChange={onPlusOnes} />
        </span>
        <button type="button" className="pl-btn pl-btn-quiet pl-btn-sm pl-seats-remove" onClick={onRemove} aria-label={`Take ${party.name} off this year’s list`} title="Not this year">
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
