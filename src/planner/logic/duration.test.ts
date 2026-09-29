import { describe, expect, it } from 'vitest';
import { nudge, parseLength } from './duration';

describe('parseLength', () => {
  it('reads m:ss and h:mm:ss', () => {
    expect(parseLength('6:30')).toBe(390);
    expect(parseLength(' 0:45 ')).toBe(45);
    expect(parseLength('171:00')).toBe(10260);
    expect(parseLength('1:02:03')).toBe(3723);
  });

  it('reads bare numbers as minutes', () => {
    expect(parseLength('6')).toBe(360);
    expect(parseLength('6.5')).toBe(390);
  });

  it('rejects bad input', () => {
    for (const bad of ['', 'abc', '6:75', '-1', '1:2:3:4', '6:', ':30', '1:60:00', '601']) {
      expect(parseLength(bad), bad).toBeNull();
    }
  });
});

describe('nudge', () => {
  it('adds and clamps at zero', () => {
    expect(nudge(60, 30)).toBe(90);
    expect(nudge(20, -30)).toBe(0);
  });
});
