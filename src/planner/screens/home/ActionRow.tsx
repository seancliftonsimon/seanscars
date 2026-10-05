import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, ChevronRight, MessageCircle } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import type { HomeAction } from '../../logic/home';
import { nextStep } from '../../logic/steps';

/** One "next up" item: answer first, a link to the exact record, and an inline action when there is one. */
export default function ActionRow({ action, big }: { action: HomeAction; big?: boolean }) {
  const { data } = usePlanner();
  const { tickTask, advancePiece, answerQuestion, logNudge } = useActions();
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  const inline = action.inline;

  let control = null;
  if (inline?.kind === 'tick') {
    const item = data.checklist.find((c) => c.id === inline.taskId);
    if (item) {
      control = (
        <button type="button" className={`pl-check-btn${item.done ? ' is-done' : ''}`} onClick={() => void tickTask(item)} aria-label={`Mark done: ${item.text}`}>
          <Check size={14} aria-hidden strokeWidth={3} />
        </button>
      );
    }
  } else if (inline?.kind === 'advance') {
    const piece = data.pieces.find((p) => p.id === inline.pieceId);
    const step = piece ? nextStep(piece) : null;
    if (piece && step) {
      control = (
        <button type="button" className="pl-btn pl-btn-sm" onClick={() => void advancePiece(piece)} title={`Mark “${step.label}” done`}>
          <Check size={14} aria-hidden /> {step.label.length > 22 ? 'Step done' : `${step.label} done`}
        </button>
      );
    }
  } else if (inline?.kind === 'nudge') {
    const inv = data.invitations.find((i) => i.id === inline.personId);
    const name = data.peopleById.get(inline.personId)?.name ?? 'them';
    if (inv) {
      control = (
        <button type="button" className="pl-btn pl-btn-sm" onClick={() => void logNudge(inv, name)}>
          <MessageCircle size={14} aria-hidden /> Log nudge
        </button>
      );
    }
  } else if (inline?.kind === 'answer') {
    const q = data.questions.find((x) => x.id === inline.questionId);
    if (q && !answering) {
      control = (
        <button type="button" className="pl-btn pl-btn-sm" onClick={() => setAnswering(true)}>
          Answer
        </button>
      );
    }
    if (q && answering) {
      const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!answer.trim()) return;
        void answerQuestion(q, answer.trim());
        setAnswering(false);
      };
      control = (
        <form className="pl-inline-answer" onSubmit={submit}>
          <input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAnswering(false)}
            placeholder={q.options ? `e.g. ${q.options.split(/[;,]/)[0].trim()}` : 'The answer'}
            aria-label={`Answer: ${q.question}`}
          />
          <button type="submit" className="pl-btn pl-btn-sm pl-btn-primary" disabled={!answer.trim()}>
            Decide
          </button>
        </form>
      );
    }
  }

  const tickFirst = inline?.kind === 'tick';
  return (
    <div className={`pl-list-row pl-action${big ? ' is-big' : ''}${action.urgent ? ' is-urgent' : ''}`}>
      {tickFirst && control}
      {!tickFirst && action.urgent && <AlertCircle size={18} className="pl-action-alert" aria-label="Overdue" />}
      <div className="pl-list-main">
        <Link to={action.href} className="pl-list-title">
          {action.title}
        </Link>
        {action.detail && <span className={`pl-list-meta${action.urgent ? ' is-urgent' : ''}`}>{action.detail}</span>}
      </div>
      <div className="pl-list-actions is-inline">
        {!tickFirst && control}
        <Link to={action.href} className="pl-icon-btn" aria-label={`Open ${action.title}`}>
          <ChevronRight size={18} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
