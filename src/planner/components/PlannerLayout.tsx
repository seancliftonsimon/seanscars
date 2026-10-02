import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Clapperboard,
  Home,
  Lightbulb,
  ListChecks,
  Lock,
  Menu,
  Plus,
  Search,
  Settings2,
  Upload,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PLANNER_SECTIONS, sectionHref, type PlannerSection } from '../routes';
import { useSeason } from '../hooks/useSeason';
import { usePlanner } from '../hooks/plannerContext';
import { navAttention, type NavAttention } from '../logic/attention';
import { computeSchedule } from '../logic/clock';
import { phaseInfo } from '../logic/phase';
import { plural } from '../logic/dates';
import CommandPalette from './CommandPalette';
import { PaletteContext, type PaletteMode } from './paletteContext';

const ICONS: Record<string, LucideIcon> = {
  '': Home,
  guests: Users,
  show: Clapperboard,
  make: Wand2,
  prep: ListChecks,
  ideas: Lightbulb,
  season: Settings2,
  import: Upload,
};

/** Bottom bar on phones: the four most used, then More. */
const BOTTOM = ['', 'guests', 'show', 'make'];

function badgeFor(path: string, a: NavAttention | null): { text: string; label: string } | null {
  if (!a) return null;
  if (path === 'guests' && a.guests) return { text: String(a.guests), label: plural(a.guests, 'new RSVP') };
  if (path === 'make' && a.make) return { text: String(a.make), label: `${plural(a.make, 'piece')} overdue` };
  if (path === 'prep' && a.prep) return { text: String(a.prep), label: `${plural(a.prep, 'item')} overdue` };
  if (path === 'show' && a.showOver) return { text: '!', label: 'Show runs over time' };
  return null;
}

function NavItem({ section, attention, onNavigate }: { section: PlannerSection; attention: NavAttention | null; onNavigate?: () => void }) {
  const Icon = ICONS[section.path] ?? Home;
  const badge = badgeFor(section.path, attention);
  return (
    <NavLink
      to={sectionHref(section)}
      end={section.path === ''}
      className={({ isActive }) => (isActive ? 'pl-nav-link is-active' : 'pl-nav-link')}
      onClick={onNavigate}
    >
      <Icon size={17} aria-hidden />
      <span className="pl-nav-label">{section.label}</span>
      {badge && (
        <span className="pl-nav-badge" aria-label={badge.label} title={badge.label}>
          {badge.text}
        </span>
      )}
    </NavLink>
  );
}

function SeasonSwitcher() {
  const { seasons, seasonId, setSeasonId, loading, error } = useSeason();
  if (loading) return <span className="pl-switcher pl-skeleton-inline" aria-label="Loading seasons" />;
  if (error) return <p className="pl-error pl-switcher-note">Couldn’t load seasons: {error.code}</p>;
  if (seasons.length === 0) return <Link to="/plan/season" className="pl-switcher-note">Create a season</Link>;
  return (
    <label className="pl-switcher">
      <span className="pl-visually-hidden">Season</span>
      <select value={seasonId ?? ''} onChange={(e) => setSeasonId(e.target.value)}>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.year} season{s.archived ? ' (archived)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhasePill() {
  const { phase } = usePlanner();
  if (!phase) return null;
  const info = phaseInfo(phase.id);
  const d = phase.daysToShow;
  const when = d === null ? 'No date yet' : d > 0 ? `${plural(d, 'day')} to go` : d === 0 ? 'Show day' : 'Show is over';
  return (
    <Link to="/plan" className="pl-phase-pill" title={info.focus}>
      <span className="pl-phase-dot" aria-hidden />
      <span>
        <strong>{info.label}</strong>
        <span>{when}</span>
      </span>
    </Link>
  );
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

const CHORDS: Record<string, string> = { h: '/plan', g: '/plan/guests', s: '/plan/show', m: '/plan/make', v: '/plan/prep', i: '/plan/ideas' };

interface Props {
  onSignOut: () => void;
  children: ReactNode;
}

/** Planner shell: sidebar (desktop), bottom bar and More sheet (phone), palette, shortcuts. */
export default function PlannerLayout({ onSignOut, children }: Props) {
  const { season, data, inbox, today } = usePlanner();
  const [palette, setPalette] = useState<PaletteMode | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const chord = useRef<number | null>(null);

  const attention = useMemo(() => {
    if (!season || data.loading) return null;
    const clock = data.segments.length ? computeSchedule(season, data.segments, data.pieces).totals.state : null;
    return navAttention(
      { inboxCount: inbox.length, pieces: data.pieces, questions: data.questions, checklist: data.checklist, clockState: clock },
      today,
    );
  }, [season, data, inbox.length, today]);

  const openPalette = useCallback((mode: PaletteMode = 'search') => {
    setMoreOpen(false);
    setPalette(mode);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => (p ? null : 'search'));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open], .pl-palette')) return;
      const key = e.key.toLowerCase();
      if (chord.current !== null) {
        window.clearTimeout(chord.current);
        chord.current = null;
        if (CHORDS[key]) {
          e.preventDefault();
          navigate(CHORDS[key]);
        }
        return;
      }
      if (key === '/') {
        e.preventDefault();
        setPalette('search');
      } else if (key === 'c') {
        e.preventDefault();
        setPalette('capture');
      } else if (key === 'g') {
        chord.current = window.setTimeout(() => (chord.current = null), 1200);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Close the More sheet on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  const primary = PLANNER_SECTIONS.filter((s) => s.nav === 'primary');
  const settings = PLANNER_SECTIONS.filter((s) => s.nav === 'settings');
  const bottom = BOTTOM.map((p) => primary.find((s) => s.path === p)!).filter(Boolean);
  const more = primary.filter((s) => !BOTTOM.includes(s.path));
  const moreAttention = more.some((s) => badgeFor(s.path, attention));

  return (
    <PaletteContext.Provider value={openPalette}>
      <div className="pl-root pl-shell">
        <a href="#pl-main" className="pl-skip" onClick={(e) => { e.preventDefault(); document.getElementById('pl-main')?.focus(); }}>
          Skip to content
        </a>
        <aside className="pl-sidebar">
          <div className="pl-brand">
            <Link to="/plan">Sharemony Planner</Link>
          </div>
          <SeasonSwitcher />
          <PhasePill />
          <button type="button" className="pl-search-btn" onClick={() => openPalette('search')}>
            <Search size={15} aria-hidden />
            <span>Search or jump</span>
            <kbd>⌘K</kbd>
          </button>
          <nav className="pl-nav" aria-label="Planner">
            {primary.map((s) => (
              <NavItem key={s.path} section={s} attention={attention} />
            ))}
          </nav>
          <button type="button" className="pl-btn pl-capture-btn" onClick={() => openPalette('capture')}>
            <Plus size={16} aria-hidden /> Quick add <kbd>C</kbd>
          </button>
          <div className="pl-sidebar-foot">
            <nav className="pl-nav pl-nav-quiet" aria-label="Setup">
              {settings.map((s) => (
                <NavItem key={s.path} section={s} attention={null} />
              ))}
            </nav>
            <button type="button" className="pl-nav-link pl-lock" onClick={onSignOut}>
              <Lock size={17} aria-hidden />
              <span className="pl-nav-label">Lock planner</span>
            </button>
          </div>
        </aside>

        <header className="pl-topbar">
          <Link to="/plan" className="pl-topbar-brand">Sharemony</Link>
          <PhasePill />
          <button type="button" className="pl-icon-btn" onClick={() => openPalette('search')} aria-label="Search">
            <Search size={20} aria-hidden />
          </button>
        </header>

        <main className="pl-main" id="pl-main" tabIndex={-1}>
          {children}
        </main>

        <button type="button" className="pl-fab" onClick={() => openPalette('capture')} aria-label="Quick add">
          <Plus size={24} aria-hidden />
        </button>

        <nav className="pl-bottomnav" aria-label="Planner">
          {bottom.map((s) => (
            <NavItem key={s.path} section={s} attention={attention} />
          ))}
          <button
            type="button"
            className={`pl-nav-link${moreOpen ? ' is-active' : ''}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
          >
            {moreOpen ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
            <span className="pl-nav-label">More</span>
            {moreAttention && <span className="pl-nav-dot" aria-label="Something needs attention" />}
          </button>
        </nav>

        {moreOpen && (
          <div className="pl-more" role="dialog" aria-label="More">
            <div className="pl-more-backdrop" onClick={() => setMoreOpen(false)} aria-hidden />
            <div className="pl-more-sheet">
              <SeasonSwitcher />
              <nav className="pl-nav" aria-label="More sections">
                {[...more, ...settings].map((s) => (
                  <NavItem key={s.path} section={s} attention={attention} onNavigate={() => setMoreOpen(false)} />
                ))}
                <button type="button" className="pl-nav-link" onClick={onSignOut}>
                  <Lock size={17} aria-hidden />
                  <span className="pl-nav-label">Lock planner</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {palette && <CommandPalette mode={palette} onClose={() => setPalette(null)} />}
      </div>
    </PaletteContext.Provider>
  );
}
