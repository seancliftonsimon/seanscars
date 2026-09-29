import type { SeasonSubcollection } from './types';

/*
 * Planner sections: nav labels, page titles and the placeholder text shown
 * until each screen's sprint lands. Paths are relative to /plan.
 */

export interface PlannerSection {
  /** Path under /plan ('' is /plan itself). */
  path: string;
  label: string;
  /** Shown on the placeholder screen until the real screen exists. */
  description: string;
  nav: 'primary' | 'secondary' | 'none';
  /** Season collections counted on the placeholder, to confirm imports. */
  counts?: SeasonSubcollection[];
}

export const PLANNER_SECTIONS: PlannerSection[] = [
  {
    path: '',
    label: 'Now',
    description: "What's due, what's waiting and what's next, at a glance. Arrives in Sprint 7.",
    nav: 'primary',
  },
  {
    path: 'show',
    label: 'Show',
    description: 'Run of show with computed start times, the clock bar and piece roll-ups. Arrives in Sprint 3.',
    nav: 'primary',
    counts: ['segments'],
  },
  {
    path: 'show/print',
    label: 'Print run of show',
    description: 'Printable run of show with switch cues, plus "Publish to timer". Arrives in Sprint 4.',
    nav: 'none',
  },
  {
    path: 'awards',
    label: 'Awards',
    description: 'Awards, contenders, and pieces with their steps and "waiting on". Arrives in Sprint 5.',
    nav: 'primary',
    counts: ['awards', 'pieces'],
  },
  {
    path: 'films',
    label: 'Films & ideas',
    description: 'The film pool and the ideas inbox. Arrives in Sprint 5.',
    nav: 'primary',
    counts: ['films', 'ideas'],
  },
  {
    path: 'people',
    label: 'People',
    description: 'People, invitations and the RSVP inbox. Arrives in Sprint 6.',
    nav: 'primary',
    counts: ['invitations'],
  },
  {
    path: 'logistics',
    label: 'Logistics',
    description: 'Venue options, open questions and the checklist. Arrives in Sprint 6.',
    nav: 'primary',
    counts: ['venues', 'questions', 'checklist'],
  },
  {
    path: 'season',
    label: 'Season',
    description: 'Create a season and edit its settings.',
    nav: 'secondary',
  },
  {
    path: 'import',
    label: 'Import',
    description: 'Import the 2026 archive from Firestore and CSVs, and season files like films and venues.',
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
