import { useState, type FormEvent } from 'react';
import { CalendarClock, CheckCircle2, ExternalLink, MapPin, Phone, Plus, Trash2 } from 'lucide-react';
import { createRecord, deleteRecord, seasonCol, seasonDoc, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import type { Derived } from '../../hooks/useDerived';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Chip, ChipSelect } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { InlineText } from '../../components/ui/InlineText';
import { VENUE_OPTIONS } from '../../components/status';
import { dueLabel, relativeDay } from '../../logic/dates';
import { VENUE_STATUS_LABEL } from '../../logic/labels';
import { venueFit, VENUE_FIT_LABEL, type VenueFit } from '../../logic/venues';
import type { Venue, WithId } from '../../types';

const FIT_TONE: Record<VenueFit, 'good' | 'warn' | 'danger' | 'faint'> = { fits: 'good', tight: 'warn', small: 'danger', unknown: 'faint' };

/** Venue options side by side, each measured against the projected headcount. */
export default function Venues({ derived, highlight }: { derived: Derived; highlight: string | null }) {
  const { season, data, today } = usePlanner();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const [name, setName] = useState('');
  const [booking, setBooking] = useState<WithId<Venue> | null>(null);
  const [removing, setRemoving] = useState<WithId<Venue> | null>(null);
  if (!season) return null;
  const sid = season.id;
  const p = derived.projection;
  const venues = [...data.venues].sort(
    (a, b) => Number(a.status === 'declined') - Number(b.status === 'declined') || Number(b.status === 'booked') - Number(a.status === 'booked') || a.name.localeCompare(b.name),
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (await write(() => createRecord(seasonCol(sid, 'venues'), { name: n, status: 'researching', links: [] }), `Added ${n}`)) setName('');
  }

  async function book(v: WithId<Venue>, makeSeasonVenue: boolean) {
    setBooking(null);
    const before = { venueOptionId: season!.venueOptionId, capacity: season!.capacity };
    await write(
      async () => {
        await updateRecord(seasonSubDoc(sid, 'venues', v.id), { status: 'booked' });
        if (makeSeasonVenue) await updateRecord(seasonDoc(sid), { venueOptionId: v.id, ...(v.capacity ? { capacity: v.capacity } : {}) });
      },
      `${v.name} booked${makeSeasonVenue ? ' as this season’s venue' : ''}`,
      async () => {
        await updateRecord(seasonSubDoc(sid, 'venues', v.id), { status: v.status });
        if (makeSeasonVenue) await updateRecord(seasonDoc(sid), before);
      },
    );
  }

  const patch = (v: WithId<Venue>, fields: Partial<Venue>, msg: string) => void update(seasonSubDoc(sid, 'venues', v.id), v, fields, `${v.name}: ${msg}`);
  const num = (s: string) => (s === '' || !Number.isFinite(Number(s)) ? undefined : Math.max(0, Number(s)));

  return (
    <div className="pl-stack">
      <p className="pl-small pl-muted">
        Measured against your guest list: {p.everyone.total} if everyone listed comes, {p.likely.total} likely, {p.confirmed.total} confirmed.
      </p>
      {venues.length === 0 ? (
        <EmptyState icon={MapPin} title="No venue options yet" compact>
          Add each place you’re considering; you’ll see right away whether it fits the guest list.
        </EmptyState>
      ) : (
        <div className="pl-venues">
          {venues.map((v) => {
            const fit = venueFit(v, p);
            const isSeason = season.venueOptionId === v.id;
            return (
              <article key={v.id} id={`venue-${v.id}`} className={`pl-card pl-venue${isSeason ? ' is-headline' : ''}${v.status === 'declined' ? ' is-dim' : ''}${highlight === v.id ? ' is-highlight' : ''}`}>
                <header className="pl-row is-between">
                  <h3 className="pl-venue-name">
                    <InlineText value={v.name} label="Venue name" allowEmpty={false} onSave={(n) => patch(v, { name: n }, 'renamed')} />
                  </h3>
                  <ChipSelect
                    value={v.status}
                    options={VENUE_OPTIONS}
                    label={`Status of ${v.name}`}
                    onChange={(status) => (status === 'booked' ? setBooking(v) : patch(v, { status }, VENUE_STATUS_LABEL[status]))}
                  />
                </header>
                {isSeason && <Chip tone="good" icon={CheckCircle2}>This season’s venue</Chip>}
                <div className="pl-venue-fit">
                  <Chip tone={FIT_TONE[fit]}>{VENUE_FIT_LABEL[fit]}</Chip>
                </div>
                <dl className="pl-props">
                  <dt>Capacity</dt>
                  <dd><InlineText value={v.capacity?.toString() ?? ''} label="Capacity" placeholder="Add" onSave={(s) => patch(v, { capacity: num(s) }, 'capacity')} /></dd>
                  <dt>Quote</dt>
                  <dd>$<InlineText value={v.quoteUsd?.toString() ?? ''} label="Quote in dollars" placeholder="Add" onSave={(s) => patch(v, { quoteUsd: num(s) }, 'quote')} /></dd>
                  <dt>Dates</dt>
                  <dd><InlineText value={v.datesOffered ?? ''} label="Dates offered" placeholder="Add" onSave={(s) => patch(v, { datesOffered: s || undefined }, 'dates')} /></dd>
                  <dt>Deposit due</dt>
                  <dd>
                    <input type="date" className="pl-date-inline" value={v.depositDue ?? ''} aria-label="Deposit due" onChange={(e) => patch(v, { depositDue: e.target.value || undefined }, 'deposit date')} />
                    {v.depositDue && v.status !== 'declined' && <span className={`pl-small ${v.depositDue < today ? 'pl-danger-text' : 'pl-muted'}`}> {dueLabel(v.depositDue, today)}</span>}
                  </dd>
                  <dt>Last contact</dt>
                  <dd className="pl-row">
                    <span className="pl-small">{v.lastContactDate ? relativeDay(v.lastContactDate, today) : 'Never'}</span>
                    <button type="button" className="pl-btn pl-btn-sm pl-btn-quiet" onClick={() => patch(v, { lastContactDate: today }, 'contact logged')}>
                      <Phone size={13} aria-hidden /> Log contact
                    </button>
                  </dd>
                  <dt>Notes</dt>
                  <dd><InlineText value={v.notes ?? ''} label="Notes" placeholder="Add a note" onSave={(s) => patch(v, { notes: s || undefined }, 'notes')} /></dd>
                </dl>
                <footer className="pl-row is-between">
                  <span className="pl-row">
                    {(v.links ?? []).map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="pl-small">
                        {l.label} <ExternalLink size={12} aria-hidden />
                      </a>
                    ))}
                  </span>
                  <span className="pl-row">
                    {!isSeason && v.status !== 'declined' && (
                      <button type="button" className="pl-btn pl-btn-sm" onClick={() => setBooking(v)}>
                        <CalendarClock size={14} aria-hidden /> Book this one
                      </button>
                    )}
                    <button type="button" className="pl-icon-btn" onClick={() => setRemoving(v)} aria-label={`Delete ${v.name}`}>
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <form className="pl-toolbar" onSubmit={add}>
        <input className="pl-grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a venue option" aria-label="Add a venue option" />
        <button type="submit" className="pl-btn" disabled={!name.trim()}>
          <Plus size={16} aria-hidden /> Add venue
        </button>
      </form>

      {booking && (
        <BookDialog venue={booking} isSeason={season.venueOptionId === booking.id} onBook={(make) => void book(booking, make)} onCancel={() => setBooking(null)} />
      )}
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          message="This removes the venue option. It can’t be undone."
          confirmLabel="Delete venue"
          onConfirm={() => {
            const v = removing;
            setRemoving(null);
            void write(() => deleteRecord(seasonSubDoc(sid, 'venues', v.id)), `Deleted ${v.name}`);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function BookDialog({ venue, isSeason, onBook, onCancel }: { venue: WithId<Venue>; isSeason: boolean; onBook: (makeSeasonVenue: boolean) => void; onCancel: () => void }) {
  return (
    <ConfirmDialog
      title={`Book ${venue.name}?`}
      message={
        isSeason
          ? 'Marks it booked.'
          : `Marks it booked and makes it this season’s venue${venue.capacity ? `, setting the capacity to ${venue.capacity}` : ''}. You can undo this.`
      }
      confirmLabel={isSeason ? 'Mark booked' : 'Book and use it'}
      tone="primary"
      secondary={isSeason ? undefined : { label: 'Just mark booked', onClick: () => onBook(false) }}
      onConfirm={() => onBook(!isSeason)}
      onCancel={onCancel}
    />
  );
}
