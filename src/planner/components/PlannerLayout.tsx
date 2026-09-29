import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PLANNER_SECTIONS, sectionHref } from '../routes';
import { useSeason } from '../hooks/useSeason';

interface Props {
  email: string;
  onSignOut: () => void;
  children: ReactNode;
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'pl-nav-link is-active' : 'pl-nav-link';
}

function SeasonSwitcher() {
  const { seasons, seasonId, setSeasonId, loading, error } = useSeason();

  if (loading) return <p className="pl-muted pl-switcher-note">Loading seasons…</p>;
  if (error) return <p className="pl-error pl-switcher-note">Couldn't load seasons: {error.code}</p>;
  if (seasons.length === 0) {
    return (
      <p className="pl-switcher-note">
        No seasons yet. <Link to="/plan/season">Create one</Link>
      </p>
    );
  }

  return (
    <label className="pl-switcher">
      <span className="pl-switcher-label">Season</span>
      <select value={seasonId ?? ''} onChange={(e) => setSeasonId(e.target.value)}>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.year}
            {s.archived ? ' (archived)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Planner shell: left nav, season switcher, signed-in account, content. */
export default function PlannerLayout({ email, onSignOut, children }: Props) {
  const primary = PLANNER_SECTIONS.filter((s) => s.nav === 'primary');
  const secondary = PLANNER_SECTIONS.filter((s) => s.nav === 'secondary');

  return (
    <div className="pl-root pl-shell">
      <aside className="pl-sidebar">
        <div className="pl-brand">
          <Link to="/plan">Sharemony Planner</Link>
        </div>
        <SeasonSwitcher />
        <nav className="pl-nav" aria-label="Planner">
          {primary.map((s) => (
            <NavLink key={s.path} to={sectionHref(s)} end={s.path === ''} className={navClass}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <nav className="pl-nav pl-nav-secondary" aria-label="Planner settings">
          {secondary.map((s) => (
            <NavLink key={s.path} to={sectionHref(s)} className={navClass}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="pl-account">
          <span className="pl-account-email" title={email}>
            {email}
          </span>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="pl-main">{children}</div>
    </div>
  );
}
