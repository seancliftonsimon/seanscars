/*
 * Planner sections: nav labels and page titles. Paths are relative to /plan.
 * (Icons live in the shell so the public bundle doesn't pull them in.)
 */

export interface PlannerSection {
  /** Path under /plan ('' is /plan itself). */
  path: string;
  label: string;
  nav: 'primary' | 'settings' | 'none';
}

export const PLANNER_SECTIONS: PlannerSection[] = [
  { path: '', label: 'Home', nav: 'primary' },
  { path: 'guests', label: 'Guests', nav: 'primary' },
  { path: 'guests/door', label: 'Door list', nav: 'none' },
  { path: 'show', label: 'Show', nav: 'primary' },
  { path: 'show/print', label: 'Print run of show', nav: 'none' },
  { path: 'show/ready', label: 'Show week', nav: 'none' },
  { path: 'make', label: 'Make', nav: 'primary' },
  { path: 'prep', label: 'Venue & to-dos', nav: 'primary' },
  { path: 'ideas', label: 'Ideas', nav: 'primary' },
  { path: 'season', label: 'Season setup', nav: 'settings' },
  { path: 'import', label: 'Import', nav: 'settings' },
];

/** Old paths and where they live now (query strings are translated in PlannerApp). */
export const LEGACY_PATHS: Record<string, string> = {
  people: 'guests',
  awards: 'make',
  films: 'ideas',
  logistics: 'prep',
};

export function sectionHref(section: PlannerSection): string {
  return section.path ? `/plan/${section.path}` : '/plan';
}

export function findSection(path: string): PlannerSection | undefined {
  return PLANNER_SECTIONS.find((s) => s.path === (LEGACY_PATHS[path] ?? path));
}

export function isPlannerPath(pathname: string): boolean {
  return pathname === '/plan' || pathname.startsWith('/plan/');
}

/** Browser tab title for a /plan path, e.g. "Planner | Show". */
export function plannerPageTitle(pathname: string): string {
  const rest = pathname.replace(/^\/plan\/?/, '').replace(/\/+$/, '');
  const section = findSection(rest);
  return `Planner | ${section ? section.label : 'Home'}`;
}

/**
 * Translates an old URL's query to the new section's, so links like
 * `/plan/people?tab=inbox` and `/plan/awards?tab=pieces&piece=…` keep working.
 */
export function legacySearch(oldPath: string, search: string): string {
  const p = new URLSearchParams(search);
  const out = new URLSearchParams();
  const tab = p.get('tab');
  if (oldPath === 'people') {
    if (tab === 'inbox') out.set('view', 'replies');
  } else if (oldPath === 'awards') {
    out.set('view', tab === 'pieces' ? 'pieces' : 'awards');
  } else if (oldPath === 'films') {
    out.set('view', 'films');
  }
  for (const [k, v] of p) if (k !== 'tab') out.set(k, v);
  const q = out.toString();
  return q ? `?${q}` : '';
}
