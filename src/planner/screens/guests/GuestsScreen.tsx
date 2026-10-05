import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived } from '../../hooks/useDerived';
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/Basics';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { DrawerFrame } from '../../components/ui/Drawer';
import HeadcountSummary from '../../components/blocks/HeadcountSummary';
import { projectionBasis } from '../../logic/home';
import { capacityVerdict } from '../../logic/headcount';
import { plural } from '../../logic/dates';
import PersonPanel from './PersonPanel';
import GuestList from './GuestList';
import SendInvites from './SendInvites';
import Replies from './Replies';
import Waiting from './Waiting';
import FinalNumbers from './FinalNumbers';
import './guests.css';

type View = 'list' | 'send' | 'replies' | 'waiting' | 'final';
const VIEWS: View[] = ['list', 'send', 'replies', 'waiting', 'final'];

/**
 * Guests: build the list against capacity, send invitations, file replies,
 * nudge the quiet ones, and lock the final numbers. `?view=…`, `?person=…`.
 */
export default function GuestsScreen() {
  const { season, data, inbox, phase } = usePlanner();
  const d = useDerived();
  const [params, setParams] = useSearchParams();
  const raw = params.get('view') as View | null;
  const view: View = raw && VIEWS.includes(raw) ? raw : 'list';
  const personId = params.get('person');

  const openPerson = (id: string) => {
    const p = new URLSearchParams(params);
    p.set('person', id);
    setParams(p);
  };
  const closePerson = () => {
    const p = new URLSearchParams(params);
    p.delete('person');
    setParams(p);
  };

  if (!season) {
    return (
      <EmptyState icon={Users} title="No season yet" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create a season</Link>}>
        The guest list belongs to a season.
      </EmptyState>
    );
  }
  if (!d || !phase) return <div className="pl-page"><Skeleton rows={2} label="Loading guests" /><Skeleton rows={8} /></div>;

  const basis = projectionBasis(phase.id);
  const invitesOut = d.send.sent > 0;
  const booked = data.venues.find((v) => v.id === season.venueOptionId);
  const answers: Record<View, string> = {
    list: capacityVerdict(d.projection, basis).text,
    send: d.send.toSend ? `${d.send.sent} of ${d.send.total} invitations sent. ${plural(d.send.toSend, 'person', 'people')} ready to invite.` : d.send.total ? 'Every invitation is out.' : 'Put people on the list first.',
    replies: inbox.length ? `${plural(inbox.length, 'new RSVP')} to file.` : 'All caught up.',
    waiting: d.waiting.length ? `${plural(d.waiting.length, 'guest')} haven’t replied yet.` : 'No one to chase.',
    final: `${d.projection.confirmed.total} coming, counting plus-ones${d.projection.capacity !== null ? ` · ${d.projection.capacity - d.projection.confirmed.total} seats free` : ''}.`,
  };

  return (
    <>
      <div className="pl-page">
        <PageHeader title="Guests" answer={answers[view]} />
        <ViewTabs<View>
          label="Guest views"
          current={view}
          defaultView="list"
          views={[
            { id: 'list', label: 'Guest list', count: data.invitations.filter((i) => i.status !== 'not-inviting').length },
            { id: 'send', label: 'Send invitations', count: d.send.toSend },
            { id: 'replies', label: 'Replies', count: inbox.length, attention: true },
            { id: 'waiting', label: 'Waiting', count: invitesOut ? d.waiting.length : undefined },
            { id: 'final', label: 'Final numbers' },
          ]}
        />
        {(view === 'list' || view === 'send') && (
          <div className="pl-card pl-guests-headcount">
            <HeadcountSummary season={season} projection={d.projection} basis={basis} phase={phase.id} venueName={booked?.name} />
          </div>
        )}
        {view === 'list' && <GuestList derived={d} phase={phase.id} onOpenPerson={openPerson} />}
        {view === 'send' && <SendInvites derived={d} onOpenPerson={openPerson} />}
        {view === 'replies' && <Replies onOpenPerson={openPerson} />}
        {view === 'waiting' && <Waiting derived={d} onOpenPerson={openPerson} highlight={personId} />}
        {view === 'final' && <FinalNumbers derived={d} onOpenPerson={openPerson} />}
      </div>
      {personId && data.peopleById.has(personId) && (
        <DrawerFrame onClose={closePerson}>
          <PersonPanel key={personId} personId={personId} data={data} onClose={closePerson} />
        </DrawerFrame>
      )}
    </>
  );
}
