import { Link } from 'react-router-dom';
import { Check, Clock, Hourglass } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import { Chip } from '../../components/ui/Chip';
import { ProgressRing } from '../../components/ui/Progress';
import { dueLabel } from '../../logic/dates';
import { PIECE_KIND_LABEL, ownerNames } from '../../logic/labels';
import { isComplete, nextStep, progress } from '../../logic/steps';
import { waitHref, type WaitReason } from '../../logic/waiting';
import type { Piece, WithId } from '../../types';

interface Props {
  piece: WithId<Piece>;
  wait: WaitReason | null;
  onOpen: () => void;
  showOwner?: boolean;
  showSegment?: boolean;
}

/** A piece: progress ring, next step with one-tap done, due date, and why it's blocked. */
export default function PieceRow({ piece, wait, onOpen, showOwner = true, showSegment = true }: Props) {
  const { data, today } = usePlanner();
  const { advancePiece } = useActions();
  const { done, total } = progress(piece);
  const next = nextStep(piece);
  const complete = isComplete(piece);
  const overdue = !complete && piece.dueDate !== undefined && piece.dueDate < today;
  const segment = piece.segmentId ? data.segments.find((s) => s.id === piece.segmentId) : undefined;

  return (
    <div className={`pl-list-row pl-piece-row${wait ? ' is-blocked' : ''}`}>
      <ProgressRing done={done} total={total} label={`${done} of ${total} steps done`} />
      <div className="pl-list-main">
        <button type="button" className="pl-list-title" onClick={onOpen}>
          {piece.title}
        </button>
        <span className="pl-list-meta">
          <span>{PIECE_KIND_LABEL[piece.kind]}</span>
          {showOwner && <span>{ownerNames(piece.ownerPersonIds, data.peopleById)}</span>}
          {showSegment && segment && <Link to={`/plan/show?segment=${segment.id}`}>{segment.title}</Link>}
          {piece.dueDate && !complete && (
            <span className={overdue ? 'is-overdue' : undefined}>
              <Clock size={12} aria-hidden /> {dueLabel(piece.dueDate, today)}
            </span>
          )}
        </span>
        {wait ? (
          <span className="pl-piece-wait">
            <Hourglass size={13} aria-hidden /> Waiting on <Link to={waitHref(wait)}>{wait.label}</Link>
          </span>
        ) : (
          next && <span className="pl-piece-next">Next: {next.label}</span>
        )}
      </div>
      <div className="pl-list-actions is-inline">
        {complete ? (
          <Chip tone="good" icon={Check}>Done</Chip>
        ) : (
          next &&
          !wait && (
            <button type="button" className="pl-btn pl-btn-sm" onClick={() => void advancePiece(piece)} title={`Mark “${next.label}” done`}>
              <Check size={14} aria-hidden /> Done
            </button>
          )
        )}
      </div>
    </div>
  );
}
