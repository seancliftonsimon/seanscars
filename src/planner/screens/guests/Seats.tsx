import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronDown, GripVertical, Plus, Send, UserPlus, X } from 'lucide-react';
import { createRecord, deleteRecord, peopleCol, personDoc, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { INVITATION_STATUS_LABEL, INVITATION_STATUS_ORDER } from '../../logic/labels';
import { plural } from '../../logic/dates';
import {
  LIKELIHOODS,
  OUTLOOKS,
  OUTLOOK_LABEL,
  assignSeats,
  buildParties,
  dropSide,
  expectedFrom,
  initials,
  moveParty,
  plusOneName,
  resizeNames,
  rowLengths,
  rowLetter,
  seatLabel,
  seatOrderPatches,
  suggestions,
  tallySeats,
  uniqueShortNames,
  type Outlook,
  type Party,
  type Seat,
  type Suggestion,
} from '../../logic/seats';
import type { Invitation, InvitationStatus, Likelihood, WithId } from '../../types';
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

/** Invitation stage, worded for this view. */
const STAGE_LABEL: Record<InvitationStatus, string> = {
  'invite?': 'Not sent',
  invited: 'Invited',
  confirmed: 'Coming',
  maybe: 'Said maybe',
  declined: 'Can’t come',
  'not-inviting': 'Not this year',
};

const outlookClass = (o: Outlook) => `is-o-${o}`;

interface Props {
  onOpenPerson: (id: string) => void;
}

/**
 * Seats: the room as a seat map that fills as people (and their plus-ones)
 * go on the list. Each party has a likelihood, so the room shows both the
 * seats held and the turnout to expect. Drag a party to rearrange the room.
 */
export default function Seats({ onOpenPerson }: Props) {
  const { season, data } = usePlanner();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const toast = useToast();
  const [hoverSeat, setHoverSeat] = useState<Seat | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverParty, setHoverParty] = useState<string | null>(null);
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

  if (!season) return null;
  const sid = season.id;
  const ref = (personId: string) => seasonSubDoc(sid, 'invitations', personId);
  const selParty = selected ? parties.find((p) => p.personId === selected) ?? null : null;
  const hovered = hoverSeat?.party?.personId ?? hoverParty ?? null;
  const lit = hovered ?? selParty?.personId ?? null;

  const addPlusOne = (party: Party, inv: WithId<Invitation>) =>
    void update(ref(party.personId), inv, { plusOnes: party.plusOnes + 1 }, `${party.name}: ${plural(party.plusOnes + 1, 'plus-one')}`);

  const removePlusOne = (party: Party, inv: WithId<Invitation>, k: number) => {
    const names = Array.from({ length: party.plusOnes }, (_, j) => party.plusOneNames[j] ?? '');
    const gone = names[k]?.trim();
    names.splice(k, 1);
    const patch: Partial<Invitation> = { plusOnes: party.plusOnes - 1 };
    if (inv.plusOneNames?.length) patch.plusOneNames = resizeNames(names, party.plusOnes - 1);
    void update(ref(party.personId), inv, patch, gone ? `${gone} removed from ${party.name}’s party` : `${party.name}: ${plural(party.plusOnes - 1, 'plus-one')}`);
  };

  const namePlusOne = (party: Party, inv: WithId<Invitation>, k: number, value: string) => {
    const names = Array.from({ length: party.plusOnes }, (_, j) => party.plusOneNames[j] ?? '');
    if ((names[k] ?? '') === value.trim()) return;
    names[k] = value.trim();
    void update(ref(party.personId), inv, { plusOneNames: resizeNames(names, party.plusOnes) }, value.trim() ? `${value.trim()} is ${party.name}’s +1` : `${party.name}’s +1 unnamed`);
  };

  const setLikelihood = (party: Party, inv: WithId<Invitation>, likelihood: Likelihood) => {
    if ((inv.likelihood ?? 'likely') === likelihood) return;
    void update(ref(party.personId), inv, { likelihood }, `${party.name}: ${OUTLOOK_LABEL[likelihood]}`);
  };

  const setStatus = (party: Party, inv: WithId<Invitation>, status: InvitationStatus) =>
    void update(ref(party.personId), inv, { status }, `${party.name}: ${INVITATION_STATUS_LABEL[status]}`);

  const takeOff = (party: Party, inv: WithId<Invitation>) => {
    if (selected === party.personId) setSelected(null);
    void update(ref(party.personId), inv, { status: 'not-inviting' }, `${party.name} is off the list (${plural(party.size, 'seat')} freed)`);
  };

  async function move(dragId: string, targetId: string | null) {
    const order = parties.map((p) => p.personId);
    const next = moveParty(order, dragId, targetId);
    if (next.every((id, i) => id === order[i])) return;
    const patches = seatOrderPatches(parties, next);
    const before = new Map(parties.map((p) => [p.personId, p.seatOrder]));
    const who = parties.find((p) => p.personId === dragId)?.name ?? 'Party';
    const target = targetId ? parties.find((p) => p.personId === targetId)?.name : null;
    await write(
      () => Promise.all(patches.map((p) => updateRecord(ref(p.personId), { seatOrder: p.seatOrder }))),
      target ? `Moved ${who} next to ${target}` : `Moved ${who} to the back`,
      () => Promise.all(patches.map((p) => updateRecord(ref(p.personId), { seatOrder: before.get(p.personId) }))),
    );
  }

  async function addBack(s: Suggestion) {
    const inv = invById.get(s.personId);
    if (inv) {
      await update(ref(s.personId), inv, { status: 'invite?' }, `${s.name} is back on the list`);
    } else {
      await write(() => createRecord(ref(s.personId), NEW_INVITATION), `${s.name} is on the list`, () => deleteRecord(ref(s.personId)));
    }
    setSelected(s.personId);
  }

  async function addNew(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const existing = data.people.find((p) => p.name.trim().toLowerCase() === n.toLowerCase());
    if (existing) {
      const s = sugg.find((x) => x.personId === existing.id);
      if (s) await addBack(s);
      else setSelected(existing.id);
      setName('');
      return;
    }
    let id = '';
    const ok = await write(async () => {
      id = await createRecord(peopleCol(), { name: n });
      await createRecord(ref(id), NEW_INVITATION);
    });
    if (ok) {
      setName('');
      setSelected(id);
      toast({
        message: `${n} added to the list`,
        undo: async () => {
          await deleteRecord(ref(id));
          await deleteRecord(personDoc(id));
        },
      });
    }
  }

  const select = (id: string | null) => {
    setSelected(id);
    if (id) rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const query = name.trim().toLowerCase();
  const matches = (s: Suggestion) => !query || s.name.toLowerCase().includes(query);
  const fresh = sugg.filter((s) => !s.countedWith && matches(s));
  const counted = sugg.filter((s) => s.countedWith && matches(s));
  const capped = !showAll && !query && fresh.length > SUGGEST_LIMIT + SUGGEST_SLACK;
  const shown = capped ? fresh.slice(0, SUGGEST_LIMIT) : fresh;
  const exact = data.people.some((p) => p.name.trim().toLowerCase() === query);
  const groups = OUTLOOKS.map((o) => ({ outlook: o, parties: parties.filter((p) => p.outlook === o) })).filter((g) => g.parties.length);
  const selInv = selParty ? invById.get(selParty.personId) : undefined;

  return (
    <div className="pl-seats">
      <section className="pl-card pl-seats-room" aria-labelledby="seats-head">
        <Score tally={tally} />
        <SeatMap
          seats={seats}
          parties={parties}
          capacity={capacity}
          lit={lit}
          dimFor={hovered}
          selected={selected}
          total={tally.total}
          onHover={setHoverSeat}
          onSelect={(id) => select(id === selected ? null : id)}
          onPickEmpty={() => {
            addRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            addRef.current?.focus({ preventScroll: true });
          }}
          onMove={(drag, target) => void move(drag, target)}
        />
        <div className="pl-seats-info" aria-live="polite">
          {selParty && selInv ? (
            <SelectionBar
              party={selParty}
              onLikelihood={(l) => setLikelihood(selParty, selInv, l)}
              onAddPlusOne={() => addPlusOne(selParty, selInv)}
              onOpen={() => onOpenPerson(selParty.personId)}
              onClose={() => setSelected(null)}
            />
          ) : hoverSeat ? (
            <p className="pl-seats-caption">
              <span className="pl-faint">{hoverSeat.over ? 'No seat' : seatName(hoverSeat.index)}</span> {seatLabel(hoverSeat)}
              {hoverSeat.party && <span className="pl-faint"> · {OUTLOOK_LABEL[hoverSeat.party.outlook]}</span>}
            </p>
          ) : (
            <p className="pl-seats-caption pl-faint">
              <GripVertical size={13} aria-hidden /> Drag a seat to move that guest and their +1s. Click a seat for options.
            </p>
          )}
        </div>
      </section>

      <div className="pl-seats-below">
        <section className="pl-card pl-seats-add" aria-labelledby="seats-add">
          <div>
            <h2 id="seats-add" className="pl-seats-h">
              <UserPlus size={16} aria-hidden /> Add a guest
            </h2>
            <p className="pl-small pl-faint pl-seats-help">
              Type their name and press Add. They start as Likely; change it in the list. Bringing a +1? Use the +1 button next to their name.
            </p>
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

        <section className="pl-seats-right" aria-label="Who’s holding seats">
          {parties.length === 0 ? (
            <p className="pl-muted">No one yet. Add people and watch the room fill.</p>
          ) : (
            groups.map((g) => (
              <div key={g.outlook} className={`pl-seats-group ${outlookClass(g.outlook)}`}>
                <h3 className="pl-seats-grouphead">
                  <span className="pl-seats-swatch" aria-hidden />
                  {OUTLOOK_LABEL[g.outlook]}
                  <span className="pl-faint">
                    {plural(g.parties.length, 'party', 'parties')} · {plural(tally.byOutlook[g.outlook], 'seat')}
                    {(g.outlook === 'maybe' || g.outlook === 'unlikely') && ` · expect ~${expectedFrom(tally.byOutlook[g.outlook], g.outlook)}`}
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
                          onStatus={(s) => setStatus(party, inv, s)}
                          onLikelihood={(l) => setLikelihood(party, inv, l)}
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
    </div>
  );
}

const seatName = (index: number) => `${rowLetter(Math.floor(index / PER_ROW))}${(index % PER_ROW) + 1}`;

/** Expected turnout, seats held, and a bar of seats by outlook against the room. */
function Score({ tally }: { tally: ReturnType<typeof tallySeats> }) {
  const over = tally.expectedFree < 0;
  const scale = Math.max(tally.capacity, tally.total);
  const cap = (tally.capacity / scale) * 100;
  return (
    <header className="pl-seats-score">
      <div className="pl-seats-numbers">
        <h2 id="seats-head" className="pl-seats-big">
          <span className={over ? 'is-over' : undefined}>~{tally.expected}</span>
          <span className="pl-seats-of">expected of {tally.capacity} seats</span>
        </h2>
        <p className="pl-seats-sub">
          <strong>{tally.total}</strong> if everyone comes ({plural(tally.guests, 'guest')} + {plural(tally.plusOnes, 'plus-one')})
          {tally.free < 0 && <span className="pl-seats-warn"> · {-tally.free} more than the room</span>}
        </p>
      </div>
      <span className={`pl-seats-free ${over ? 'is-over' : tally.expectedFree <= 3 ? 'is-tight' : ''}`}>
        {over ? `~${-tally.expectedFree} over` : tally.expectedFree === 0 ? 'Full house' : `~${tally.expectedFree} seats to spare`}
      </span>
      <div className="pl-seats-bar" aria-hidden>
        {OUTLOOKS.map((o) =>
          tally.byOutlook[o] ? <span key={o} className={outlookClass(o)} style={{ width: `${(tally.byOutlook[o] / scale) * 100}%` }} /> : null,
        )}
        <i className="pl-seats-bar-cap" style={{ left: `${cap}%` }} />
      </div>
      <ul className="pl-seats-legend" aria-label="Seats held by likelihood">
        {OUTLOOKS.map((o) => (
          <li key={o} className={outlookClass(o)}>
            <span className="pl-seats-swatch" aria-hidden />
            {OUTLOOK_LABEL[o]} <strong>{tally.byOutlook[o]}</strong>
            {(o === 'maybe' || o === 'unlikely') && tally.byOutlook[o] > 0 && <span className="pl-faint">(~{expectedFrom(tally.byOutlook[o], o)} expected)</span>}
          </li>
        ))}
        <li className="pl-seats-legend-note">
          <Send size={11} aria-hidden /> invited, no reply yet
        </li>
      </ul>
    </header>
  );
}

/**
 * The room. One grid for every row so the aisle lines up; a short back row
 * is centered on the aisle like a real theater. People past capacity sit in
 * extra rows marked "No seat". Seats are draggable: a party moves together.
 */
function SeatMap({
  seats,
  parties,
  capacity,
  lit,
  dimFor,
  selected,
  total,
  onHover,
  onSelect,
  onPickEmpty,
  onMove,
}: {
  seats: Seat[];
  parties: Party[];
  capacity: number;
  lit: string | null;
  /** Fade every party but this one (while hovering). */
  dimFor: string | null;
  selected: string | null;
  total: number;
  onHover: (s: Seat | null) => void;
  onSelect: (id: string) => void;
  onPickEmpty: () => void;
  onMove: (dragId: string, targetId: string | null) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ personId: string | null } | null>(null);
  const order = parties.map((p) => p.personId);
  const dragParty = dragId ? parties.find((p) => p.personId === dragId) ?? null : null;
  const target = dragId && over && over.personId !== dragId ? over : null;
  const side = target?.personId ? dropSide(order, dragId!, target.personId) : null;

  const short = useMemo(() => uniqueShortNames(parties.flatMap((p) => [p.name, ...p.plusOneNames])), [parties]);
  const rows = rowLengths(capacity, PER_ROW);
  const overflow = seats.slice(capacity);
  const overRows = Math.ceil(overflow.length / PER_ROW);

  const place = (seat: Seat): CSSProperties => {
    if (!seat.over) {
      const r = Math.floor(seat.index / PER_ROW);
      const len = rows[r];
      const k = seat.index - r * PER_ROW;
      const left = Math.min(HALF, Math.ceil(len / 2));
      // Left block hugs the aisle (columns 2–6), right block starts after it (8–12).
      return { gridRow: r + 1, gridColumn: k < left ? 2 + (HALF - left) + k : 8 + (k - left) };
    }
    const j = seat.index - capacity;
    const k = j % PER_ROW;
    return { gridRow: rows.length + 2 + Math.floor(j / PER_ROW), gridColumn: k < HALF ? 2 + k : 8 + (k - HALF) };
  };

  const onStart = (e: DragStartEvent) => {
    setDragId((e.active.data.current?.personId as string) ?? null);
    onHover(null);
  };
  const onOver = (e: DragOverEvent) => setOver(e.over ? { personId: (e.over.data.current?.personId as string | null) ?? null } : null);
  const onEnd = (e: DragEndEvent) => {
    const id = e.active.data.current?.personId as string | undefined;
    const to = e.over ? ((e.over.data.current?.personId as string | null) ?? null) : undefined;
    setDragId(null);
    setOver(null);
    if (id && to !== undefined && to !== id) onMove(id, to);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => (setDragId(null), setOver(null))}>
      <div className={`pl-seatmap${dragId ? ' is-dragging' : ''}`} role="group" aria-label={`Seat map: ${total} of ${capacity} seats held`}>
        <div className="pl-seatmap-screen" aria-hidden>
          <span>Screen</span>
        </div>
        <div className="pl-seatmap-grid">
          {rows.map((_, r) => [
            <span key={`l${r}`} className="pl-seatmap-letter" style={{ gridRow: r + 1, gridColumn: 1 }} aria-hidden>
              {rowLetter(r)}
            </span>,
            <span key={`r${r}`} className="pl-seatmap-letter" style={{ gridRow: r + 1, gridColumn: 13 }} aria-hidden>
              {rowLetter(r)}
            </span>,
          ])}
          {overRows > 0 && (
            <span className="pl-seatmap-overhead" style={{ gridRow: rows.length + 1, gridColumn: '1 / -1' }}>
              No seat: {plural(overflow.length, 'person', 'people')} more than the room, if everyone comes
            </span>
          )}
          {seats.map((seat) => {
            const p = seat.party;
            const first = p && seat.slot === 0;
            const last = p && seat.slot === p.size - 1;
            const isTarget = !!target && (p ? p.personId === target.personId : target.personId === null && seat.index === total);
            return (
              <SeatTile
                key={`${seat.index}:${p?.personId ?? ''}:${seat.slot}`}
                seat={seat}
                short={short}
                style={place(seat)}
                lit={!!p && lit === p.personId}
                dim={!!dimFor && !dragId && (!p || dimFor !== p.personId)}
                selected={!!p && selected === p.personId}
                dragging={!!p && dragId === p.personId}
                dropBefore={isTarget && !!first && side === 'before'}
                dropAfter={isTarget && !!last && side === 'after'}
                dropEnd={isTarget && !p}
                onHover={onHover}
                onSelect={onSelect}
                onPickEmpty={onPickEmpty}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragParty ? (
          <div className={`pl-seats-ghost ${outlookClass(dragParty.outlook)}`}>
            {dragParty.name}
            {dragParty.plusOnes > 0 && <span> +{dragParty.plusOnes}</span>}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SeatTile({
  seat,
  short,
  style,
  lit,
  dim,
  selected,
  dragging,
  dropBefore,
  dropAfter,
  dropEnd,
  onHover,
  onSelect,
  onPickEmpty,
}: {
  seat: Seat;
  short: Map<string, string>;
  style: CSSProperties;
  lit: boolean;
  dim: boolean;
  selected: boolean;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  dropEnd: boolean;
  onHover: (s: Seat | null) => void;
  onSelect: (id: string) => void;
  onPickEmpty: () => void;
}) {
  const p = seat.party;
  const data = { personId: p?.personId ?? null };
  const drag = useDraggable({ id: `seat-${seat.index}`, data, disabled: !p });
  const drop = useDroppable({ id: `drop-${seat.index}`, data });
  const setRef = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };

  const plus = !!p && seat.slot > 0;
  const named = plusOneName(seat);
  const full = !p ? '' : plus ? (named ? short.get(named) ?? named : '+1') : short.get(p.name.trim()) ?? p.name;
  const tiny = !p ? '' : plus ? (named ? initials(named) : '+1') : initials(p.name);
  const cls = [
    'pl-seat',
    p ? outlookClass(p.outlook) : 'is-empty',
    plus ? 'is-plus' : '',
    seat.over ? 'is-over' : '',
    lit ? 'is-lit' : '',
    dim ? 'is-dim' : '',
    selected ? 'is-selected' : '',
    dragging ? 'is-dragging' : '',
    dropBefore ? 'is-drop-before' : '',
    dropAfter ? 'is-drop-after' : '',
    dropEnd ? 'is-drop-end' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={setRef}
      type="button"
      className={cls}
      style={style}
      aria-label={`${seat.over ? 'No seat' : seatName(seat.index)}: ${seatLabel(seat)}${p ? `, ${OUTLOOK_LABEL[p.outlook]}` : ''}`}
      onMouseEnter={() => onHover(seat)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(seat)}
      onBlur={() => onHover(null)}
      onClick={() => (p ? onSelect(p.personId) : onPickEmpty())}
      {...(p ? drag.listeners : {})}
      {...(p ? drag.attributes : {})}
      tabIndex={p ? 0 : -1}
    >
      {p && (
        <>
          <span className="pl-seat-full">{full}</span>
          <span className="pl-seat-tiny">{tiny}</span>
          {plus && <span className="pl-seat-with">w/ {p.name.split(' ')[0]}</span>}
          {!plus && p.status === 'invited' && <Send className="pl-seat-sent" size={10} aria-hidden />}
        </>
      )}
    </button>
  );
}

/** Likely / Maybe / Likely not, as one segmented control. */
function LikelihoodPicker({ party, onChange, compact }: { party: Party; onChange: (l: Likelihood) => void; compact?: boolean }) {
  if (party.outlook === 'coming' || party.status === 'maybe') {
    return <span className={`pl-seats-replied ${outlookClass(party.outlook)}`}>{party.outlook === 'coming' ? 'Replied: coming' : 'Replied: maybe'}</span>;
  }
  return (
    <span className={`pl-seats-seg${compact ? ' is-compact' : ''}`} role="group" aria-label={`How likely is ${party.name} to come?`}>
      {LIKELIHOODS.map((l) => (
        <button key={l} type="button" className={outlookClass(l)} aria-pressed={party.outlook === l} onClick={() => onChange(l)}>
          {OUTLOOK_LABEL[l]}
        </button>
      ))}
    </span>
  );
}

function SelectionBar({
  party,
  onLikelihood,
  onAddPlusOne,
  onOpen,
  onClose,
}: {
  party: Party;
  onLikelihood: (l: Likelihood) => void;
  onAddPlusOne: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const named = party.plusOneNames.filter((n) => n.trim());
  const extra = party.plusOnes - named.length;
  return (
    <div className={`pl-seats-selbar ${outlookClass(party.outlook)}`}>
      <span className="pl-seats-swatch" aria-hidden />
      <span className="pl-seats-selname">
        <strong>{party.name}</strong>
        {party.plusOnes > 0 && (
          <span className="pl-faint">
            {' '}
            + {[...named, ...(extra > 0 ? [plural(extra, 'guest')] : [])].join(', ')}
          </span>
        )}
        <span className="pl-faint"> · {STAGE_LABEL[party.status]}</span>
      </span>
      <LikelihoodPicker party={party} onChange={onLikelihood} />
      <button type="button" className="pl-seats-addone" onClick={onAddPlusOne} disabled={party.plusOnes >= 9} aria-label={`Add a +1 for ${party.name}`}>
        <Plus size={13} aria-hidden />1
      </button>
      <button type="button" className="pl-btn pl-btn-quiet pl-btn-sm" onClick={onOpen}>
        Details
      </button>
      <button type="button" className="pl-seats-remove is-shown" onClick={onClose} aria-label="Clear selection">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/** Invitation stage as a quiet pill that is really a native <select>. */
function StagePicker({ value, onChange, label }: { value: InvitationStatus; onChange: (s: InvitationStatus) => void; label: string }) {
  return (
    <span className={`pl-seats-stage is-${value === 'invite?' ? 'unsent' : value}`} title="Invitation: change">
      {value === 'invited' && <Send size={11} aria-hidden />}
      {STAGE_LABEL[value]}
      <ChevronDown size={11} aria-hidden />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as InvitationStatus)}>
        {INVITATION_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
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
  onLikelihood,
  onAddPlusOne,
  onRemovePlusOne,
  onNamePlusOne,
  onRemove,
}: {
  party: Party;
  lit: boolean;
  onOpen: () => void;
  onStatus: (s: InvitationStatus) => void;
  onLikelihood: (l: Likelihood) => void;
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
      <div className="pl-seats-who">
        <span className="pl-seats-whohead">
          <button type="button" className="pl-seats-name" onClick={onOpen} title="Open details">
            {party.name}
          </button>
          <StagePicker value={party.status} onChange={onStatus} label={`Invitation for ${party.name}`} />
        </span>
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
                      {n || '+1 · add name'}
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
      <LikelihoodPicker party={party} onChange={onLikelihood} compact />
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
