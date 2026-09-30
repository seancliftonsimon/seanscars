import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonData } from '../../hooks/useSeasonData';
import { createRecord, deleteRecord, seasonCol, seasonDoc, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { nextOrder } from '../../logic/records';
import { isIsoDate } from '../../logic/season';
import { blockedCount, isResolved, waitingLabel } from '../../logic/waiting';
import type {
  ChecklistItem,
  Link as PlanLink,
  Question,
  Venue,
  VenueStatus,
  WaitingOn,
  WaitingOnKind,
  WithId,
} from '../../types';
import './logistics.css';

const VENUE_STATUSES: VenueStatus[] = ['researching', 'inquired', 'holding', 'booked', 'declined'];
const GENERAL = 'General';

type CellType = 'text' | 'date' | 'number';

/** Commits on Enter/blur, Escape cancels. Empty string means "clear". */
function Cell({
  value,
  onSave,
  type = 'text',
  label,
  placeholder,
}: {
  value: string;
  onSave: (next: string) => void;
  type?: CellType;
  label: string;
  placeholder?: string;
}) {
  return (
    <input
      key={value}
      type={type}
      min={type === 'number' ? 0 : undefined}
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      onBlur={(e) => {
        const next = e.currentTarget.value.trim();
        if (next === value) return;
        if (type === 'date' && next && !isIsoDate(next)) {
          e.currentTarget.value = value;
          return;
        }
        onSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function dueKey(date?: string): string {
  return date ?? '9999-99-99';
}

const encodeWait = (w?: WaitingOn) => (w ? `${w.kind}:${w.id}` : '');
function decodeWait(value: string): WaitingOn | undefined {
  if (!value) return undefined;
  const i = value.indexOf(':');
  return { kind: value.slice(0, i) as WaitingOnKind, id: value.slice(i + 1) };
}

function LinksCell({ links, onSave, name }: { links: PlanLink[]; onSave: (next: PlanLink[]) => void; name: string }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const add = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    onSave([...links, { label: label.trim() || u, url: u }]);
    setLabel('');
    setUrl('');
  };
  return (
    <div className="pl-logistics-links">
      {links.map((l, i) => (
        <span key={`${l.url}-${i}`} className="pl-logistics-link">
          <a href={l.url} target="_blank" rel="noreferrer">
            {l.label}
          </a>
          <button
            type="button"
            className="pl-link-btn"
            aria-label={`Remove link ${l.label} from ${name}`}
            onClick={() => onSave(links.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <form className="pl-logistics-link-add" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" aria-label={`Link label for ${name}`} />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          aria-label={`Link URL for ${name}`}
        />
        <button type="submit" className="pl-btn pl-btn-quiet" disabled={!url.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

export default function LogisticsScreen() {
  const { season } = useSeason();
  const [params] = useSearchParams();
  const target = params.get('question') ? `question-${params.get('question')}` : params.get('venue') ? `venue-${params.get('venue')}` : params.get('checklist') ? `checklist-${params.get('checklist')}` : params.get('section') === 'venues' ? 'venues' : null;
  const seasonId = season?.id ?? null;
  const data = useSeasonData(seasonId);
  const { venues, questions, checklist, awards, pieces } = data;
  useEffect(() => {
    if (!target || data.loading) return;
    const row = document.getElementById(`pl-${target}`);
    row?.scrollIntoView({ block: 'center' });
    row?.focus({ preventScroll: true });
  }, [target, data.loading]);

  const [error, setError] = useState<string | null>(null);
  const [newVenue, setNewVenue] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newText, setNewText] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newDue, setNewDue] = useState('');
  const [pendingBooked, setPendingBooked] = useState<WithId<Venue> | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (pendingBooked && !dlg.open) dlg.showModal();
    else if (!pendingBooked && dlg.open) dlg.close();
  }, [pendingBooked]);

  const sortedVenues = useMemo(() => [...venues].sort((a, b) => a.name.localeCompare(b.name)), [venues]);

  const sortedQuestions = useMemo(
    () =>
      [...questions].sort(
        (a, b) =>
          Number(a.status === 'decided') - Number(b.status === 'decided') ||
          dueKey(a.dueDate).localeCompare(dueKey(b.dueDate)) ||
          a.question.localeCompare(b.question),
      ),
    [questions],
  );

  const groups = useMemo(() => {
    const map = new Map<string, WithId<ChecklistItem>[]>();
    for (const item of checklist) {
      const area = item.area?.trim() || GENERAL;
      const list = map.get(area) ?? [];
      list.push(item);
      map.set(area, list);
    }
    const names = [...map.keys()].sort((a, b) =>
      a === GENERAL ? -1 : b === GENERAL ? 1 : a.localeCompare(b),
    );
    return names.map((name) => ({
      name,
      items: [...(map.get(name) ?? [])].sort(
        (a, b) => Number(a.done) - Number(b.done) || a.order - b.order || a.id.localeCompare(b.id),
      ),
    }));
  }, [checklist]);

  const areaNames = useMemo(
    () => [...new Set(checklist.map((c) => c.area?.trim()).filter((a): a is string => !!a))].sort(),
    [checklist],
  );

  if (!season || !seasonId) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Logistics</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  /* ---------- venues ---------- */
  const patchVenue = (v: WithId<Venue>, patch: Partial<Omit<Venue, 'createdAt' | 'updatedAt' | 'updatedBy'>>) =>
    run(() => updateRecord(seasonSubDoc(seasonId, 'venues', v.id), patch));

  const addVenue = async (e: FormEvent) => {
    e.preventDefault();
    const name = newVenue.trim();
    if (!name) return;
    await run(async () => {
      await createRecord(seasonCol(seasonId, 'venues'), { name, status: 'researching', links: [] });
      setNewVenue('');
    });
  };

  const removeVenue = (v: WithId<Venue>) => {
    if (!window.confirm(`Delete venue "${v.name}"?`)) return;
    void run(() => deleteRecord(seasonSubDoc(seasonId, 'venues', v.id)));
  };

  const changeVenueStatus = (v: WithId<Venue>, status: VenueStatus) => {
    if (status === 'booked' && v.status !== 'booked') {
      setPendingBooked(v);
      return;
    }
    void patchVenue(v, { status });
  };

  const confirmBooked = async (makeSeasonVenue: boolean) => {
    const v = pendingBooked;
    setPendingBooked(null);
    if (!v) return;
    await run(async () => {
      await updateRecord(seasonSubDoc(seasonId, 'venues', v.id), { status: 'booked' });
      if (makeSeasonVenue) {
        await updateRecord(seasonDoc(seasonId), {
          venueOptionId: v.id,
          ...(v.capacity ? { capacity: v.capacity } : {}),
        });
      }
    });
  };

  const numOrUndef = (s: string) => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  /* ---------- questions ---------- */
  const patchQuestion = (q: WithId<Question>, patch: Partial<Omit<Question, 'createdAt' | 'updatedAt' | 'updatedBy'>>) =>
    run(() => updateRecord(seasonSubDoc(seasonId, 'questions', q.id), patch));

  const addQuestion = async (e: FormEvent) => {
    e.preventDefault();
    const question = newQuestion.trim();
    if (!question) return;
    await run(async () => {
      await createRecord(seasonCol(seasonId, 'questions'), { question, status: 'open' });
      setNewQuestion('');
    });
  };

  const removeQuestion = (q: WithId<Question>) => {
    if (!window.confirm('Delete this question?')) return;
    void run(() => deleteRecord(seasonSubDoc(seasonId, 'questions', q.id)));
  };

  const saveDecision = async (q: WithId<Question>) => {
    const answer = answerDraft.trim();
    if (!answer) return;
    await patchQuestion(q, { status: 'decided', answer });
    setDeciding(null);
    setAnswerDraft('');
  };

  /* ---------- checklist ---------- */
  const patchItem = (i: WithId<ChecklistItem>, patch: Partial<Omit<ChecklistItem, 'createdAt' | 'updatedAt' | 'updatedBy'>>) =>
    run(() => updateRecord(seasonSubDoc(seasonId, 'checklist', i.id), patch));

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    if (newDue && !isIsoDate(newDue)) {
      setError('Use a valid due date.');
      return;
    }
    const area = newArea.trim();
    await run(async () => {
      await createRecord(seasonCol(seasonId, 'checklist'), {
        text,
        done: false,
        order: nextOrder(checklist),
        ...(area ? { area } : {}),
        ...(newDue ? { dueDate: newDue } : {}),
      });
      setNewText('');
      setNewDue('');
    });
  };

  const removeItem = (i: WithId<ChecklistItem>) => {
    if (!window.confirm(`Delete "${i.text}"?`)) return;
    void run(() => deleteRecord(seasonSubDoc(seasonId, 'checklist', i.id)));
  };

  const waitOptions = (item: WithId<ChecklistItem>) => {
    const opts: { value: string; label: string }[] = [{ value: '', label: 'Nothing' }];
    for (const q of questions) {
      if (q.status === 'open') opts.push({ value: `question:${q.id}`, label: `Question: ${q.question.slice(0, 50)}` });
    }
    opts.push({ value: 'venue:any', label: 'Venue booking' });
    for (const a of awards) opts.push({ value: `award:${a.id}`, label: `${a.name} winner` });
    for (const p of pieces) opts.push({ value: `piece:${p.id}`, label: `Piece: ${p.title}` });
    const cur = encodeWait(item.waitingOn);
    if (cur && !opts.some((o) => o.value === cur) && item.waitingOn) {
      opts.push({ value: cur, label: waitingLabel(item.waitingOn, data) });
    }
    return opts;
  };

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>Logistics</h1>
      </header>


      {error && <p className="pl-error">Couldn't save: {error}</p>}
      {data.error && <p className="pl-error">Couldn't load: {errorMessage(data.error)}</p>}

      {/* ---------- venues ---------- */}
      <div className="pl-panel">
        <h2 id="pl-venues" tabIndex={-1}>Venue options</h2>
        <form className="pl-logistics-add" onSubmit={(e) => void addVenue(e)}>
          <input value={newVenue} onChange={(e) => setNewVenue(e.target.value)} placeholder="Add venue" aria-label="Add venue" />
          <button type="submit" className="pl-btn" disabled={!newVenue.trim()}>
            Add venue
          </button>
        </form>
        {data.loading ? (
          <p className="pl-muted">Loading venues…</p>
        ) : sortedVenues.length === 0 ? (
          <p className="pl-empty">No venues yet.</p>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table pl-logistics-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Dates offered</th>
                  <th>Quote ($)</th>
                  <th>Capacity</th>
                  <th>Deposit due</th>
                  <th>Last contact</th>
                  <th>Links</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedVenues.map((v) => (
                  <tr key={v.id} id={`pl-venue-${v.id}`} tabIndex={-1} className={target === `venue-${v.id}` ? 'pl-row-target' : undefined}>
                    <td className="pl-logistics-wide">
                      <Cell value={v.name} label={`Name of ${v.name}`} onSave={(n) => n && void patchVenue(v, { name: n })} />
                      {season.venueOptionId === v.id && <span className="pl-tag">Season venue</span>}
                    </td>
                    <td>
                      <select
                        value={v.status}
                        aria-label={`Status of ${v.name}`}
                        onChange={(e) => changeVenueStatus(v, e.target.value as VenueStatus)}
                      >
                        {VENUE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Cell value={v.datesOffered ?? ''} label={`Dates offered by ${v.name}`} onSave={(n) => void patchVenue(v, { datesOffered: n || undefined })} />
                    </td>
                    <td className="pl-logistics-narrow">
                      <Cell type="number" value={v.quoteUsd?.toString() ?? ''} label={`Quote for ${v.name}`} onSave={(n) => void patchVenue(v, { quoteUsd: numOrUndef(n) })} />
                    </td>
                    <td className="pl-logistics-narrow">
                      <Cell type="number" value={v.capacity?.toString() ?? ''} label={`Capacity of ${v.name}`} onSave={(n) => void patchVenue(v, { capacity: numOrUndef(n) })} />
                    </td>
                    <td>
                      <Cell type="date" value={v.depositDue ?? ''} label={`Deposit due for ${v.name}`} onSave={(n) => void patchVenue(v, { depositDue: n || undefined })} />
                    </td>
                    <td>
                      <Cell type="date" value={v.lastContactDate ?? ''} label={`Last contact with ${v.name}`} onSave={(n) => void patchVenue(v, { lastContactDate: n || undefined })} />
                    </td>
                    <td>
                      <LinksCell name={v.name} links={v.links ?? []} onSave={(links) => void patchVenue(v, { links })} />
                    </td>
                    <td className="pl-logistics-wide">
                      <Cell value={v.notes ?? ''} label={`Notes for ${v.name}`} onSave={(n) => void patchVenue(v, { notes: n || undefined })} />
                    </td>
                    <td>
                      <button type="button" className="pl-link-btn" onClick={() => removeVenue(v)} aria-label={`Delete ${v.name}`}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="pl-root pl-dialog"
        onClose={() => setPendingBooked(null)}
      >
        <h2>Make {pendingBooked?.name} this season's venue?</h2>
        <p className="pl-muted">
          This sets the season venue
          {pendingBooked?.capacity ? ` and capacity to ${pendingBooked.capacity}` : ''}.
        </p>
        <div className="pl-logistics-dialog-actions">
          <button type="button" className="pl-btn" onClick={() => void confirmBooked(true)}>
            Make season venue
          </button>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={() => void confirmBooked(false)}>
            Just mark booked
          </button>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setPendingBooked(null)}>
            Cancel
          </button>
        </div>
      </dialog>

      {/* ---------- questions ---------- */}
      <div className="pl-panel">
        <h2>Open questions</h2>
        <form className="pl-logistics-add" onSubmit={(e) => void addQuestion(e)}>
          <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add question" aria-label="Add question" />
          <button type="submit" className="pl-btn" disabled={!newQuestion.trim()}>
            Add question
          </button>
        </form>
        {data.loading ? (
          <p className="pl-muted">Loading questions…</p>
        ) : sortedQuestions.length === 0 ? (
          <p className="pl-empty">No questions yet.</p>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table pl-logistics-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Answer</th>
                  <th>Options</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedQuestions.map((q) => {
                  const decided = q.status === 'decided';
                  const blocked = blockedCount({ kind: 'question', id: q.id }, data);
                  return (
                    <tr key={q.id} id={`pl-question-${q.id}`} tabIndex={-1} className={[decided ? 'pl-logistics-dim' : '', target === `question-${q.id}` ? 'pl-row-target' : ''].join(' ')}>
                      <td className="pl-logistics-wide">
                        <Cell value={q.question} label="Question" onSave={(n) => n && void patchQuestion(q, { question: n })} />
                        {blocked > 0 && (
                          <span className="pl-logistics-waits">
                            {blocked === 1 ? '1 item waits on this' : `${blocked} items wait on this`}
                          </span>
                        )}
                      </td>
                      <td>
                        <Cell type="date" value={q.dueDate ?? ''} label={`Due date for ${q.question}`} onSave={(n) => void patchQuestion(q, { dueDate: n || undefined })} />
                      </td>
                      <td>{q.status}</td>
                      <td className="pl-logistics-wide">
                        {deciding === q.id ? (
                          <div className="pl-logistics-decide">
                            <input
                              autoFocus
                              value={answerDraft}
                              onChange={(e) => setAnswerDraft(e.target.value)}
                              placeholder="Answer"
                              aria-label="Answer"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveDecision(q);
                                else if (e.key === 'Escape') setDeciding(null);
                              }}
                            />
                            <button type="button" className="pl-btn" disabled={!answerDraft.trim()} onClick={() => void saveDecision(q)}>
                              Save
                            </button>
                            <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setDeciding(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <Cell value={q.answer ?? ''} label={`Answer for ${q.question}`} onSave={(n) => void patchQuestion(q, { answer: n || undefined })} />
                        )}
                      </td>
                      <td className="pl-logistics-wide">
                        <Cell value={q.options ?? ''} label={`Options for ${q.question}`} onSave={(n) => void patchQuestion(q, { options: n || undefined })} />
                      </td>
                      <td className="pl-logistics-wide">
                        <Cell value={q.notes ?? ''} label={`Notes for ${q.question}`} onSave={(n) => void patchQuestion(q, { notes: n || undefined })} />
                      </td>
                      <td className="pl-logistics-actions">
                        {decided ? (
                          <button type="button" className="pl-link-btn" onClick={() => void patchQuestion(q, { status: 'open', answer: undefined })}>
                            Reopen
                          </button>
                        ) : (
                          deciding !== q.id && (
                            <button
                              type="button"
                              className="pl-btn pl-btn-quiet"
                              onClick={() => {
                                setDeciding(q.id);
                                setAnswerDraft(q.answer ?? '');
                              }}
                            >
                              Decide…
                            </button>
                          )
                        )}{' '}
                        <button type="button" className="pl-link-btn" onClick={() => removeQuestion(q)} aria-label={`Delete ${q.question}`}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- checklist ---------- */}
      <div className="pl-panel">
        <h2>Checklist</h2>
        <form className="pl-logistics-add" onSubmit={(e) => void addItem(e)}>
          <input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Add checklist item" aria-label="Checklist item text" />
          <input list="pl-logistics-areas" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Area" aria-label="Area" />
          <datalist id="pl-logistics-areas">
            {areaNames.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} aria-label="Due date" />
          <button type="submit" className="pl-btn" disabled={!newText.trim()}>
            Add item
          </button>
        </form>
        {data.loading ? (
          <p className="pl-muted">Loading checklist…</p>
        ) : groups.length === 0 ? (
          <p className="pl-empty">No checklist items yet.</p>
        ) : (
          groups.map((g) => (
            <div key={g.name}>
              <h3 className="pl-logistics-group">{g.name}</h3>
              <div className="pl-table-wrap">
                <table className="pl-table pl-logistics-table">
                  <thead>
                    <tr>
                      <th>Done</th>
                      <th>Item</th>
                      <th>Due</th>
                      <th>Waiting on</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((item) => (
                      <tr key={item.id} id={`pl-checklist-${item.id}`} tabIndex={-1} className={[item.done ? 'pl-logistics-done' : '', target === `checklist-${item.id}` ? 'pl-row-target' : ''].join(' ')}>
                        <td>
                          <input
                            type="checkbox"
                            checked={item.done}
                            aria-label={`Done: ${item.text}`}
                            onChange={(e) => void patchItem(item, { done: e.target.checked })}
                          />
                        </td>
                        <td className="pl-logistics-wide pl-logistics-text">
                          <Cell value={item.text} label="Item text" onSave={(n) => n && void patchItem(item, { text: n })} />
                        </td>
                        <td>
                          <Cell type="date" value={item.dueDate ?? ''} label={`Due date for ${item.text}`} onSave={(n) => void patchItem(item, { dueDate: n || undefined })} />
                        </td>
                        <td className="pl-logistics-wide">
                          <select
                            value={encodeWait(item.waitingOn)}
                            aria-label={`Waiting on, for ${item.text}`}
                            onChange={(e) => void patchItem(item, { waitingOn: decodeWait(e.target.value) })}
                          >
                            {waitOptions(item).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {item.waitingOn && (
                            <span className="pl-muted">
                              {' '}
                              waiting on {waitingLabel(item.waitingOn, data)}
                              {isResolved(item.waitingOn, data) ? ' (resolved)' : ''}
                            </span>
                          )}
                        </td>
                        <td>
                          <button type="button" className="pl-link-btn" onClick={() => removeItem(item)} aria-label={`Delete ${item.text}`}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    <details className="pl-page-help"><summary>How this page works</summary><p>Keep venue options, open decisions and practical tasks in one place. Table edits save when you leave a field.</p></details>
    </section>
  );
}
