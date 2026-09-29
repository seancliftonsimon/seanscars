import type { PieceKind, PieceStep, StepStatus } from '../types';

/*
 * Default steps for each kind of piece. A piece's steps are copied from
 * here when it is created, then edited freely.
 */

export const DEFAULT_STEP_LABELS: Record<PieceKind, string[]> = {
  'award-video': [
    'Nominees set',
    'Images and clips gathered',
    'Winner decided',
    'Script and voice-over',
    'Edit',
    'Export at −3 dBFS and test loud',
    'In master deck',
  ],
  song: [
    'Song picked',
    'Lyrics',
    'Vocals recorded',
    'Mix',
    'Video or backing track',
    'Rehearsed',
    'In playlist',
  ],
  'slides-bit': ['Draft', 'Final', 'In master deck'],
  'contributor-deck': [
    'Asked',
    'Title and minutes confirmed',
    'Submitted',
    'Checked (arrow-key playback, audio levels)',
    'In master deck',
  ],
  other: ['To do', 'Done'],
};

/** Stable kebab-case key for a step label, e.g. 'Nominees set' → 'nominees-set'. */
export function stepKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Fresh steps for a piece of `kind`, all at `status`. */
export function defaultSteps(kind: PieceKind, status: StepStatus = 'todo'): PieceStep[] {
  return DEFAULT_STEP_LABELS[kind].map((label) => ({ key: stepKey(label), label, status }));
}
