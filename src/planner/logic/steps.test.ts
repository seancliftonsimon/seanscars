import { describe, expect, it } from 'vitest';
import type { PieceKind } from '../types';
import { DEFAULT_STEP_LABELS, defaultSteps, stepKey } from './steps';

describe('stepKey', () => {
  it('makes kebab-case keys', () => {
    expect(stepKey('Nominees set')).toBe('nominees-set');
    expect(stepKey('Export at −3 dBFS and test loud')).toBe('export-at-3-dbfs-and-test-loud');
    expect(stepKey('Checked (arrow-key playback, audio levels)')).toBe(
      'checked-arrow-key-playback-audio-levels',
    );
  });
});

describe('defaultSteps', () => {
  it('defaults to todo', () => {
    expect(defaultSteps('slides-bit')).toEqual([
      { key: 'draft', label: 'Draft', status: 'todo' },
      { key: 'final', label: 'Final', status: 'todo' },
      { key: 'in-master-deck', label: 'In master deck', status: 'todo' },
    ]);
  });

  it('applies the requested status', () => {
    expect(defaultSteps('other', 'done').every((s) => s.status === 'done')).toBe(true);
  });

  it('has unique keys per kind and the expected counts', () => {
    const counts: Record<PieceKind, number> = {
      'award-video': 7,
      song: 7,
      'slides-bit': 3,
      'contributor-deck': 5,
      other: 2,
    };
    for (const kind of Object.keys(DEFAULT_STEP_LABELS) as PieceKind[]) {
      const steps = defaultSteps(kind);
      expect(steps).toHaveLength(counts[kind]);
      expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
    }
  });
});
