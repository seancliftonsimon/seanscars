import { describe, expect, it } from 'vitest';
import type { Segment, WithId } from '../types';
import { computeSchedule } from './clock';
import { clockVerdict } from './verdict';

const seg = (id: string, sec: number, over: Partial<Segment> = {}): WithId<Segment> => ({
  id, order: Number(id.slice(1)) * 1000, title: `Seg ${id}`, type: 'live', playbackSource: 'slides', plannedSec: sec,
  ownerPersonIds: [], ...over,
});
const season = (capMin: number) => ({ showStartTime: '19:00', runtimeCapSec: capMin * 60, bufferTargetSec: 600 });

function verdict(capMin: number, segs: WithId<Segment>[]) {
  const s = computeSchedule(season(capMin), segs, []);
  return clockVerdict(s.totals, s.rows, segs);
}

describe('clockVerdict', () => {
  const segs = [seg('s1', 1200), seg('s2', 600, { ownerPersonIds: ['p'] }), seg('s3', 1800), seg('s4', 300, { type: 'intermission' }), seg('s5', 900)];
  // total 4800s = 80 min

  it('says it fits with spare time', () => {
    const v = verdict(100, segs); // available 90 min
    expect(v).toMatchObject({ state: 'ok', advice: null, candidates: [] });
    expect(v.headline).toBe('Fits, with 10:00 to spare and the 10:00 buffer intact.');
  });
  it('flags running into the buffer', () => {
    const v = verdict(85, segs); // available 75
    expect(v.state).toBe('tight');
    expect(v.trimToBufferSec).toBe(300);
    expect(v.headline).toBe('Runs 5:00 into the 10:00 buffer.');
  });
  it('flags going over and names Sean’s longest segments', () => {
    const v = verdict(75, segs); // cap 75, available 65
    expect(v.state).toBe('over');
    expect(v.trimToCapSec).toBe(300);
    expect(v.trimToBufferSec).toBe(900);
    expect(v.candidates.map((c) => c.segmentId)).toEqual(['s3', 's1', 's5']);
    expect(v.advice).toContain('Trim at least 5:00 (15:00 to get the buffer back)');
    expect(v.advice).toContain('Seg s3 (30:00)');
  });
  it('handles an empty run of show', () => {
    expect(verdict(75, []).headline).toBe('No run of show yet.');
  });
});
