import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { InlineText } from '../../components/ui/InlineText';
import { dueLabel } from '../../logic/dates';
import { blockedItems } from '../../logic/waiting';
import type { Question, WithId } from '../../types';

function QuestionRow({ q, highlight }: { q: WithId<Question>; highlight: boolean }) {
  const { season, data, today } = usePlanner();
  const { answerQuestion } = useActions();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const [answer, setAnswer] = useState('');
  const blocked = blockedItems({ kind: 'question', id: q.id }, data);
  const decided = q.status === 'decided';
  const options = (q.options ?? '').split(/[;\n]/).map((o) => o.trim()).filter(Boolean);
  const overdue = !decided && q.dueDate !== undefined && q.dueDate < today;
  if (!season) return null;
  const ref = seasonSubDoc(season.id, 'questions', q.id);

  function decide(e?: FormEvent, value = answer) {
    e?.preventDefault();
    if (!value.trim()) return;
    void answerQuestion(q, value.trim());
    setAnswer('');
  }

  return (
    <li id={`question-${q.id}`} className={highlight ? 'is-highlight' : undefined}>
      <div className={`pl-list-row pl-question${decided ? ' is-dim' : ''}`}>
        <HelpCircle size={18} className="pl-q-icon" aria-hidden />
        <div className="pl-list-main">
          <span className="pl-list-title">
            <InlineText value={q.question} label="Question" allowEmpty={false} onSave={(question) => void update(ref, q, { question }, 'Question updated')} />
          </span>
          <span className="pl-list-meta">
            {decided ? (
              <Chip tone="good">Decided: {q.answer}</Chip>
            ) : q.dueDate ? (
              <span className={overdue ? 'is-overdue' : undefined}>{dueLabel(q.dueDate, today)}</span>
            ) : null}
            {!decided && (
              <input
                type="date"
                className="pl-date-inline"
                value={q.dueDate ?? ''}
                aria-label="Decide by"
                onChange={(e) => void update(ref, q, { dueDate: e.target.value || undefined }, 'Due date changed')}
              />
            )}
            {!decided && blocked.length > 0 && (
              <Chip tone="warn" icon={Lock}>Blocking {blocked.length}</Chip>
            )}
          </span>
          {!decided && blocked.length > 0 && (
            <span className="pl-small pl-muted">
              Waiting on this:{' '}
              {blocked.map((b, i) => (
                <span key={b.id}>
                  <Link to={b.href}>{b.title}</Link>
                  {i < blocked.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          )}
          {!decided && (
            <form className="pl-inline-answer" onSubmit={decide}>
              {options.map((o) => (
                <button key={o} type="button" className="pl-filter" onClick={() => decide(undefined, o)}>
                  {o}
                </button>
              ))}
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={options.length ? 'Or type an answer' : 'Type the answer'} aria-label={`Answer: ${q.question}`} />
              <button type="submit" className="pl-btn pl-btn-sm pl-btn-primary" disabled={!answer.trim()}>
                Decide
              </button>
            </form>
          )}
        </div>
        <div className="pl-list-actions is-inline">
          {decided && (
            <button type="button" className="pl-icon-btn" onClick={() => void update(ref, q, { status: 'open', answer: undefined }, 'Reopened')} aria-label="Reopen" title="Reopen">
              <RotateCcw size={15} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="pl-icon-btn"
            aria-label={`Delete ${q.question}`}
            onClick={() => {
              if (window.confirm('Delete this question?')) void write(() => deleteRecord(ref), 'Question deleted');
            }}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Open questions, soonest first, with what each one blocks; answer in place. */
export default function Questions({ highlight, compact }: { highlight: string | null; compact?: boolean }) {
  const { season, data } = usePlanner();
  const write = useSafeWrite();
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  if (!season) return null;
  const open = data.questions.filter((q) => q.status === 'open').sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const decided = data.questions.filter((q) => q.status === 'decided');

  async function add(e: FormEvent) {
    e.preventDefault();
    const question = text.trim();
    if (!question) return;
    if (await write(() => createRecord(seasonCol(season!.id, 'questions'), { question, status: 'open', ...(due ? { dueDate: due } : {}) }), 'Question added')) {
      setText('');
      setDue('');
    }
  }

  return (
    <div className="pl-stack">
      {open.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No open questions" compact>Anything you still need to decide goes here, with a date to decide by.</EmptyState>
      ) : (
        <ul className="pl-list">
          {open.map((q) => <QuestionRow key={q.id} q={q} highlight={highlight === q.id} />)}
        </ul>
      )}
      {!compact && (
        <form className="pl-toolbar" onSubmit={add}>
          <input className="pl-grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a question to decide" aria-label="New question" />
          <input type="date" className="pl-date-inline" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Decide by" />
          <button type="submit" className="pl-btn" disabled={!text.trim()}>
            <Plus size={16} aria-hidden /> Add
          </button>
        </form>
      )}
      {decided.length > 0 && (
        <details className="pl-details" open={decided.some((q) => q.id === highlight)}>
          <summary>Decided ({decided.length})</summary>
          <ul className="pl-list">
            {decided.map((q) => <QuestionRow key={q.id} q={q} highlight={highlight === q.id} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
