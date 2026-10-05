import { Link } from 'react-router-dom';
import { Coffee, HelpCircle, Mic, Printer, Users } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import type { Derived } from '../../hooks/useDerived';
import { StatCard, Section } from '../../components/ui/Basics';
import { presentingIds } from '../../logic/headcount';

function People({ ids, empty, nameOf, onOpenPerson }: { ids: string[]; empty: string; nameOf: (id: string) => string; onOpenPerson: (id: string) => void }) {
  if (!ids.length) return <p className="pl-muted">{empty}</p>;
  return (
    <p className="pl-people-inline">
      {ids.map((id, i) => (
        <span key={id}>
          <button type="button" className="pl-link-btn" onClick={() => onOpenPerson(id)}>
            {nameOf(id)}
          </button>
          {i < ids.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  );
}

/** Show-week numbers: who's coming, brunch, presenters, maybes, and the door list. */
export default function FinalNumbers({ derived, onOpenPerson }: { derived: Derived; onOpenPerson: (id: string) => void }) {
  const { data } = usePlanner();
  const p = derived.projection;
  const presenting = presentingIds(data.pieces);
  const nameOf = (id: string) => data.peopleById.get(id)?.name ?? 'Unknown';
  const byName = (ids: string[]) => ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const maybes = byName(data.invitations.filter((i) => i.status === 'maybe').map((i) => i.id));
  const noReply = byName(data.invitations.filter((i) => i.status === 'invited').map((i) => i.id));
  const presenters = byName([...presenting].filter((id) => data.peopleById.has(id)));
  const free = p.capacity === null ? null : p.capacity - p.confirmed.total;

  return (
    <div className="pl-stack pl-final">
      <div className="pl-stats">
        <StatCard label="Coming" icon={Users} value={p.confirmed.total} sub={`${p.confirmed.people} guests + ${p.confirmed.plusOnes} plus-ones`} tone="good" />
        <StatCard label="Brunch" icon={Coffee} value={p.brunch.total} sub={`${p.brunch.people} guests + ${p.brunch.plusOnes} plus-ones`} />
        <StatCard label="Presenting" icon={Mic} value={presenters.length} sub="guests with a presentation" />
        <StatCard label="Still maybe" icon={HelpCircle} value={p.counts.maybe} sub={`+ ${p.counts.invited} no reply`} tone={p.counts.maybe + p.counts.invited ? 'warn' : 'neutral'} />
        {free !== null && <StatCard label="Seats free" value={free} sub={`of ${p.capacity}`} tone={free < 0 ? 'danger' : 'neutral'} />}
      </div>
      <div className="pl-row">
        <Link to="/plan/guests/door" className="pl-btn pl-btn-primary">
          <Printer size={16} aria-hidden /> Door list
        </Link>
        <span className="pl-small pl-muted">Alphabetical, with plus-ones and brunch, ready to print.</span>
      </div>
      <Section title={`Maybe (${maybes.length})`}>
        <People nameOf={nameOf} onOpenPerson={onOpenPerson} ids={maybes} empty="No maybes." />
      </Section>
      <Section title={`No reply (${noReply.length})`}>
        <People nameOf={nameOf} onOpenPerson={onOpenPerson} ids={noReply} empty="Everyone has answered." />
      </Section>
      <Section title={`Presenting (${presenters.length})`}>
        <People nameOf={nameOf} onOpenPerson={onOpenPerson} ids={presenters} empty="No guest presentations." />
      </Section>
    </div>
  );
}
