import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Lightbulb,
  MapPin,
  PartyPopper,
  Send,
  Sparkles,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react';
import { seasonDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived, type Derived } from '../../hooks/useDerived';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { useOpenPalette } from '../../components/paletteContext';
import HeadcountSummary from '../../components/blocks/HeadcountSummary';
import ClockSummary from '../../components/blocks/ClockSummary';
import { EmptyState, Skeleton } from '../../components/ui/Basics';
import { Chip, ChipSelect, type ChipOption } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/Progress';
import { formatLongDay, plural } from '../../logic/dates';
import { deckPipeline, DECK_STAGES } from '../../logic/contributors';
import { projectionBasis, type HomeAction } from '../../logic/home';
import { IDEA_TAG_LABEL } from '../../logic/labels';
import { needsNudge } from '../../logic/invites';
import { PHASES, phaseInfo, relevance, type InfoBlock } from '../../logic/phase';
import { venueFit, VENUE_FIT_LABEL } from '../../logic/venues';
import type { PhaseId } from '../../types';
import ActionRow from './ActionRow';
import './home.css';

function Card({ title, icon: Icon, href, linkText, children, headline }: { title: string; icon: typeof Users; href: string; linkText: string; children: ReactNode; headline: boolean }) {
  return (
    <section className={`pl-card pl-home-card${headline ? ' is-headline' : ''}`} aria-label={title}>
      <header className="pl-home-card-head">
        <h2>
          <Icon size={16} aria-hidden /> {title}
        </h2>
        <Link to={href} className="pl-small">
          {linkText} →
        </Link>
      </header>
      {children}
    </section>
  );
}

function PhaseStepper({ current, derived, overridden, reason }: { current: PhaseId; derived: PhaseId; overridden: boolean; reason: string }) {
  const { season } = usePlanner();
  const update = useUndoableUpdate();
  const idx = PHASES.findIndex((p) => p.id === current);
  const options: ChipOption<string>[] = [
    { value: 'auto', label: `Automatic (${phaseInfo(derived).label})` },
    ...PHASES.map((p) => ({ value: p.id, label: p.label })),
  ];
  return (
    <div className="pl-phase">
      <ol className="pl-phase-steps" aria-label="Season phases">
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < idx ? 'is-past' : i === idx ? 'is-current' : undefined} aria-current={i === idx ? 'step' : undefined}>
            <span className="pl-phase-step-dot" aria-hidden>{i < idx ? '✓' : i + 1}</span>
            <span className="pl-phase-step-label">{p.label}</span>
          </li>
        ))}
      </ol>
      <p className="pl-small pl-muted pl-phase-why">
        {overridden ? `Set by hand. The data says ${phaseInfo(derived).label.toLowerCase()}: ${reason.toLowerCase()}` : `Why: ${reason}`}{' '}
        {season && (
          <ChipSelect
            value={overridden ? current : 'auto'}
            options={options}
            label="Change phase"
            onChange={(v) =>
              void update(seasonDoc(season.id), season, { phaseOverride: v === 'auto' ? undefined : (v as PhaseId) }, v === 'auto' ? 'Phase back to automatic' : `Phase set to ${phaseInfo(v as PhaseId).label}`)
            }
          />
        )}
      </p>
    </div>
  );
}

/** The phase-aware blocks; the relevance matrix decides which lead, which follow, which stay off. */
function useBlocks(d: Derived | null, phase: PhaseId) {
  const { season, data, inbox, today } = usePlanner();
  const openPalette = useOpenPalette();
  return useMemo(() => {
    if (!season || !d) return [];
    const blocks: { id: InfoBlock; node: ReactNode }[] = [];
    const h = (id: InfoBlock) => relevance(id, phase) === 'headline';
    const booked = data.venues.find((v) => v.id === season.venueOptionId) ?? data.venues.find((v) => v.status === 'booked');

    blocks.push({
      id: 'projectedHeadcount',
      node: (
        <Card title="Guest list" icon={Users} href="/plan/guests" linkText="Guest list" headline={h('projectedHeadcount')}>
          <HeadcountSummary season={season} projection={d.projection} basis={projectionBasis(phase)} phase={phase} venueName={booked?.name} compact />
        </Card>
      ),
    });
    blocks.push({
      id: 'finalNumbers',
      node: (
        <Card title="Final numbers" icon={Users} href="/plan/guests?view=final" linkText="Final numbers & door list" headline={h('finalNumbers')}>
          <div className="pl-home-stats">
            <div><b className="pl-num">{d.projection.confirmed.total}</b><span>coming ({d.projection.confirmed.people} + {d.projection.confirmed.plusOnes} plus-ones)</span></div>
            <div><b className="pl-num">{d.projection.brunch.total}</b><span>at brunch ({d.projection.brunch.people} + {d.projection.brunch.plusOnes})</span></div>
            <div><b className="pl-num">{d.projection.counts.maybe}</b><span>still maybe</span></div>
            {d.projection.capacity !== null && <div><b className="pl-num">{d.projection.capacity - d.projection.confirmed.total}</b><span>seats free</span></div>}
          </div>
        </Card>
      ),
    });
    if (d.send.total > 0) {
      blocks.push({
        id: 'sendProgress',
        node: (
          <Card title="Invitations" icon={Send} href="/plan/guests?view=send" linkText={d.send.toSend ? 'Send invitations' : 'See invitations'} headline={h('sendProgress')}>
            <p className="pl-home-big"><span className="pl-num">{d.send.sent}</span> of {d.send.total} sent</p>
            <ProgressBar value={d.send.sent} max={d.send.total} label="Invitations sent" />
            <p className="pl-small pl-muted">{d.send.toSend ? `${plural(d.send.toSend, 'person', 'people')} on the list still to invite.` : 'Everyone on the list has been invited.'}</p>
          </Card>
        ),
      });
    }
    blocks.push({
      id: 'rsvpInbox',
      node: (
        <Card title="New RSVPs" icon={Inbox} href="/plan/guests?view=replies" linkText="File them" headline={h('rsvpInbox') && inbox.length > 0}>
          {inbox.length ? (
            <p className="pl-home-big"><span className="pl-num">{inbox.length}</span> to file</p>
          ) : (
            <p className="pl-muted"><CheckCircle2 size={14} aria-hidden /> All caught up.</p>
          )}
        </Card>
      ),
    });
    blocks.push({
      id: 'rsvpCounts',
      node: (
        <Card title="Replies so far" icon={Users} href="/plan/guests" linkText="Guest list" headline={h('rsvpCounts')}>
          <div className="pl-row">
            <Chip tone="good" icon={CheckCircle2}>{d.projection.counts.confirmed} coming</Chip>
            <Chip tone="warn">{d.projection.counts.maybe} maybe</Chip>
            <Chip tone="info" icon={Send}>{d.projection.counts.invited} no reply yet</Chip>
            <Chip tone="faint">{d.projection.counts.declined} can’t come</Chip>
          </div>
        </Card>
      ),
    });
    const nudge = d.waiting.filter(needsNudge);
    blocks.push({
      id: 'waitingOnReplies',
      node: (
        <Card title="Waiting on replies" icon={Send} href="/plan/guests?view=waiting" linkText="Nudge" headline={h('waitingOnReplies')}>
          <p>{d.waiting.length ? <><b>{d.waiting.length}</b> haven’t replied{nudge.length ? <>; <b>{nudge.length}</b> for two weeks or more.</> : '.'}</> : 'Everyone invited has replied.'}</p>
        </Card>
      ),
    });
    if (data.segments.length) {
      blocks.push({
        id: 'clockVerdict',
        node: (
          <Card title="Show clock" icon={CalendarDays} href="/plan/show" linkText="Run of show" headline={h('clockVerdict')}>
            <ClockSummary totals={d.schedule.totals} verdict={d.verdict} compact={!h('clockVerdict')} />
          </Card>
        ),
      });
    }
    const mine = d.now.make.filter((i) => i.kind === 'piece');
    blocks.push({
      id: 'makeQueue',
      node: (
        <Card title="My queue" icon={Wand2} href="/plan/make" linkText="Open my queue" headline={h('makeQueue')}>
          <p>{mine.filter((i) => !i.dim).length} ready to work on · {mine.filter((i) => i.dim).length} waiting on something</p>
        </Card>
      ),
    });
    const pipe = deckPipeline(data.pieces, today);
    const decks = Object.values(pipe).flat();
    if (decks.length) {
      blocks.push({
        id: 'contributorPipeline',
        node: (
          <Card title="Guest presentations" icon={Sparkles} href="/plan/make?view=guests" linkText="Pipeline" headline={h('contributorPipeline')}>
            <div className="pl-home-pipe">
              {DECK_STAGES.map((s) => (
                <div key={s.id}><b className="pl-num">{pipe[s.id].length}</b><span>{s.label}</span></div>
              ))}
            </div>
            {decks.some((c) => c.overdue) && <p className="pl-small pl-danger-text">{plural(decks.filter((c) => c.overdue).length, 'deck')} overdue</p>}
          </Card>
        ),
      });
    }
    const undecided = data.awards.filter((a) => a.stage !== 'cut' && a.stage !== 'idea' && !a.winnerContenderId);
    blocks.push({
      id: 'awardDecisions',
      node: (
        <Card title="Awards" icon={Trophy} href="/plan/make?view=awards" linkText="Awards" headline={h('awardDecisions')}>
          <p>{data.awards.length === 0 ? 'No awards yet. Start from last year, or promote an idea.' : undecided.length ? `${plural(undecided.length, 'award')} still need a winner.` : 'Every award has a winner.'} {data.awards.filter((a) => a.stage === 'idea').length > 0 && `${data.awards.filter((a) => a.stage === 'idea').length} still ideas.`}</p>
        </Card>
      ),
    });
    if (!booked) {
      blocks.push({
        id: 'venueChoice',
        node: (
          <Card title="Venue" icon={MapPin} href="/plan/prep?view=venues" linkText="Compare venues" headline={h('venueChoice')}>
            {data.venues.length === 0 ? (
              <p className="pl-muted">No options yet. Add the places you’re considering.</p>
            ) : (
              <ul className="pl-home-mini">
                {data.venues.filter((v) => v.status !== 'declined').slice(0, 4).map((v) => (
                  <li key={v.id}>
                    <Link to={`/plan/prep?venue=${v.id}`}>{v.name}</Link>
                    <span className="pl-muted pl-small">{v.capacity ? `${v.capacity} seats · ` : ''}{VENUE_FIT_LABEL[venueFit(v, d.projection)]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ),
      });
    }
    const due = data.checklist.filter((c) => !c.done && c.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    blocks.push({
      id: 'checklistDue',
      node: (
        <Card title="Checklist" icon={ClipboardList} href="/plan/prep?view=checklist" linkText="Checklist" headline={h('checklistDue')}>
          <p>{due.length ? `${due.length} open · next: ${due[0].text}` : 'Nothing open.'}</p>
        </Card>
      ),
    });
    const open = d.ready.filter((r) => !r.done);
    blocks.push({
      id: 'readiness',
      node: (
        <Card title="Show-week checklist" icon={CheckCircle2} href="/plan/show/ready" linkText="Open" headline={h('readiness')}>
          <p className="pl-home-big"><span className="pl-num">{d.ready.length - open.length}</span> of {d.ready.length} ready</p>
          <ProgressBar value={d.ready.length - open.length} max={d.ready.length} tone={open.length ? 'accent' : 'good'} label="Show-week readiness" />
          {open[0] && <p className="pl-small pl-muted">Next: {open[0].label}</p>}
        </Card>
      ),
    });
    const fresh = data.ideas.filter((i) => !i.promotedTo).slice(-3).reverse();
    blocks.push({
      id: 'ideasInbox',
      node: (
        <Card title="Ideas" icon={Lightbulb} href="/plan/ideas" linkText="Ideas" headline={h('ideasInbox')}>
          {fresh.length ? (
            <ul className="pl-home-mini">
              {fresh.map((i) => (
                <li key={i.id}><span>{i.text}</span><span className="pl-muted pl-small">{IDEA_TAG_LABEL[i.tag]}</span></li>
              ))}
            </ul>
          ) : (
            <p className="pl-muted">No ideas waiting.</p>
          )}
          <button type="button" className="pl-btn pl-btn-sm" onClick={() => openPalette('capture')}>Capture an idea</button>
        </Card>
      ),
    });
    blocks.push({
      id: 'wrapUp',
      node: (
        <Card title="Wrap up" icon={PartyPopper} href="/plan/season" linkText="Set up next season" headline={h('wrapUp')}>
          <p>Thank the presenters and helpers, note what to keep for next year, then start {season.year + 1} from this season.</p>
        </Card>
      ),
    });
    return blocks.filter((b) => relevance(b.id, phase) !== 'hidden');
  }, [d, phase, season, data, inbox.length, today, openPalette]);
}

function EverythingElse({ actions }: { actions: HomeAction[] }) {
  const groups: { id: HomeAction['group']; title: string; hint: string }[] = [
    { id: 'decide', title: 'Decide', hint: 'Open questions and choices holding up work' },
    { id: 'chase', title: 'Chase', hint: 'Who owes you something' },
    { id: 'make', title: 'Make', hint: 'Your next steps, then what’s due soon' },
  ];
  return (
    <details className="pl-everything">
      <summary>
        Everything else <span className="pl-muted">{actions.length}</span>
      </summary>
      <div className="pl-grid-3 pl-everything-grid">
        {groups.map((g) => {
          const list = actions.filter((a) => a.group === g.id);
          return (
            <section key={g.id} aria-label={g.title}>
              <h3>{g.title} <span className="pl-muted">{list.length || ''}</span></h3>
              <p className="pl-small pl-faint">{g.hint}</p>
              {list.length ? (
                <ul className="pl-list">
                  {list.map((a) => (
                    <li key={a.key} className={a.priority <= 20 ? 'is-dim' : undefined}>
                      <ActionRow action={a} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pl-muted pl-small">Nothing here.</p>
              )}
            </section>
          );
        })}
      </div>
    </details>
  );
}

export default function HomeScreen() {
  const { season, data, phase } = usePlanner();
  const d = useDerived();
  const blocks = useBlocks(d, phase?.id ?? 'setup');

  if (!season) {
    return (
      <div className="pl-page is-narrow">
        <EmptyState icon={CalendarDays} title="Welcome to the Sharemony Planner" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create your first season</Link>}>
          <p>Everything here belongs to a season: the run of show, awards, guests, venue and to-dos. Start by creating one; you can bring in last year’s data afterwards.</p>
        </EmptyState>
      </div>
    );
  }
  if (data.error) return <p className="pl-error">Couldn’t load: {data.error.message}</p>;
  if (!d || !phase) {
    return (
      <div className="pl-page">
        <Skeleton rows={2} label="Loading home" />
        <Skeleton rows={5} />
      </div>
    );
  }

  const info = phaseInfo(phase.id);
  const days = phase.daysToShow;
  const title =
    days === null ? 'Set the show date' : days > 1 ? `${days} days to the show` : days === 1 ? 'The show is tomorrow' : days === 0 ? 'It’s show day' : 'The show is done';
  const top = d.actions.filter((a) => a.priority > 20).slice(0, 3);
  const rest = d.actions.filter((a) => !top.includes(a));
  const headline = blocks.filter((b) => relevance(b.id, phase.id) === 'headline');
  const supporting = blocks.filter((b) => relevance(b.id, phase.id) === 'supporting');

  return (
    <div className="pl-page pl-home">
      <header className="pl-home-hero">
        <p className="pl-eyebrow">{season.name}{season.showDate ? ` · ${formatLongDay(season.showDate)}` : ''}</p>
        <h1>{title}</h1>
        <p className="pl-page-answer">
          <strong>{info.label}.</strong> {info.focus}
        </p>
        <PhaseStepper current={phase.id} derived={phase.derived} overridden={phase.overridden} reason={phase.reason} />
      </header>

      <section className="pl-section" aria-label="Next up">
        <header className="pl-section-head">
          <h2>Next up</h2>
        </header>
        {top.length ? (
          <ul className="pl-list pl-nextup">
            {top.map((a) => (
              <li key={a.key}>
                <ActionRow action={a} big />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckCircle2} title="Nothing pressing." compact>
            Nothing is due or waiting on you. A good moment to capture ideas or shape the show.
          </EmptyState>
        )}
      </section>

      {headline.length > 0 && <div className="pl-home-headline">{headline.map((b) => <div key={b.id}>{b.node}</div>)}</div>}
      {supporting.length > 0 && <div className="pl-grid-3 pl-home-supporting">{supporting.map((b) => <div key={b.id}>{b.node}</div>)}</div>}

      <EverythingElse actions={rest} />
    </div>
  );
}
