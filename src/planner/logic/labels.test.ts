import { describe, expect, it } from 'vitest';
import * as L from './labels';

describe('labels', () => {
  it('has a human label for every stored token', () => {
    const maps = [
      L.INVITATION_STATUS_LABEL, L.INVITE_METHOD_LABEL, L.PIECE_KIND_LABEL, L.AWARD_STAGE_LABEL,
      L.VENUE_STATUS_LABEL, L.SEGMENT_TYPE_LABEL, L.PLAYBACK_LABEL, L.STEP_STATUS_LABEL,
      L.QUESTION_STATUS_LABEL, L.REACTION_LABEL, L.IDEA_TAG_LABEL,
    ];
    for (const m of maps) {
      for (const [token, label] of Object.entries(m)) {
        expect(label).not.toBe(token);
        expect(label).not.toMatch(/[?-]$|^[a-z]+-[a-z]+$/);
      }
    }
  });
  it('lists every invitation status once', () => {
    expect(new Set(L.INVITATION_STATUS_ORDER).size).toBe(Object.keys(L.INVITATION_STATUS_LABEL).length);
  });
  it('names owners', () => {
    const people = new Map([['a', { name: 'Ana' }], ['b', { name: 'Bo' }]]);
    expect(L.ownerNames([], people)).toBe('Sean');
    expect(L.ownerNames(['a', 'b', 'x'], people)).toBe('Ana & Bo & Unknown');
  });
});
