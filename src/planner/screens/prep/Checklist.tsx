import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, Hourglass, Plus, Trash2 } from 'lucide-react';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { EmptyState } from '../../components/ui/Basics';
import { InlineText } from '../../components/ui/InlineText';
import { dueLabel } from '../../logic/dates';
import { nextOrder } from '../../logic/records';
import { isResolved, waitHref, waitingLabel } from '../../logic/waiting';

const GENERAL = 'General';

/** The checklist grouped by area; tick in place, with what each item waits on. */
export default function Checklist({ highlight }: { highlight: string | null }) {
  const { season, data, today } = usePlanner();
  const { tickTask } = useActions();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const [text, setText] = useState('');
  const [area, setArea] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, typeof data.checklist>();
    for (const item of data.checklist) {
      const a = item.area?.trim() || GENERAL;
      map.set(a, [...(map.get(a) ?? []), item]);
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items: items.sort((x, y) => Number(x.done) - Number(y.done) || (x.dueDate ?? '9999').localeCompare(y.dueDate ?? '9999') || x.order - y.order),
      }))
      .sort((a, b) => (a.name === GENERAL ? -1 : b.name === GENERAL ? 1 : a.name.localeCompare(b.name)));
  }, [data]);
  const areas = groups.map((g) => g.name).filter((n) => n !== GENERAL);
  if (!season) return null;
  const sid = season.id;
  const doneCount = data.checklist.filter((c) => c.done).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const ok = await write(
      () => createRecord(seasonCol(sid, 'checklist'), { text: t, done: false, order: nextOrder(data.checklist), ...(area.trim() ? { area: area.trim() } : {}), ...(due ? { dueDate: due } : {}) }),
      'Task added',
    );
    if (ok) {
      setText('');
      setDue('');
    }
  }

  return (
    <div className="pl-stack">
      {data.checklist.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing on the checklist" compact>Add the things to book, buy and bring, grouped by area.</EmptyState>
      ) : (
        <>
          <label className="pl-check pl-small pl-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done ({doneCount})
          </label>
          {groups.map((g) => {
            const items = g.items.filter((i) => showDone || !i.done || i.id === highlight);
            if (items.length === 0) return null;
            return (
              <section key={g.name} className="pl-section" aria-label={g.name}>
                <h3 className="pl-group-title">{g.name} <span className="pl-count">{g.items.filter((i) => !i.done).length}</span></h3>
                <ul className="pl-list">
                  {items.map((item) => {
                    const overdue = !item.done && item.dueDate !== undefined && item.dueDate < today;
                    const wait = item.waitingOn && !item.done && !isResolved(item.waitingOn, data) ? item.waitingOn : null;
                    return (
                      <li key={item.id} id={`task-${item.id}`} className={highlight === item.id ? 'is-highlight' : undefined}>
                        <div className={`pl-list-row${item.done ? ' is-dim' : ''}`}>
                          <button type="button" className={`pl-check-btn${item.done ? ' is-done' : ''}`} onClick={() => void tickTask(item)} aria-pressed={item.done} aria-label={`Done: ${item.text}`}>
                            <Check size={14} aria-hidden strokeWidth={3} />
                          </button>
                          <div className="pl-list-main">
                            <span className={`pl-list-title${item.done ? ' is-struck' : ''}`}>
                              <InlineText value={item.text} label="Task" allowEmpty={false} onSave={(t) => void update(seasonSubDoc(sid, 'checklist', item.id), item, { text: t }, 'Task updated')} />
                            </span>
                            <span className="pl-list-meta">
                              {item.dueDate && !item.done && <span className={overdue ? 'is-overdue' : undefined}>{dueLabel(item.dueDate, today)}</span>}
                              {wait && (
                                <span className="pl-piece-wait">
                                  <Hourglass size={12} aria-hidden /> Waiting on <Link to={waitHref(wait)}>{waitingLabel(wait, data)}</Link>
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="pl-list-actions is-inline">
                            <input
                              type="date"
                              className="pl-date-inline pl-hide-phone"
                              value={item.dueDate ?? ''}
                              aria-label={`Due date for ${item.text}`}
                              onChange={(e) => void update(seasonSubDoc(sid, 'checklist', item.id), item, { dueDate: e.target.value || undefined }, 'Due date changed')}
                            />
                            <button
                              type="button"
                              className="pl-icon-btn"
                              aria-label={`Delete ${item.text}`}
                              onClick={() => {
                                if (window.confirm(`Delete “${item.text}”?`)) void write(() => deleteRecord(seasonSubDoc(sid, 'checklist', item.id)), 'Task deleted');
                              }}
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}
      <form className="pl-toolbar" onSubmit={add}>
        <input className="pl-grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task" aria-label="New task" />
        <input list="pl-areas" className="pl-input-sm" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" aria-label="Area" />
        <datalist id="pl-areas">
          {areas.map((a) => <option key={a} value={a} />)}
        </datalist>
        <input type="date" className="pl-date-inline" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button type="submit" className="pl-btn" disabled={!text.trim()}>
          <Plus size={16} aria-hidden /> Add
        </button>
      </form>
    </div>
  );
}
