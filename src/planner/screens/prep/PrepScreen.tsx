import { Link, useSearchParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived } from '../../hooks/useDerived';
import { EmptyState, PageHeader, Section, Skeleton } from '../../components/ui/Basics';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { plural } from '../../logic/dates';
import Venues from './Venues';
import Questions from './Questions';
import Checklist from './Checklist';
import { useScrollTo } from './useScrollTo';
import './prep.css';

type View = 'all' | 'venues' | 'questions' | 'checklist';
const VIEWS: View[] = ['all', 'venues', 'questions', 'checklist'];

/** Venue, open questions and the checklist. Deep links: `?venue=`, `?question=`, `?task=`. */
export default function PrepScreen() {
  const { season, data, today } = usePlanner();
  const d = useDerived();
  const [params] = useSearchParams();
  const venueId = params.get('venue');
  const questionId = params.get('question');
  const taskId = params.get('task');
  const raw = params.get('view') as View | null;
  const view: View = raw && VIEWS.includes(raw) ? raw : venueId ? 'venues' : questionId ? 'questions' : taskId ? 'checklist' : 'all';
  const target = venueId ? `venue-${venueId}` : questionId ? `question-${questionId}` : taskId ? `task-${taskId}` : null;
  useScrollTo(target, Boolean(d));

  if (!season) {
    return <EmptyState icon={ListChecks} title="No season yet" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create a season</Link>}>Venues and to-dos belong to a season.</EmptyState>;
  }
  if (!d) return <div className="pl-page"><Skeleton rows={2} label="Loading" /><Skeleton rows={8} /></div>;

  const booked = data.venues.find((v) => v.id === season.venueOptionId) ?? data.venues.find((v) => v.status === 'booked');
  const openQ = data.questions.filter((q) => q.status === 'open');
  const lateQ = openQ.filter((q) => q.dueDate && q.dueDate < today).length;
  const openT = data.checklist.filter((c) => !c.done);
  const lateT = openT.filter((c) => c.dueDate && c.dueDate < today).length;
  const parts = [
    booked ? `${booked.name} is booked` : `No venue booked (${plural(data.venues.filter((v) => v.status !== 'declined').length, 'option')})`,
    `${plural(openQ.length, 'open question')}${lateQ ? ` (${lateQ} overdue)` : ''}`,
    `${plural(openT.length, 'task')} to do${lateT ? ` (${lateT} overdue)` : ''}`,
  ];

  return (
    <div className="pl-page">
      <PageHeader title="Venue & to-dos" answer={`${parts.join(' · ')}.`} />
      <ViewTabs<View>
        label="Sections"
        current={view}
        defaultView="all"
        views={[
          { id: 'all', label: 'Everything' },
          { id: 'venues', label: 'Venue', count: booked ? undefined : data.venues.length },
          { id: 'questions', label: 'Questions', count: openQ.length, attention: lateQ > 0 },
          { id: 'checklist', label: 'Checklist', count: openT.length, attention: lateT > 0 },
        ]}
      />
      {view === 'all' ? (
        <>
          <Section title="Open questions" aside={<Link to="/plan/prep?view=questions">All questions →</Link>}>
            <Questions highlight={questionId} compact />
          </Section>
          <Section title="Checklist" aside={<Link to="/plan/prep?view=checklist">Full checklist →</Link>}>
            <Checklist highlight={taskId} />
          </Section>
          <Section title={booked ? 'Venue' : 'Venue options'} aside={<Link to="/plan/prep?view=venues">Compare →</Link>}>
            <Venues derived={d} highlight={venueId} />
          </Section>
        </>
      ) : view === 'venues' ? (
        <Venues derived={d} highlight={venueId} />
      ) : view === 'questions' ? (
        <Questions highlight={questionId} />
      ) : (
        <Checklist highlight={taskId} />
      )}
    </div>
  );
}
