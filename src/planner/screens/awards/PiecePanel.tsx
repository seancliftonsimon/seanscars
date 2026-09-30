import { Link } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useMemo, useState, type FormEvent } from 'react';
import StepDots from '../../components/StepDots';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc, updateRecord, savePieceTemplate } from '../../firestore';
import { errorMessage } from '../../errors';
import { parseLength } from '../../logic/duration';
import { formatDuration } from '../../logic/clockFormat';
import { nextOrder } from '../../logic/records';
import { cycleStep, defaultSteps, revisionReceived, uniqueStepKey, reusableSteps, PIECE_KIND_LABELS, STEP_STATUS_LABELS } from '../../logic/steps';
import { derivedWaiting, waitingLabel } from '../../logic/waiting';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Link as PieceLink, Piece, PieceKind, PieceStep, WaitingOn, WithId } from '../../types';
import './awards.css';

const KINDS: PieceKind[] = ['award-video', 'song', 'slides-bit', 'contributor-deck', 'other'];

interface Draft {
  title: string;
  kind: PieceKind;
  ownerPersonIds: string[];
  awardId: string;
  segmentId: string;
  steps: PieceStep[];
  dueDate: string;
  est: string;
  confirmed: string;
  measured: string;
  links: PieceLink[];
  waiting: string; // '' | 'kind:id'
  notes: string;
}

const lengthText = (sec?: number) => (sec === undefined ? '' : formatDuration(sec));
const waitingValue = (w?: WaitingOn) => (w ? `${w.kind}:${w.id}` : '');

function parseWaiting(value: string): WaitingOn | undefined {
  if (!value) return undefined;
  const at = value.indexOf(':');
  return { kind: value.slice(0, at) as WaitingOn['kind'], id: value.slice(at + 1) };
}

function toDraft(piece: WithId<Piece> | null, defaults?: Partial<Piece>): Draft {
  const base = piece ?? defaults;
  const kind = base?.kind ?? 'other';
  return {
    title: piece?.title ?? defaults?.title ?? '',
    kind,
    ownerPersonIds: base?.ownerPersonIds ?? [],
    awardId: base?.awardId ?? '',
    segmentId: base?.segmentId ?? '',
    steps: piece?.steps ?? defaults?.steps ?? defaultSteps(kind),
    dueDate: base?.dueDate ?? '',
    est: lengthText(base?.estSec),
    confirmed: lengthText(base?.confirmedSec),
    measured: lengthText(base?.measuredSec),
    links: base?.links ?? [],
    waiting: waitingValue(base?.waitingOn),
    notes: base?.notes ?? '',
  };
}

/** Uses today's date in local time as YYYY-MM-DD. */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Props {
  seasonId: string;
  /** null = adding a new piece. Give the panel a `key` per piece. */
  piece: WithId<Piece> | null;
  defaults?: Partial<Piece>;
  data: SeasonData;
  onClose: () => void;
}

/** Side panel to add or edit a piece. */
export default function PiecePanel({ seasonId, piece, defaults, data, onClose }: Props) {
  const { season } = useSeason();
  const [draft, setDraft] = useState<Draft>(() => toDraft(piece, {
    ...defaults, steps: defaults?.steps ?? defaultSteps(defaults?.kind ?? 'other', 'todo', season?.pieceTemplates),
  }));
  const [peopleFilter, setPeopleFilter] = useState('');
  const [newStep, setNewStep] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'title' | 'est' | 'confirmed' | 'measured', string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ref = piece ? seasonSubDoc(seasonId, 'pieces', piece.id) : null;
  // Existing pieces read steps live from Firestore; new pieces edit the draft.
  const steps = piece ? piece.steps : draft.steps;

  const filter = peopleFilter.trim().toLowerCase();
  const visiblePeople = useMemo(
    () =>
      data.people.filter(
        (p) => draft.ownerPersonIds.includes(p.id) || !filter || p.name.toLowerCase().includes(filter),
      ),
    [data.people, draft.ownerPersonIds, filter],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function setKind(kind: PieceKind) {
    setDraft((prev) => ({ ...prev, kind, steps: piece ? prev.steps : defaultSteps(kind, 'todo', season?.pieceTemplates) }));
  }

  function toggleOwner(id: string) {
    set(
      'ownerPersonIds',
      draft.ownerPersonIds.includes(id) ? draft.ownerPersonIds.filter((x) => x !== id) : [...draft.ownerPersonIds, id],
    );
  }

  /** Applies a steps change: straight to Firestore for existing pieces, to the draft for new ones. */
  async function changeSteps(next: PieceStep[]) {
    if (!ref) {
      set('steps', next);
      return;
    }
    setMessage(null);
    try {
      await updateRecord(ref, { steps: next });
    } catch (err) {
      setMessage(`Couldn't update steps: ${errorMessage(err)}`);
    }
  }

  function renameStep(index: number, label: string) {
    const trimmed = label.trim();
    if (!trimmed || trimmed === steps[index].label) return;
    void changeSteps(steps.map((s, i) => (i === index ? { ...s, label: trimmed } : s)));
  }

  function addStep() {
    const label = newStep.trim();
    if (!label) return;
    const key = uniqueStepKey(label, steps);
    setNewStep('');
    void changeSteps([...steps, { key, label, status: 'todo' }]);
  }

  function setLink(index: number, patch: Partial<PieceLink>) {
    set(
      'links',
      draft.links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  async function handleRevision() {
    if (!ref || !piece) return;
    setMessage(null);
    try {
      const { steps: nextSteps, notes } = revisionReceived(piece, todayIso());
      await updateRecord(ref, { steps: nextSteps, notes });
      setDraft((prev) => ({ ...prev, notes: notes ?? '' }));
    } catch (err) {
      setMessage(`Couldn't record the revision: ${errorMessage(err)}`);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const lengths: Record<'est' | 'confirmed' | 'measured', number | undefined> = {
      est: undefined,
      confirmed: undefined,
      measured: undefined,
    };
    for (const field of ['est', 'confirmed', 'measured'] as const) {
      const text = draft[field].trim();
      if (!text) continue;
      const sec = parseLength(text);
      if (sec === null) next[field] = 'Use m:ss or minutes, e.g. 6:30 or 6.5.';
      else lengths[field] = sec;
    }
    if (!draft.title.trim()) next.title = 'Give it a title.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const links = draft.links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url);
    const fields = {
      title: draft.title.trim(),
      kind: draft.kind,
      ownerPersonIds: draft.ownerPersonIds,
      awardId: draft.awardId || undefined,
      segmentId: draft.segmentId || undefined,
      dueDate: draft.dueDate || undefined,
      estSec: lengths.est,
      confirmedSec: lengths.confirmed,
      measuredSec: lengths.measured,
      links: links.map((l) => ({ label: l.label || l.url, url: l.url })),
      waitingOn: parseWaiting(draft.waiting),
      notes: draft.notes.trim() || undefined,
    };

    setBusy(true);
    try {
      if (ref) {
        await updateRecord(ref, fields);
      } else {
        await createRecord(seasonCol(seasonId, 'pieces'), {
          ...fields,
          steps: draft.steps,
          order: nextOrder(data.pieces),
        });
      }
      onClose();
    } catch (err) {
      setMessage(`Couldn't save: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!ref || !piece) return;
    if (!window.confirm(`Delete "${piece.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteRecord(ref);
      onClose();
    } catch (err) {
      setMessage(`Couldn't delete: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  const derived = piece ? derivedWaiting(piece, data) : null;
  const otherPieces = data.pieces.filter((p) => p.id !== piece?.id);
  const openQuestions = data.questions.filter((q) => q.status === 'open' || waitingValue({ kind: 'question', id: q.id }) === draft.waiting);

  return (
    <aside className="pl-side-panel" aria-label={piece ? `Edit ${piece.title}` : 'Add piece'}>
      <header className="pl-side-panel-header">
        <h2>{piece ? 'Edit piece' : 'Add piece'}</h2>
        <button type="button" className="pl-btn pl-btn-quiet" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="pl-muted pl-drawer-intro">Track what you’re making, the tasks it needs, and its working files.</p>
      <form className="pl-form" onSubmit={handleSubmit} noValidate>
        <label className="pl-field">
          <span>Title</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} autoFocus={!piece} />
          {errors.title && <small className="pl-error">{errors.title}</small>}
        </label>
        <label className="pl-field">
          <span>Production type</span>
          <select value={draft.kind} onChange={(e) => setKind(e.target.value as PieceKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{PIECE_KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>

        <fieldset className="pl-field pl-owner-picker">
          <legend>Owners</legend>
          <small className="pl-muted">Leave everyone unchecked for work you’re making yourself.</small>
          <input
            type="search"
            placeholder="Filter people"
            value={peopleFilter}
            onChange={(e) => setPeopleFilter(e.target.value)}
            aria-label="Filter people"
          />
          <div className="pl-owner-list">
            {visiblePeople.length === 0 ? (
              <p className="pl-muted">{data.people.length ? 'No people match.' : <>Making this with someone else? <Link to="/plan/people">Add them in People</Link>.</>}</p>
            ) : (
              visiblePeople.map((p) => (
                <label key={p.id} className="pl-check">
                  <input
                    type="checkbox"
                    checked={draft.ownerPersonIds.includes(p.id)}
                    onChange={() => toggleOwner(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <div className="pl-field-row">
          <label className="pl-field">
            <span>Award</span>
            <select value={draft.awardId} onChange={(e) => set('awardId', e.target.value)}>
              <option value="">None</option>
              {data.awards.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pl-field">
            <span>Segment</span>
            <select value={draft.segmentId} onChange={(e) => set('segmentId', e.target.value)}>
              <option value="">None</option>
              {data.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="pl-field">
          <legend>Production checklist</legend>
          <p className="pl-muted pl-now-hint">Click a status to move from To do → In progress → Done. {piece ? 'Checklist changes save immediately. ' : ''}<Link to={`/plan/templates?kind=${draft.kind}`}>Edit reusable defaults</Link></p>
          <StepDots steps={steps} size="md" />
          <ul className="pl-awards-step-list">
            {steps.map((step, index) => (
              <li key={`${step.key}-${index}`} className="pl-awards-step-row">
                <input
                  defaultValue={step.label}
                  onBlur={(e) => renameStep(index, e.target.value)}
                  aria-label={`Step ${index + 1} name`}
                />
                <button
                  type="button"
                  className="pl-btn pl-awards-step-status"
                  onClick={() => void changeSteps(cycleStep(steps, index))}
                  title="Click to cycle todo, doing, done"
                >
                  {STEP_STATUS_LABELS[step.status]}
                </button>
                <button
                  type="button"
                  className="pl-btn pl-btn-quiet"
                  onClick={() => void changeSteps(steps.filter((_, i) => i !== index))}
                  aria-label={`Remove step ${step.label}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="pl-awards-step-row">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStep();
                }
              }}
              placeholder="New step"
              aria-label="New step name"
            />
            <button type="button" className="pl-btn" onClick={addStep}>
              Add step
            </button>
          </div>
          {piece && draft.kind === 'contributor-deck' && (
            <div>
              <button type="button" className="pl-btn" onClick={() => void handleRevision()}>
                Revision received
              </button>
            </div>
          )}
        </fieldset>

        <button type="button" className="pl-btn" disabled={busy || steps.length === 0 || !season || steps.some((s) => !s.label.trim())} onClick={async () => {
          if (!season || !window.confirm(`Use this checklist as the default for new ${PIECE_KIND_LABELS[draft.kind].toLowerCase()} pieces? Existing pieces keep their progress.`)) return;
          setBusy(true);
          try { await savePieceTemplate(seasonId, draft.kind, reusableSteps(steps)); setMessage('Default template saved for future pieces.'); }
          catch (err) { setMessage(`Couldn't save template: ${errorMessage(err)}`); }
          finally { setBusy(false); }
        }}>Save checklist as reusable default</button>
        <label className="pl-field">
          <span>Due date</span>
          <input type="date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </label>
        <div className="pl-field-row">
          {(
            [
              ['est', 'Estimated'],
              ['confirmed', 'Confirmed'],
              ['measured', 'Measured'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="pl-field">
              <span>{label}</span>
              <input value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder="m:ss" />
              {errors[key] ? <small className="pl-error">{errors[key]}</small> : <small className="pl-muted">m:ss</small>}
            </label>
          ))}
        </div>

        <fieldset className="pl-field">
          <legend>Links</legend>
          {draft.links.map((l, i) => (
            <div key={i} className="pl-awards-link-row">
              <input
                value={l.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Label"
                aria-label={`Link ${i + 1} label`}
              />
              <input
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://"
                aria-label={`Link ${i + 1} URL`}
              />
              {l.url.trim() && (
                <a className="pl-awards-link-open" href={l.url.trim()} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
              <button
                type="button"
                className="pl-btn pl-btn-quiet"
                onClick={() => set('links', draft.links.filter((_, j) => j !== i))}
                aria-label={`Remove link ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="pl-btn" onClick={() => set('links', [...draft.links, { label: '', url: '' }])}>
              Add link
            </button>
          </div>
        </fieldset>

        <label className="pl-field">
          <span>Waiting on</span>
          <select value={draft.waiting} onChange={(e) => set('waiting', e.target.value)}>
            <option value="">Nothing</option>
            <optgroup label="Awards">
              {data.awards.map((a) => (
                <option key={a.id} value={`award:${a.id}`}>
                  {a.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pieces">
              {otherPieces.map((p) => (
                <option key={p.id} value={`piece:${p.id}`}>
                  {p.title}
                </option>
              ))}
            </optgroup>
            <option value="venue:any">Venue booking</option>
            <optgroup label="Open questions">
              {openQuestions.map((q) => (
                <option key={q.id} value={`question:${q.id}`}>
                  {q.question}
                </option>
              ))}
            </optgroup>
          </select>
          {derived && (
            <small className="pl-muted pl-awards-wait-note">
              Waiting on {waitingLabel(derived, data)}
              {derived.derived ? ' (automatic)' : ''}
            </small>
          )}
        </label>

        <label className="pl-field">
          <span>Notes</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        <div className="pl-form-actions">
          <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : piece ? 'Save' : 'Add piece'}
          </button>
          {piece && (
            <button type="button" className="pl-btn pl-btn-danger" onClick={() => void handleDelete()} disabled={busy}>
              Delete…
            </button>
          )}
          {message && <span className="pl-form-message">{message}</span>}
        </div>
      </form>
    </aside>
  );
}
