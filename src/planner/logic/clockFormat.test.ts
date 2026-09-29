import { describe, expect, it } from 'vitest';
import { describeOverUnder, formatDuration, formatHMS } from './clockFormat';

const base = { availableSec: 10200, bufferTargetSec: 600, capSec: 10800 };

describe('formatHMS', () => {
  it('formats', () => {
    expect(formatHMS(10260)).toBe('2:51:00');
    expect(formatHMS(59)).toBe('0:00:59');
    expect(formatHMS(-59)).toBe('0:00:59');
  });
});

describe('formatDuration', () => {
  it('formats', () => {
    expect(formatDuration(540)).toBe('9:00');
    expect(formatDuration(3725)).toBe('62:05');
    expect(formatDuration(-5)).toBe('0:05');
  });
});

describe('describeOverUnder', () => {
  it('spare', () => {
    expect(describeOverUnder({ ...base, totalSec: 10020 })).toBe('3:00 to spare, buffer intact');
  });
  it('exact', () => {
    expect(describeOverUnder({ ...base, totalSec: 10200 })).toBe('Exactly on the buffer');
  });
  it('into buffer', () => {
    expect(describeOverUnder({ ...base, totalSec: 10260 })).toBe('1:00 into the 10:00 buffer');
    expect(describeOverUnder({ ...base, totalSec: 10800 })).toBe('10:00 into the 10:00 buffer');
  });
  it('over', () => {
    expect(describeOverUnder({ ...base, totalSec: 11070 })).toBe('4:30 over');
  });
});
