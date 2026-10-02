import type { ChecklistItem, IsoDate, Piece, Question, WithId } from '../types';
import type { ClockState } from './clock';
import { isComplete } from './steps';

/** What the nav shows next to each section, from anywhere in the app. */
export interface NavAttention {
  /** New RSVPs to file. */
  guests: number;
  /** Pieces past their due date and not finished. */
  make: number;
  /** Overdue open questions and checklist items. */
  prep: number;
  /** The show runs over the cap. */
  showOver: boolean;
}

export function navAttention(
  input: {
    inboxCount: number;
    pieces: WithId<Piece>[];
    questions: WithId<Question>[];
    checklist: WithId<ChecklistItem>[];
    clockState: ClockState | null;
  },
  today: IsoDate,
): NavAttention {
  const late = (d?: IsoDate) => Boolean(d && d < today);
  return {
    guests: input.inboxCount,
    make: input.pieces.filter((p) => late(p.dueDate) && !isComplete(p)).length,
    prep:
      input.questions.filter((q) => q.status === 'open' && late(q.dueDate)).length +
      input.checklist.filter((c) => !c.done && late(c.dueDate)).length,
    showOver: input.clockState === 'over',
  };
}
