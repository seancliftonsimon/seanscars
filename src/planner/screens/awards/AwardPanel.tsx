import { useSeason } from '../../hooks/useSeason';
import { useState, type FormEvent } from 'react';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { nextOrder } from '../../logic/records';
import { defaultSteps, progress, PIECE_KIND_LABELS } from '../../logic/steps';
import { pieceLengthSec } from '../../logic/clock';
import { formatDuration } from '../../logic/clockFormat';
import StepDots from '../../components/StepDots';
import type { SeasonData } from '../../hooks/useSeasonData';
import { AWARD_STAGES } from './stages';
import type { Award, AwardStage, Contender, PieceKind, WithId } from '../../types';

const PIECE_KINDS: PieceKind[] = ['award-video', 'song', 'slides-bit', 'contributor-deck', 'other'];

interface Draft {
  name: string;
  recognizes: string;
  stage: AwardStage;
  returning: boolean;
  segmentId: string;
  contenders: Contender[];
  winnerContenderId: string;
  notes: string;
}

function toDraft(award: WithId<Award> | null): Draft {
  return {
    name: award?.name ?? '',
    recognizes: award?.recognizes ?? '',
    stage: award?.stage ?? 'idea',
    returning: award?.returning ?? false,
    segmentId: award?.segmentId ?? '',
    contenders: award?.contenders ?? [],
    winnerContenderId: award?.winnerContenderId ?? '',
    notes: award?.notes ?? '',
  };
}

function newContenderId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  seasonId: string;
  /** null = adding a new award. */
  award: WithId<Award> | null;
  data: SeasonData;
  onClose: () => void;
  onOpenPiece: (pieceId: string) => void;
  /** Called with the new award's id after it is created. */
  onCreated: (awardId: string) => void;
}

/** Drawer to add or edit an award: details, contenders, winner and its pieces. */
export default function AwardPanel({ seasonId, award, data, onClose, onOpenPiece, onCreated }: Props) {
  const { season } = useSeason();
  const [draft, setDraft] = useState<Draft>(() => toDraft(award));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<PieceKind>('award-video');

  const pieces = award ? data.pieces.filter((p) => p.awardId === award.id) : [];
  const nominees = draft.contenders.filter((c) => c.nominee && c.label.trim());
  const filmByTitle = new Map(data.films.map((f) => [f.title.trim().toLowerCase(), f]));
  const filmById = new Map(data.films.map((f) => [f.id, f]));
  const filmListId = `pl-films-${award?.id ?? 'new'}`;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function setContender(index: number, patch: Partial<Contender>) {
    set(
      'contenders',
      draft.contenders.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  /** Typing a label that exactly matches a film links that film. */
  function setContenderLabel(index: number, label: string) {
    const film = filmByTitle.get(label.trim().toLowerCase());
    setContender(index, { label, filmId: film?.id });
  }

  function addContender() {
    set('contenders', [...draft.contenders, { id: newContenderId(), label: '', nominee: false }]);
  }

  function removeContender(index: number) {
    const removed = draft.contenders[index];
    setDraft((prev) => ({
      ...prev,
      contenders: prev.contenders.filter((_, i) => i !== index),
      winnerContenderId: prev.winnerContenderId === removed.id ? '' : prev.winnerContenderId,
    }));
  }

  function chooseWinner(id: string) {
    setDraft((prev) => ({
      ...prev,
      winnerContenderId: id,
      // Choosing a winner sets the stage; clearing it steps back to nominees.
      stage: id ? 'winner' : prev.stage === 'winner' ? 'nominees' : prev.stage,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setMessage('Give the award a name.');
      return;
    }
    const contenders = draft.contenders
      .filter((c) => c.label.trim())
      .map((c) => ({ ...c, label: c.label.trim(), note: c.note?.trim() || undefined }));
    const winnerValid = contenders.some((c) => c.id === draft.winnerContenderId && c.nominee);
    const fields = {
      name: draft.name.trim(),
      recognizes: draft.recognizes.trim() || undefined,
      stage: draft.stage,
      returning: draft.returning,
      segmentId: draft.segmentId || undefined,
      contenders,
      winnerContenderId: winnerValid ? draft.winnerContenderId : undefined,
      notes: draft.notes.trim() || undefined,
    };
    setBusy(true);
    try {
      if (award) {
        await updateRecord(seasonSubDoc(seasonId, 'awards', award.id), fields);
        setMessage('Saved.');
      } else {
        const id = await createRecord(seasonCol(seasonId, 'awards'), { ...fields, order: nextOrder(data.awards) });
        onCreated(id);
      }
    } catch (err) {
      setMessage(`Couldn't save: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function addPiece() {
    if (!award) return;
    try {
      const id = await createRecord(seasonCol(seasonId, 'pieces'), {
        title: award.name,
        kind: newKind,
        ownerPersonIds: [],
        awardId: award.id,
        segmentId: award.segmentId,
        order: nextOrder(data.pieces),
        steps: defaultSteps(newKind, 'todo', season?.pieceTemplates),
        links: [],
      });
      onOpenPiece(id);
    } catch (err) {
      setMessage(`Couldn't add piece: ${errorMessage(err)}`);
    }
  }

  async function handleDelete() {
    if (!award) return;
    const note = pieces.length ? ` Its ${pieces.length} piece(s) are kept, unlinked.` : '';
    if (!window.confirm(`Delete “${award.name}”?${note}`)) return;
    setBusy(true);
    try {
      await Promise.all(
        pieces.map((p) => updateRecord(seasonSubDoc(seasonId, 'pieces', p.id), { awardId: undefined })),
      );
      await deleteRecord(seasonSubDoc(seasonId, 'awards', award.id));
      onClose();
    } catch (err) {
      setMessage(`Couldn't delete: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  return (
    <aside className="pl-side-panel pl-awards-panel" aria-label={award ? `Edit ${award.name}` : 'Add award'}>
      <header className="pl-side-panel-header">
        <h2>{award ? 'Edit award' : 'Add award'}</h2>
        <button type="button" className="pl-btn pl-btn-quiet" onClick={onClose}>
          Close
        </button>
      </header>

      <p className="pl-muted pl-drawer-intro">Define the category, collect contenders, then choose your nominees and winner.</p>
      <form className="pl-form" onSubmit={handleSubmit} noValidate>
        <label className="pl-field">
          <span>Name</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} autoFocus={!award} />
        </label>
        <label className="pl-field">
          <span>Recognizes</span>
          <input value={draft.recognizes} onChange={(e) => set('recognizes', e.target.value)} />
        </label>
        <div className="pl-field-row">
          <label className="pl-field">
            <span>Stage</span>
            <select value={draft.stage} onChange={(e) => set('stage', e.target.value as AwardStage)}>
              {AWARD_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="pl-field">
            <span>Segment</span>
            <select value={draft.segmentId} onChange={(e) => set('segmentId', e.target.value)}>
              <option value="">Unassigned</option>
              {data.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="pl-check">
          <input type="checkbox" checked={draft.returning} onChange={(e) => set('returning', e.target.checked)} />
          <span>Returning award</span>
        </label>

        <fieldset className="pl-awards-contenders">
          <legend>Contenders & nominees</legend>
          <p className="pl-muted pl-now-hint">Add possibilities below. Check Nominee for your shortlist; those names appear in the winner menu.</p>
          <datalist id={filmListId}>
            {data.films.map((f) => (
              <option key={f.id} value={f.title} />
            ))}
          </datalist>
          {draft.contenders.length === 0 && <p className="pl-muted">None yet.</p>}
          {draft.contenders.map((c, i) => (
            <div key={c.id} className="pl-awards-contender">
              <input
                value={c.label}
                list={filmListId}
                placeholder="Film or person"
                aria-label="Contender"
                onChange={(e) => setContenderLabel(i, e.target.value)}
              />
              <label className="pl-check" title="Nominee">
                <input
                  type="checkbox"
                  checked={c.nominee}
                  onChange={(e) => {
                    setContender(i, { nominee: e.target.checked });
                    if (!e.target.checked && draft.winnerContenderId === c.id) chooseWinner('');
                  }}
                />
                <span>Nominee</span>
              </label>
              <button type="button" className="pl-link-btn" onClick={() => removeContender(i)} aria-label="Remove contender">
                Remove
              </button>
              <input
                className="pl-awards-contender-note"
                value={c.note ?? ''}
                placeholder="Note"
                aria-label="Contender note"
                onChange={(e) => setContender(i, { note: e.target.value })}
              />
              {c.filmId && filmById.has(c.filmId) && <span className="pl-tag">film</span>}
            </div>
          ))}
          <button type="button" className="pl-btn" onClick={addContender}>
            Add contender
          </button>
        </fieldset>

        <label className="pl-field">
          <span>Winner</span>
          <select
            value={draft.winnerContenderId}
            onChange={(e) => chooseWinner(e.target.value)}
            disabled={nominees.length === 0 && !draft.winnerContenderId}
          >
            <option value="">{nominees.length ? 'Not decided' : 'Mark nominees first'}</option>
            {nominees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pl-field">
          <span>Notes</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        <div className="pl-form-actions">
          <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : award ? 'Save' : 'Add award'}
          </button>
          {award && (
            <button type="button" className="pl-btn pl-btn-danger" onClick={handleDelete} disabled={busy}>
              Delete…
            </button>
          )}
          {message && <span className="pl-form-message">{message}</span>}
        </div>
      </form>

      {award && (
        <section className="pl-awards-panel-pieces">
          <h3>Production pieces</h3>
          <p className="pl-muted pl-now-hint">Create a video, song or slides for this award. Each starts with its own task checklist.</p>
          {pieces.length === 0 ? (
            <p className="pl-muted">No pieces yet.</p>
          ) : (
            <ul>
              {pieces.map((p) => {
                const { done, total } = progress(p);
                return (
                  <li key={p.id}>
                    <button type="button" className="pl-link-btn" onClick={() => onOpenPiece(p.id)}>
                      {p.title}
                    </button>
                    <span className="pl-muted">
                      {' '}
                      {PIECE_KIND_LABELS[p.kind]} · {done}/{total} · {formatDuration(pieceLengthSec(p))}
                    </span>
                    <StepDots steps={p.steps} />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="pl-inline-form">
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as PieceKind)} aria-label="Piece kind">
              {PIECE_KINDS.map((k) => (
                <option key={k} value={k}>{PIECE_KIND_LABELS[k]}</option>
              ))}
            </select>
            <button type="button" className="pl-btn" onClick={addPiece}>
              Add piece
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
