import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonData } from '../../hooks/useSeasonData';
import { errorMessage } from '../../errors';
import { computeNow, type NowItem } from '../../logic/now';
import ClockBar from '../../components/ClockBar';

/** Local 'YYYY-MM-DD' (no UTC shift). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ColumnProps {
  title: string;
  hint: string;
  empty: string;
  items: NowItem[];
}

function Column({ title, hint, empty, items }: ColumnProps) {
  return (
    <section className="pl-panel pl-now-col" aria-label={title}>
      <header className="pl-now-col-head">
        <h2>{title}</h2>
        <span className="pl-muted">{items.length || ''}</span>
      </header>
      <p className="pl-muted pl-now-hint">{hint}</p>
      {items.length === 0 ? (
        <p className="pl-empty">{empty}</p>
      ) : (
        <ul className="pl-now-list">
          {items.map((item) => (
            <li key={item.key} className={item.dim ? 'is-dim' : undefined}>
              <Link to={item.href} className="pl-now-item">
                <span className="pl-now-title">{item.title}</span>
                <span className={item.overdue ? 'pl-now-context pl-error' : 'pl-now-context pl-muted'}>
                  {item.context}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The home screen: are we over time, what's blocked and on what, and who owes Sean something. */
export default function NowScreen() {
  const { season } = useSeason();
  const data = useSeasonData(season?.id ?? null);
  const today = todayIso();
  const view = useMemo(() => (season && !data.loading ? computeNow(season, data, today) : null), [season, data, today]);

  if (!season) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Now</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="pl-screen pl-screen-wide">
      {view && <ClockBar totals={view.clock} />}
      <header className="pl-screen-header">
        <h1>Now</h1>
        <span className="pl-muted">
          {season.name}
          {season.showDate ? ` · show ${season.showDate}` : ' · show date not set'}
        </span>
      </header>

      {data.error ? (
        <p className="pl-error">Couldn't load: {errorMessage(data.error)}</p>
      ) : !view ? (
        <p className="pl-muted">Loading…</p>
      ) : (
        <div className="pl-now-grid">
          <Column title="Decide" hint="Open questions and choices holding up work." empty="Nothing to decide." items={view.decide} />
          <Column title="Chase" hint="Who owes you something." empty="Nothing to chase." items={view.chase} />
          <Column title="Make" hint="Your next steps, then what's due soon." empty="Nothing to make right now." items={view.make} />
        </div>
      )}
    </section>
  );
}
