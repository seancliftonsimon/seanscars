import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, Plus, UserPlus, X } from 'lucide-react';
import { createRecord, deleteRecord, peopleCol, personDoc, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { INVITATION_STATUS_LABEL, INVITATION_STATUS_ORDER } from '../../logic/labels';
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
const HALF = PER_ROW / 2;
/** Suggestions shown before "Show all". */
const SUGGEST_LIMIT = 10;
/** Don't hide just a few: cap only when more than this many would be hidden. */
const SUGGEST_SLACK = 4;
const NEW_INVITATION = { status: 'invite?' as const, plusOnes: 0, brunch: false, rsvpIds: [] as string[] };

const statusClass = (s: InvitationStatus) => `is-${s === 'invite?' ? 'listed' : s}`;

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
  const [hoverSeat, setHoverSeat] = useState<Seat | null>(null);
  const [hoverParty, setHoverParty] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [showAll, setShowAll] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const addRef = useRef<HTMLInputElement>(null);

  const capacity = season?.capacity && season.capacity > 0 ? season.capacity : DEFAULT_SEATS;
  const invById = useMemo(() => new Map(data.invitations.map((i) => [i.id, i])), [data.invitations]);
  const parties = useMemo(() => buildParties(data.people, data.invitations), [data.people, data.invitations]);
  const seats = useMemo(() => assignSeats(parties, capacity), [parties, capacity]);
  const tally = useMemo(() => tallySeats(parties, capacity), [parties, capacity]);
  const sugg = useMemo(() => suggestions(data.people, data.invitations, parties), [data.people, data.invitations, parties]);

  useEffect(() => {
    if (!focus) return;
    rowRefs.current.get(focus)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const t = window.setTimeout(() => setFocus(null), 2400);
    return () => window.clearTimeout(t);
  }, [focus]);

  if (!season) return null;
  const sid = season.id;
  const lit = hoverSeat?.party?.personId ?? hoverParty ?? focus;

  const ref = (party: Party) => seasonSubDoc(sid, 'invitations', party.personId);

  /** Adds one plus-one (unnamed). */
  const addPlusOne = (party: Party, inv: WithId<Invitation>) =>
    void update(ref(party), inv, { plusOnes: party.plusOnes + 1 }, `${party.name}: ${plural(party.plusOnes + 1, 'plus-one')}`);

  /** Removes plus-one `k`, and their name. */
  const removePlusOne = (party: Party, inv: WithId<Invitation>, k: number) => {
    const names = Array.from({ length: party.plusOnes }, (_, j) => party.plusOneNames[j] ?? '');
    const gone = names[k]?.trim();
    names.splice(k, 1);
    const patch: Partial<Invitation> = { plusOnes: party.plusOnes - 1 };
    if (inv.plusOneNames?.length) patch.plusOneNames = resizeNames(names, party.plusOnes - 1);
    void update(ref(party), inv, patch, gone ? `${gone} removed from ${party.name}’s party` : `${party.name}: ${plural(party.plusOnes - 1, 'plus-one')}`);
  };

  /** Names plus-one `k` (blank clears it). */
  const namePlusOne = (party: Party, inv: WithId<Invitation>, k: number, value: string) => {
    const names = Array.from({ length: party.plusOnes }, (_, j) => party.plusOneNames[j] ?? '');
    if ((names[k] ?? '') === value.trim()) return;
    names[k] = value.trim();
    void update(ref(party), inv, { plusOneNames: resizeNames(names, party.plusOnes) }, value.trim() ? `${value.trim()} is ${party.name}’s +1` : `${party.name}’s +1 unnamed`);
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

  const query = name.trim().toLowerCase();
  const matches = (s: Suggestion) => !query || s.name.toLowerCase().includes(query);
  const fresh = sugg.filter((s) => !s.countedWith && matches(s));
  const counted = sugg.filter((s) => s.countedWith && matches(s));
  const capped = !showAll && !query && fresh.length > SUGGEST_LIMIT + SUGGEST_SLACK;
  const shown = capped ? fresh.slice(0, SUGGEST_LIMIT) : fresh;
  const exact = data.people.some((p) => p.name.trim().toLowerCase() === query);

  const groups = SEATED_STATUSES.map((status) => ({ status, parties: parties.filter((p) => p.status === status) })).filter((g) => g.parties.length);
  const over = tally.free < 0;
  const pct = Math.min(100, (tally.total / capacity) * 100);

  return (
    <div className="pl-seats">
      <div className="pl-seats-left">
        <section className="pl-card pl-seats-room" aria-labelledby="seats-head">
          <header className="pl-seats-score">
            <h2 id="seats-head" className="pl-seats-big">
              <span className={over ? 'is-over' : undefined}>{tally.total}</span>
              <span className="pl-seats-of">of {capacity} seats</span>
            </h2>
            <span className={`pl-seats-free ${over ? 'is-over' : tally.free <= 3 ? 'is-tight' : ''}`}>
              {over ? `${-tally.free} over` : tally.free === 0 ? 'Full house' : `${tally.free} free`}
            </span>
          </header>
          <div className={`pl-seats-meter${over ? ' is-over' : ''}`} aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          <ul className="pl-seats-legend" aria-label="Seats by status">
            {SEATED_STATUSES.filter((s) => tally.byStatus[s] > 0).map((s) => (
              <li key={s} className={statusClass(s)}>
                <span className="pl-seat-swatch" aria-hidden />
                {INVITATION_STATUS_LABEL[s]} <strong>{tally.byStatus[s]}</strong>
              </li>
            ))}
            <li className="is-plus">
              <span className="pl-seat-swatch" aria-hidden />
              Plus-ones <strong>{tally.plusOnes}</strong>
            </li>
          </ul>

          <SeatMap
            seats={seats}
            capacity={capacity}
            lit={lit}
            total={tally.total}
            onHover={setHoverSeat}
            onPick={(id) => setFocus(id)}
            onPickEmpty={() => {
              addRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              addRef.current?.focus({ preventScroll: true });
            }}
          />
          <p className="pl-seats-caption" aria-live="polite">
            {hoverSeat ? (
              <>
                <span className="pl-faint">{hoverSeat.over ? 'No seat' : `${rowLetter(Math.floor(hoverSeat.index / PER_ROW))}${(hoverSeat.index % PER_ROW) + 1}`}</span>{' '}
                {seatLabel(hoverSeat)}
              </>
            ) : (
              <span className="pl-faint">Point at a seat to see who’s in it. Click an empty seat to add someone.</span>
            )}
          </p>
        </section>

        <section className="pl-card pl-seats-add" aria-labelledby="seats-add">
          <div>
            <h2 id="seats-add" className="pl-seats-h">
              <UserPlus size={16} aria-hidden /> Add a guest
            </h2>
            <p className="pl-small pl-faint pl-seats-help">Type their name and press Add. Bringing a +1? Use the +1 button next to their name in the list.</p>
          </div>
          <form className="pl-seats-addform" onSubmit={addNew}>
            <label className="pl-sr-only" htmlFor="seats-add-name">Guest’s name</label>
            <input
              id="seats-add-name"
              ref={addRef}
              type="text"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest’s name"
            />
            <button type="submit" className="pl-btn pl-btn-primary">
              <Plus size={16} aria-hidden /> {name.trim() && !exact && !fresh.length ? `Add “${name.trim()}”` : 'Add to list'}
            </button>
          </form>
          {fresh.length > 0 && <p className="pl-seats-sublabel">{query ? 'Matching past guests' : 'Past guests: tap to add'}</p>}
          {fresh.length > 0 ? (
            <div className="pl-seats-suggest" role="group" aria-label="Past guests not on the list">
              {shown.map((s) => (
                <button
                  key={s.personId}
                  type="button"
                  className="pl-seats-chip"
                  onClick={() => void addBack(s)}
                  title={[s.notes, s.status ? `This year: ${INVITATION_STATUS_LABEL[s.status]}` : ''].filter(Boolean).join(' · ') || `Add ${s.name}`}
                  aria-label={`Add ${s.name}${s.notes ? `. ${s.notes}` : ''}`}
                >
                  <Plus size={13} aria-hidden /> {s.name}
                </button>
              ))}
              {capped && (
                <button type="button" className="pl-seats-more" onClick={() => setShowAll(true)}>
                  {fresh.length - SUGGEST_LIMIT} more
                </button>
              )}
            </div>
          ) : (
            query && <p className="pl-small pl-faint pl-seats-none">No past guest matches. Press Enter to add them.</p>
          )}
          {counted.length > 0 && (
            <details className="pl-small pl-faint pl-seats-counted">
              <summary>{plural(counted.length, 'past guest is', 'past guests are')} already seated as a plus-one</summary>
              {counted.map((s, k) => (
                <span key={s.personId}>
                  {k > 0 && ', '}
                  <button type="button" className="pl-seats-link" onClick={() => void addBack(s)} title={`Give ${s.name} their own invitation`}>
                    {s.name}
                  </button>{' '}
                  <span>({s.countedWith})</span>
                </span>
              ))}
            </details>
          )}
        </section>
      </div>

      <section className="pl-seats-right" aria-label="Who’s sitting">
        {parties.length === 0 ? (
          <p className="pl-muted">No one yet. Add people and watch the room fill.</p>
        ) : (
          groups.map((g) => (
            <div key={g.status} className={`pl-seats-group ${statusClass(g.status)}`}>
              <h3 className="pl-seats-grouphead">
                <span className="pl-seat-swatch" aria-hidden />
                {INVITATION_STATUS_LABEL[g.status]}
                <span className="pl-faint">
                  {plural(g.parties.length, 'party', 'parties')} · {plural(tally.byStatus[g.status], 'seat')}
                </span>
              </h3>
              <ul className="pl-seats-list">
                {g.parties.map((party) => {
                  const inv = invById.get(party.personId);
                  if (!inv) return null;
                  return (
                    <li
                      key={party.personId}
                      ref={(el) => {
                        if (el) rowRefs.current.set(party.personId, el);
                        else rowRefs.current.delete(party.personId);
                      }}
                      onMouseEnter={() => setHoverParty(party.personId)}
                      onMouseLeave={() => setHoverParty(null)}
                    >
                      <PartyRow
                        party={party}
                        lit={lit === party.personId}
                        onOpen={() => onOpenPerson(party.personId)}
                        onStatus={(status) =>
                          void update(seasonSubDoc(sid, 'invitations', party.personId), inv, { status }, `${party.name}: ${INVITATION_STATUS_LABEL[status]}`)
                        }
                        onAddPlusOne={() => addPlusOne(party, inv)}
                        onRemovePlusOne={(k) => removePlusOne(party, inv, k)}
                        onNamePlusOne={(k, v) => namePlusOne(party, inv, k, v)}
                        onRemove={() => takeOff(party, inv)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/**
 * The room. One grid for every row so the aisle lines up; a short back row
 * is centered on the aisle like a real theater.
 */
function SeatMap({
  seats,
  capacity,
  lit,
  total,
  onHover,
  onPick,
  onPickEmpty,
}: {
  seats: Seat[];
  capacity: number;
  lit: string | null;
  total: number;
  onHover: (s: Seat | null) => void;
  onPick: (id: string) => void;
  onPickEmpty: () => void;
}) {
  const rows = rowLengths(capacity, PER_ROW);
  const overflow = seats.slice(capacity);

  const seatEl = (seat: Seat, style?: React.CSSProperties) => {
    const p = seat.party;
    const cls = [
      'pl-seat',
      p ? statusClass(p.status) : 'is-empty',
      p && seat.slot > 0 ? 'is-plus' : '',
      seat.over ? 'is-over' : '',
      p && lit === p.personId ? 'is-lit' : '',
      lit && p && lit !== p.personId ? 'is-dim' : '',
      lit && !p ? 'is-dim' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <span
        key={`${seat.index}:${p?.personId ?? ''}:${seat.slot}`}
        className={cls}
        style={style}
        onMouseEnter={() => onHover(seat)}
        onMouseLeave={() => onHover(null)}
        onClick={() => (p ? onPick(p.personId) : onPickEmpty())}
      />
    );
  };

  return (
    <div className="pl-seatmap" role="img" aria-label={`${total} of ${capacity} seats taken`}>
      <div className="pl-seatmap-screen" aria-hidden>
        <span>Screen</span>
      </div>
      <div className="pl-seatmap-grid" aria-hidden>
        {rows.map((len, r) => {
          const start = r * PER_ROW;
          const left = Math.min(HALF, Math.ceil(len / 2));
          const row = seats.slice(start, start + len);
          const line = r + 1;
          return [
            <span key={`l${r}`} className="pl-seatmap-letter" style={{ gridRow: line, gridColumn: 1 }}>
              {rowLetter(r)}
            </span>,
            ...row.map((seat, k) =>
              seatEl(seat, {
                gridRow: line,
                // Left block hugs the aisle (columns 2–6), right block starts after it (8–12).
                gridColumn: k < left ? 2 + (HALF - left) + k : 8 + (k - left),
              }),
            ),
            <span key={`r${r}`} className="pl-seatmap-letter" style={{ gridRow: line, gridColumn: 13 }}>
              {rowLetter(r)}
            </span>,
          ];
        })}
      </div>
      {overflow.length > 0 && (
        <div className="pl-seatmap-over" aria-hidden>
          <span className="pl-seatmap-over-label">No seat · {overflow.length}</span>
          <span className="pl-seatmap-over-seats">{overflow.map((s) => seatEl(s))}</span>
        </div>
      )}
    </div>
  );
}

/** A status dot that is really a native <select>. */
function StatusDot({ value, onChange, label }: { value: InvitationStatus; onChange: (s: InvitationStatus) => void; label: string }) {
  return (
    <span className={`pl-seats-dot ${statusClass(value)}`} title={`${INVITATION_STATUS_LABEL[value]}: change`}>
      <span className="pl-seat-swatch" aria-hidden />
      <ChevronDown size={12} aria-hidden />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as InvitationStatus)}>
        {INVITATION_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {INVITATION_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </span>
  );
}

function PartyRow({
  party,
  lit,
  onOpen,
  onStatus,
  onAddPlusOne,
  onRemovePlusOne,
  onNamePlusOne,
  onRemove,
}: {
  party: Party;
  lit: boolean;
  onOpen: () => void;
  onStatus: (s: InvitationStatus) => void;
  onAddPlusOne: () => void;
  onRemovePlusOne: (k: number) => void;
  onNamePlusOne: (k: number, name: string) => void;
  onRemove: () => void;
}) {
  /** Which plus-one is being named, if any. */
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [seen, setSeen] = useState(party.plusOnes);
  // A plus-one just added opens its name box once the new count arrives.
  if (seen !== party.plusOnes) {
    setSeen(party.plusOnes);
    if (waiting && party.plusOnes > seen) {
      setWaiting(false);
      setDraft('');
      setEditing(party.plusOnes - 1);
    }
  }

  const edit = (k: number) => {
    setDraft(party.plusOneNames[k] ?? '');
    setEditing(k);
  };
  const commit = () => {
    if (editing !== null) onNamePlusOne(editing, draft);
    setEditing(null);
  };

  return (
    <div className={`pl-seats-row${lit ? ' is-lit' : ''}`}>
      <StatusDot value={party.status} onChange={onStatus} label={`Status for ${party.name}`} />
      <div className="pl-seats-who">
        <button type="button" className="pl-seats-name" onClick={onOpen}>
          {party.name}
        </button>
        {party.plusOnes > 0 && (
          <ul className="pl-seats-ones" aria-label={`${party.name}’s plus-ones`}>
            {Array.from({ length: party.plusOnes }, (_, k) => {
              const n = party.plusOneNames[k]?.trim();
              return (
                <li key={k} className={`pl-seats-one${n ? '' : ' is-unnamed'}`}>
                  {editing === k ? (
                    <input
                      autoFocus
                      value={draft}
                      placeholder="Name (optional)"
                      aria-label={`Name of ${party.name}’s +1`}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="pl-seats-one-name" onClick={() => edit(k)} title="Click to name">
                      {n || `+1 · add name`}
                    </button>
                  )}
                  <button type="button" className="pl-seats-one-x" onClick={() => onRemovePlusOne(k)} aria-label={`Remove ${n || `${party.name}’s +1`}`} title="Remove this +1">
                    <X size={11} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="pl-seats-addone"
        onClick={() => {
          setWaiting(true);
          onAddPlusOne();
        }}
        disabled={party.plusOnes >= 9}
        aria-label={`Add a +1 for ${party.name}`}
        title={`Add a +1 for ${party.name}`}
      >
        <Plus size={13} aria-hidden />1
      </button>
      <button type="button" className="pl-seats-remove" onClick={onRemove} aria-label={`Take ${party.name} off this year’s list`} title="Not this year">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
