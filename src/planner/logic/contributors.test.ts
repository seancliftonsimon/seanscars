import { describe, expect, it } from 'vitest';
import type { Piece, WithId } from '../types';
import { advanceStep, deckPipeline, deckStage } from './contributors';
import { defaultSteps } from './steps';

const deck = (id: string, done: number, over: Partial<Piece> = {}): WithId<Piece> => ({
  id, title: id, kind: 'contributor-deck', ownerPersonIds: ['p'], order: 0, links: [],
  steps: defaultSteps('contributor-deck').map((s, i) => ({ ...s, status: i < done ? 'done' : 'todo' })), ...over,
});

describe('contributor pipeline', () => {
  it('maps done steps to stages', () => {
    expect(deckStage(deck('a', 0))).toBe('asked');
    expect(deckStage(deck('a', 1))).toBe('asked');
    expect(deckStage(deck('a', 2))).toBe('confirmed');
    expect(deckStage(deck('a', 3))).toBe('submitted');
    expect(deckStage(deck('a', 4))).toBe('checked');
    expect(deckStage(deck('a', 5))).toBe('inDeck');
  });
  it('groups decks, overdue first', () => {
    const p = deckPipeline(
      [deck('late', 2, { dueDate: '2027-01-01' }), deck('soon', 2, { dueDate: '2027-01-10' }), deck('done', 5, { dueDate: '2026-12-01' }), { ...deck('x', 1), kind: 'song' }],
      '2027-01-05',
    );
    expect(p.confirmed.map((c) => [c.piece.id, c.overdue])).toEqual([['late', true], ['soon', false]]);
    expect(p.inDeck[0].overdue).toBe(false);
    expect(p.asked).toEqual([]);
  });
  it('advances the next step', () => {
    expect(advanceStep(deck('a', 2)).map((s) => s.status)).toEqual(['done', 'done', 'done', 'todo', 'todo']);
    expect(advanceStep(deck('a', 5)).every((s) => s.status === 'done')).toBe(true);
  });
});
