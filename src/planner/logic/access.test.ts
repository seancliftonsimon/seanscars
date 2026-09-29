import { describe, expect, it } from 'vitest';
import { isEmailAllowed } from './access';

const list = ['host@example.com', 'Cohost@Example.com'];

describe('isEmailAllowed', () => {
  it('allows a verified listed email, ignoring case', () => {
    expect(isEmailAllowed('host@example.com', true, list)).toBe(true);
    expect(isEmailAllowed('cohost@example.com', true, list)).toBe(true);
  });
  it('rejects unlisted, unverified or missing emails', () => {
    expect(isEmailAllowed('guest@example.com', true, list)).toBe(false);
    expect(isEmailAllowed('host@example.com', false, list)).toBe(false);
    expect(isEmailAllowed(null, true, list)).toBe(false);
  });
  it('rejects when the list is missing or malformed', () => {
    expect(isEmailAllowed('host@example.com', true, undefined)).toBe(false);
    expect(isEmailAllowed('host@example.com', true, [42, null])).toBe(false);
  });
});
