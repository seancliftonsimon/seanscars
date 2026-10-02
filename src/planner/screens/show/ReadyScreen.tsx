import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, ClipboardCheck, DoorOpen, ExternalLink, Printer, Radio } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived } from '../../hooks/useDerived';
import { EmptyState, PageHeader, Section, Skeleton } from '../../components/ui/Basics';
import { ProgressBar } from '../../components/ui/Progress';
import { timerTargetDocId } from '../../logic/readiness';
import PublishDialog from './PublishDialog';
import { PublishStatus } from './PublishStatus';
import './show.css';

const STORAGE = 'pl-showweek-steps';

function readManual(seasonId: string): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(`${STORAGE}:${seasonId}`) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** Show-week readiness from the data, then the timer switch as a short guided list. `?publish=1` opens Publish. */
export default function ReadyScreen() {
  const { season, data } = usePlanner();
  const d = useDerived();
  const [params, setParams] = useSearchParams();
  const [manual, setManual] = useState<Record<string, boolean>>(() => (season ? readManual(season.id) : {}));
  const publishing = params.get('publish') === '1';
  const setPublishing = (on: boolean) => setParams(on ? { publish: '1' } : {});

  if (!season) return <EmptyState icon={ClipboardCheck} title="No season yet">Create a season first.</EmptyState>;
  if (!d) return <div className="pl-page"><Skeleton rows={8} label="Loading readiness" /></div>;

  const done = d.ready.filter((r) => r.done).length;
  const timerReads = timerTargetDocId(import.meta.env.VITE_RUN_OF_SHOW_DOC_ID);
  const buildPoints = timerReads === season.timerDocId;
  const toggle = (key: string) => {
    const next = { ...manual, [key]: !manual[key] };
    setManual(next);
    try {
      window.localStorage.setItem(`${STORAGE}:${season.id}`, JSON.stringify(next));
    } catch {
      // Not saved; fine for a checklist.
    }
  };

  const switchSteps = [
    {
      key: 'publish-live',
      done: Boolean(d.livePublish),
      derived: true,
      title: 'Publish to the live timer',
      body: d.livePublish ? 'Done. Publish again only if you change the plan before show night.' : 'Use Publish to timer and choose “Live timer”. Publish before anyone opens the timer on the new document.',
    },
    {
      key: 'env',
      done: buildPoints,
      derived: true,
      title: <>Point the site’s timer at <code>{season.timerDocId}</code></>,
      body: buildPoints
        ? 'This copy of the site already reads the new document.'
        : <>In <code>.env</code>, set <code>VITE_RUN_OF_SHOW_DOC_ID={season.timerDocId}</code>. This copy of the site reads <code>{timerReads}</code>.</>,
    },
    {
      key: 'deploy',
      done: buildPoints || Boolean(manual.deploy),
      derived: buildPoints,
      title: 'Push to main to deploy',
      body: 'Merging to main deploys the whole site. When this page is opened on the live site after the deploy, the step above ticks itself.',
    },
    {
      key: 'check',
      done: Boolean(manual.check),
      derived: false,
      title: 'Open the timer on the show laptop',
      body: <>Check it shows tonight’s run of show. If it shows old data, clear its saved copy (local storage key <code>seanscars-stage-timer-v1</code>) and reload.</>,
    },
  ];

  return (
    <>
      <div className="pl-page is-narrow">
        <PageHeader
          title="Show week"
          eyebrow={<Link to="/plan/show">← Show</Link>}
          answer={done === d.ready.length ? 'Everything is ready.' : `${done} of ${d.ready.length} ready. Work down the list; each item links to what’s left.`}
          actions={
            <>
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => setPublishing(true)} disabled={data.segments.length === 0}>
                <Radio size={16} aria-hidden /> Publish to timer
              </button>
              <Link to="/plan/show/print" className="pl-btn"><Printer size={16} aria-hidden /> Print run of show</Link>
              <Link to="/plan/guests/door" className="pl-btn"><DoorOpen size={16} aria-hidden /> Door list</Link>
            </>
          }
        />
        <ProgressBar value={done} max={d.ready.length} tone={done === d.ready.length ? 'good' : 'accent'} label="Show-week readiness" />
        <PublishStatus />
        <ul className="pl-list pl-ready" aria-label="Readiness">
          {d.ready.map((r) => (
            <li key={r.id}>
              <div className={`pl-list-row${r.done ? ' is-done' : ''}`}>
                {r.done ? <CheckCircle2 size={20} className="pl-ok-icon" aria-label="Ready" /> : <Circle size={20} className="pl-faint" aria-label="Not ready" />}
                <div className="pl-list-main">
                  <span className="pl-list-title">{r.label}</span>
                  <span className="pl-list-meta">{r.detail}</span>
                </div>
                {!r.done && (
                  r.href.includes('publish=1') ? (
                    <button type="button" className="pl-btn pl-btn-sm" onClick={() => setPublishing(true)}>Publish…</button>
                  ) : (
                    <Link to={r.href} className="pl-btn pl-btn-sm">Fix</Link>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>

        <Section title="Switch the timer to this season">
          <p className="pl-small pl-muted">The planner can’t deploy the site, so the steps live here. Numbered steps tick themselves from the data; tick the circles yourself.</p>
          <ol className="pl-list pl-switch">
            {switchSteps.map((s, i) => (
              <li key={s.key}>
                <div className={`pl-list-row${s.done ? ' is-done' : ''}`}>
                  {s.derived ? (
                    s.done ? <CheckCircle2 size={20} className="pl-ok-icon" aria-label="Done" /> : <span className="pl-step-num" aria-hidden>{i + 1}</span>
                  ) : (
                    <button type="button" className={`pl-check-btn${s.done ? ' is-done' : ''}`} aria-pressed={s.done} aria-label={`Mark done: step ${i + 1}`} onClick={() => toggle(s.key)}>
                      <CheckCircle2 size={14} aria-hidden />
                    </button>
                  )}
                  <div className="pl-list-main">
                    <span className="pl-list-title">{s.title}</span>
                    <span className="pl-small pl-muted">{s.body}</span>
                  </div>
                  {s.key === 'check' && (
                    <a href="#/timer" target="_blank" rel="noreferrer" className="pl-btn pl-btn-sm">Open timer <ExternalLink size={13} aria-hidden /></a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      {publishing && <PublishDialog season={season} segments={data.segments} people={data.people} publishes={data.publishes} onClose={() => setPublishing(false)} />}
    </>
  );
}
