import { useCallback } from 'react';
import { seasonSubDoc } from '../firestore';
import { advanceStep, nextStepIndex } from '../logic/contributors';
import type { ChecklistItem, Invitation, Piece, Question, WithId } from '../types';
import { usePlanner } from './plannerContext';
import { useUndoableUpdate } from './useUndoable';

/** The common one-tap actions, each with an Undo toast. */
export function useActions() {
  const { season, today } = usePlanner();
  const update = useUndoableUpdate();
  const sid = season?.id ?? '';

  const tickTask = useCallback(
    (item: WithId<ChecklistItem>, done = !item.done) =>
      update(seasonSubDoc(sid, 'checklist', item.id), item, { done }, done ? `Done: ${item.text}` : `Reopened: ${item.text}`),
    [sid, update],
  );

  const advancePiece = useCallback(
    (piece: WithId<Piece>) => {
      const i = nextStepIndex(piece);
      if (i < 0) return Promise.resolve();
      return update(seasonSubDoc(sid, 'pieces', piece.id), piece, { steps: advanceStep(piece) }, `${piece.title}: “${piece.steps[i].label}” done`);
    },
    [sid, update],
  );

  const answerQuestion = useCallback(
    (q: WithId<Question>, answer: string) =>
      update(seasonSubDoc(sid, 'questions', q.id), q, { status: 'decided', answer }, 'Decided. Anything waiting on it is unblocked.'),
    [sid, update],
  );

  const logNudge = useCallback(
    (inv: WithId<Invitation>, name: string) =>
      update(seasonSubDoc(sid, 'invitations', inv.id), inv, { nudgedAt: today }, `Nudge logged for ${name}`),
    [sid, today, update],
  );

  return { tickTask, advancePiece, answerQuestion, logNudge };
}
