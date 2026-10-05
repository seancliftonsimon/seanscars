import type { IsoDate, Piece, WithId } from '../types';
import { daysBetween } from './dates';
import { deliveryStep } from './steps';

/*
 * Guest presentations (contributor decks) as a pipeline:
 * asked → confirmed → submitted → checked → in the master deck.
 */

export type DeckStage = 'asked' | 'confirmed' | 'submitted' | 'checked' | 'inDeck';

export const DECK_STAGES: { id: DeckStage; label: string; hint: string }[] = [
  { id: 'asked', label: 'Asked', hint: 'Waiting for a title and length' },
  { id: 'confirmed', label: 'Confirmed', hint: 'Waiting for their deck' },
  { id: 'submitted', label: 'Submitted', hint: 'Check playback and audio' },
  { id: 'checked', label: 'Checked', hint: 'Add to the master deck' },
  { id: 'inDeck', label: 'In master deck', hint: 'Done' },
];

const KEY_STAGE: [RegExp, DeckStage][] = [
  [/^in-master-deck/, 'inDeck'],
  [/^checked/, 'checked'],
  [/^submitted/, 'submitted'],
  [/^title-and-minutes|^confirmed/, 'confirmed'],
];

/** The furthest stage reached by consecutive done steps. */
export function deckStage(piece: Pick<Piece, 'steps'>): DeckStage {
  let stage: DeckStage = 'asked';
  for (const step of piece.steps) {
    if (step.status !== 'done') break;
    const hit = KEY_STAGE.find(([re]) => re.test(step.key));
    if (hit) stage = hit[1];
  }
  return stage;
}

export interface DeckCard {
  piece: WithId<Piece>;
  stage: DeckStage;
  /** Not submitted and past due. */
  overdue: boolean;
  /** Days until due (negative = overdue), or null without a due date. */
  dueIn: number | null;
}

export function deckPipeline(pieces: WithId<Piece>[], today: IsoDate): Record<DeckStage, DeckCard[]> {
  const out: Record<DeckStage, DeckCard[]> = { asked: [], confirmed: [], submitted: [], checked: [], inDeck: [] };
  for (const piece of pieces) {
    if (piece.kind !== 'contributor-deck') continue;
    const stage = deckStage(piece);
    const delivered = deliveryStep(piece)?.status === 'done';
    const dueIn = piece.dueDate ? daysBetween(today, piece.dueDate) : null;
    out[stage].push({ piece, stage, overdue: !delivered && dueIn !== null && dueIn < 0, dueIn });
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueIn ?? 9999) - (b.dueIn ?? 9999));
  }
  return out;
}

/** Index of the first step that isn't done, for one-tap "advance". */
export function nextStepIndex(piece: Pick<Piece, 'steps'>): number {
  return piece.steps.findIndex((s) => s.status !== 'done');
}

/** Steps with the next not-done step marked done. */
export function advanceStep<T extends Pick<Piece, 'steps'>>(piece: T): T['steps'] {
  const i = nextStepIndex(piece);
  return piece.steps.map((s, j) => (j === i ? { ...s, status: 'done' as const } : s));
}
