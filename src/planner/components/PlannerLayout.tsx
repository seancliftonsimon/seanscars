import { useLayoutEffect, type ReactNode } from 'react';
import { Bookmark, Clapperboard, Film, Users, CircleDot, Settings2, ListChecks, FileInput, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PLANNER_SECTIONS, sectionHref } from '../routes';
import { useCollection } from '../hooks/useCollection';
import { seasonCol } from '../firestore';
import { guestOverview } from '../logic/guestOverview';
import { Mail, CheckCircle, UserPlus, Clock } from 'lucide-react';
import { useSeason } from '../hooks/useSeason';

interface Props {
  email: string;
  onSignOut: () => void;
  children: ReactNode;
}

const NAV_ICONS: Record<string, LucideIcon> = {
  '': Bookmark, show: Clapperboard, awards: LayoutDashboard, films: Film,
  people: Users, logistics: CircleDot, season: Settings2, templates: ListChecks, import: FileInput,
};

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

function SeasonSnapshot() {
  const { season } = useSeason();
  const invitations = useCollection(season ? seasonCol(season.id, 'invitations') : null);
  if (!season || invitations.loading || invitations.error) return null;
  const { attendance, guests, sent } = guestOverview(invitations.data, season.capacity);
  return <section className="pl-season-snapshot" aria-label="Season at a glance">
    <h2><span>{season.year}</span> at a glance</h2>
    <div className="pl-stat-meter" aria-hidden="true"><span style={{ width: `${guests ? Math.min(100, sent / guests * 100) : 0}%` }} /></div>
    <ul>
      <li><Users size={18} aria-hidden="true" /><span><b>{guests}</b> on the guest list</span></li>
      <li><Mail size={18} aria-hidden="true" /><span><b>{sent}</b> invited</span></li>
      <li><CheckCircle size={18} aria-hidden="true" /><span><b>{attendance.confirmedPeople}</b> confirmed</span></li>
      <li><UserPlus size={18} aria-hidden="true" /><span><b>{attendance.confirmedPlusOnes}</b> plus-ones confirmed</span></li>
      <li><Clock size={18} aria-hidden="true" /><span><b>{attendance.unanswered}</b> awaiting reply</span></li>
    </ul>
  </section>;
}

/** Planner shell: left nav, season switcher, signed-in account, content. */
export default function PlannerLayout({ email, onSignOut, children }: Props) {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
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
              <span className="pl-nav-icon">{(() => { const Icon = NAV_ICONS[s.path]; return Icon ? <Icon size={20} aria-hidden="true" /> : null; })()}</span><span>{s.label}</span>
            </NavLink>
          ))}
        </nav>
        <nav className="pl-nav pl-nav-secondary" aria-label="Planner settings">
          {secondary.map((s) => (
            <NavLink key={s.path} to={sectionHref(s)} className={navClass}>
              <span className="pl-nav-icon">{(() => { const Icon = NAV_ICONS[s.path]; return Icon ? <Icon size={20} aria-hidden="true" /> : null; })()}</span><span>{s.label}</span>
            </NavLink>
          ))}
        </nav>
        <SeasonSnapshot />
        <div className="pl-account">
          <span className="pl-account-email" title={email}>
            {email}
          </span>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={onSignOut}>
            Lock
          </button>
        </div>
      </aside>
      <div className="pl-main">{children}</div>
    </div>
  );
}
