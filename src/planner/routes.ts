/*
 * Planner sections: nav labels and page titles. Paths are relative to /plan.
 */

export interface PlannerSection {
  /** Path under /plan ('' is /plan itself). */
  path: string;
  label: string;
  nav: 'primary' | 'secondary' | 'none';
}

export const PLANNER_SECTIONS: PlannerSection[] = [
  {
    path: '',
    label: 'Now',
    nav: 'primary',
  },
  {
    path: 'show',
    label: 'Show',
    nav: 'primary',
  },
  {
    path: 'show/print',
    label: 'Print run of show',
    nav: 'none',
  },
  {
    path: 'awards',
    label: 'Awards',
    nav: 'primary',
  },
  {
    path: 'films',
    label: 'Films & ideas',
    nav: 'primary',
  },
  {
    path: 'people',
    label: 'People',
    nav: 'primary',
  },
  {
    path: 'logistics',
    label: 'Logistics',
    nav: 'primary',
  },
  {
    path: 'season',
    label: 'Season',
    nav: 'secondary',
  },
  {
    path: 'import',
    label: 'Import',
    nav: 'secondary',
  },
];

export function sectionHref(section: PlannerSection): string {
  return section.path ? `/plan/${section.path}` : '/plan';
}

export function findSection(path: string): PlannerSection | undefined {
  return PLANNER_SECTIONS.find((s) => s.path === path);
}

export function isPlannerPath(pathname: string): boolean {
  return pathname === '/plan' || pathname.startsWith('/plan/');
}

/** Browser tab title for a /plan path, e.g. "Planner | Show". */
export function plannerPageTitle(pathname: string): string {
  const rest = pathname.replace(/^\/plan\/?/, '').replace(/\/+$/, '');
  const section = findSection(rest);
  return `Planner | ${section ? section.label : 'Now'}`;
}
