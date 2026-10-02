import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, dueLabel, formatLongDay, relativeDay, todayIso } from './dates';

describe('dates', () => {
  it('formats today locally', () => {
    expect(todayIso(new Date(2027, 1, 3, 23, 30))).toBe('2027-02-03');
  });
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(daysBetween('2027-01-01', '2027-02-01')).toBe(31);
  });
  it('describes relative days', () => {
    expect(relativeDay('2027-01-05', '2027-01-05')).toBe('today');
    expect(relativeDay('2027-01-06', '2027-01-05')).toBe('tomorrow');
    expect(relativeDay('2027-01-01', '2027-01-05')).toBe('4 days ago');
    expect(relativeDay('2027-01-15', '2027-01-05')).toBe('in 10 days');
  });
  it('labels due dates', () => {
    expect(dueLabel('2027-01-04', '2027-01-05')).toBe('1 day overdue');
    expect(dueLabel('2027-01-05', '2027-01-05')).toBe('Due today');
    expect(dueLabel('2027-01-08', '2027-01-05')).toBe('Due in 3 days');
    expect(dueLabel('2027-03-08', '2027-01-05')).toBe('Due Mar 8');
  });
  it('formats a long day with weekday', () => {
    expect(formatLongDay('2027-02-27')).toBe('Sat, Feb 27, 2027');
  });
});
