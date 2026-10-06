import { useState, type FormEvent } from 'react';
import { getDoc } from 'firebase/firestore';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, TriangleAlert } from 'lucide-react';
import { AWARD_STAGE_LABEL, PIECE_KIND_LABEL } from '../../logic/labels';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { nextOrder } from '../../logic/records';
import {
  awardFingerprint,
  changedSince,
  composeLabel,
  ensureSlugs,
  isDecided,
  layoutWarnings,
  listNames,
  stampMs,
  variantOf,
  VARIANT_LABEL,
  VARIANTS,
  winnersOf,
  type AwardVersion,
} from '../../logic/showGraphics';
import { defaultSteps, progress } from '../../logic/steps';
import { pieceLengthSec } from '../../logic/clock';
import { formatDuration } from '../../logic/clockFormat';
import StepDots from '../../components/StepDots';
import { derivedWaiting } from '../../logic/waiting';
import type { SeasonData } from '../../hooks/useSeasonData';
import { AWARD_STAGES } from './stages';
import type { Award, AwardStage, AwardVariant, Contender, Film, PieceKind, WithId } from '../../types';

const PIECE_KINDS: PieceKind[] = ['award-video', 'song', 'slides-bit', 'contributor-deck', 'other'];

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface Draft {
  name: string;
  recognizes: string;
  variant: AwardVariant;
  shortName: string;
  stage: AwardStage;
  returning: boolean;
  segmentId: string;
  contenders: Contender[];
  /** In the order they were ticked. */
  winnerContenderIds: string[];
  notes: string;
}

function toDraft(award: WithId<Award> | null, filmById: Map<string, WithId<Film>>): Draft {
  return {
    name: award?.name ?? '',
    recognizes: award?.recognizes ?? '',
    variant: variantOf(award ?? {}),
    shortName: award?.shortName ?? '',
    stage: award?.stage ?? 'idea',
    returning: award?.returning ?? false,
    segmentId: award?.segmentId ?? '',
    // A contender linked to a film on the list shows that film's title in the film box.
    contenders: (award?.contenders ?? []).map((c) => {
      const linked = !c.film && c.filmId ? filmById.get(c.filmId) : undefined;
      return linked ? { ...c, film: linked.title } : c;
    }),
    winnerContenderIds: award?.winnerContenderIds ?? [],
    notes: award?.notes ?? '',
  };
}

function versionOf(award: WithId<Award>): AwardVersion {
  return { updatedMs: stampMs(award.updatedAt), fingerprint: awardFingerprint(award) };
}

/** Any winner means the stage is "winner"; clearing them all steps back to "nominees". */
function withWinners(draft: Draft, ids: string[]): Draft {
  return {
    ...draft,
    winnerContenderIds: ids,
    stage: ids.length > 0 ? 'winner' : draft.stage === 'winner' ? 'nominees' : draft.stage,
  };
}

function newContenderId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface RowProps {
  contender: Contender;
  index: number;
  variant: AwardVariant;
  filmListId: string;
  linkedFilm: boolean;
  isWinner: boolean;
  onPatch: (id: string, patch: Partial<Contender>) => void;
  onFilm: (id: string, film: string) => void;
  onToggleWinner: (id: string, on: boolean) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
}

/** One contender: person, film, caption, note, and whether it is a nominee and a winner. Drag to reorder. */
function ContenderRow({ contender: c, index, variant, filmListId, linkedFilm, isWinner, onPatch, onFilm, onToggleWinner, onRemove, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const honoree = variant === 'honoree';
  const unsplit = !c.personName?.trim() && !c.film?.trim() && c.label.trim();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`pl-awards-row${isDragging ? ' is-dragging' : ''}`}
      role="group"
      aria-label={`Contender ${index + 1}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="pl-drag-handle"
        aria-label={`Move contender ${index + 1}`}
        title="Drag, or Alt+↑ / Alt+↓"
        {...attributes}
        {...listeners}
        onKeyDown={(e) => {
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            onMove(index, e.key === 'ArrowUp' ? -1 : 1);
            return;
          }
          listeners?.onKeyDown?.(e);
        }}
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <div className="pl-awards-row-body">
        <div className="pl-awards-row-names">
          <input
            value={c.personName ?? ''}
            placeholder={variant === 'film-only' ? 'Person (not shown)' : honoree ? 'Honoree' : 'Person'}
            aria-label="Person"
            onChange={(e) => onPatch(c.id, { personName: e.target.value })}
          />
          <input
            value={c.film ?? ''}
            list={filmListId}
            placeholder="Film"
            aria-label="Film"
            onChange={(e) => onFilm(c.id, e.target.value)}
          />
        </div>
        <input
          value={c.caption ?? ''}
          placeholder="Caption"
          aria-label="Caption"
          onChange={(e) => onPatch(c.id, { caption: e.target.value })}
        />
        <input
          className="pl-awards-row-note"
          value={c.note ?? ''}
          placeholder="Note (planner only)"
          aria-label="Contender note"
          onChange={(e) => onPatch(c.id, { note: e.target.value })}
        />
        {unsplit && (
          <p className="pl-muted pl-small pl-awards-row-hint">
            Shown as “{c.label}”. Fill in a person or film to replace it.
          </p>
        )}
        <div className="pl-awards-row-flags">
          <label className="pl-check" title={honoree ? 'Honoree' : 'Nominee'}>
            <input type="checkbox" checked={c.nominee} onChange={(e) => onPatch(c.id, { nominee: e.target.checked })} />
            <span>{honoree ? 'Honoree' : 'Nominee'}</span>
          </label>
          {!honoree && (
            <label className="pl-check" title="Winner, nominated or not">
              <input type="checkbox" checked={isWinner} onChange={(e) => onToggleWinner(c.id, e.target.checked)} />
              <span>Winner</span>
            </label>
          )}
          {linkedFilm && <span className="pl-tag">film</span>}
          <button type="button" className="pl-link-btn pl-awards-row-remove" onClick={() => onRemove(c.id)} aria-label={`Remove contender ${index + 1}`}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  seasonId: string;
  /** The season's year, for the award's Show ID (`best-sheep-2027`). */
  year: number;
  /** null = adding a new award. */
  award: WithId<Award> | null;
  data: SeasonData;
  onClose: () => void;
  onOpenPiece: (pieceId: string) => void;
  /** Called with the new award's id after it is created. */
  onCreated: (awardId: string) => void;
}

/** Drawer to add or edit an award: details, contenders, winners and its pieces. */
export default function AwardPanel({ seasonId, year, award, data, onClose, onOpenPiece, onCreated }: Props) {
  const filmByTitle = new Map(data.films.map((f) => [f.title.trim().toLowerCase(), f]));
  const filmById = new Map(data.films.map((f) => [f.id, f]));
  const [draft, setDraft] = useState<Draft>(() => toDraft(award, filmById));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<PieceKind>('award-video');
  const [unblocked, setUnblocked] = useState<{ id: string; title: string }[]>([]);
  // What the panel loaded, to notice if the award changed elsewhere before saving.
  const [loaded, setLoaded] = useState<AwardVersion | null>(() => (award ? versionOf(award) : null));
  const [stale, setStale] = useState<WithId<Award> | null>(null);
  // Set on the first save and never changed after.
  const [slug, setSlug] = useState<string | undefined>(award?.slug);

  const pieces = award ? data.pieces.filter((p) => p.awardId === award.id) : [];
  const filmListId = `pl-films-${award?.id ?? 'new'}`;
  const honoree = draft.variant === 'honoree';
  const winners = winnersOf({ contenders: draft.contenders, winnerContenderIds: draft.winnerContenderIds }).filter((c) => composeLabel(c));
  const warnings = layoutWarnings({
    variant: draft.variant,
    shortName: draft.shortName,
    contenders: draft.contenders,
    winnerContenderIds: honoree ? [] : draft.winnerContenderIds,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function patchContender(id: string, patch: Partial<Contender>) {
    setDraft((prev) => ({ ...prev, contenders: prev.contenders.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    setMessage(null);
  }

  /** Typing a film that exactly matches one on the list links it. */
  function setContenderFilm(id: string, film: string) {
    patchContender(id, { film, filmId: filmByTitle.get(film.trim().toLowerCase())?.id });
  }

  function addContender() {
    set('contenders', [...draft.contenders, { id: newContenderId(), label: '', nominee: false }]);
  }

  function removeContender(id: string) {
    setDraft((prev) => {
      const next = { ...prev, contenders: prev.contenders.filter((c) => c.id !== id) };
      // Only removing a winner can change the stage.
      return prev.winnerContenderIds.includes(id) ? withWinners(next, prev.winnerContenderIds.filter((w) => w !== id)) : next;
    });
  }

  function moveContender(from: number, to: number) {
    if (from === to || to < 0 || to >= draft.contenders.length) return;
    set('contenders', arrayMove(draft.contenders, from, to));
  }

  /** Any contender can win, nominated or not. Ties are just more than one. */
  function toggleWinner(id: string, on: boolean) {
    setDraft((prev) => withWinners(prev, on ? [...prev.winnerContenderIds.filter((w) => w !== id), id] : prev.winnerContenderIds.filter((w) => w !== id)));
    setMessage(null);
  }

  /** The stored award, or the live copy if it can't be read (offline). */
  async function readStored(id: string): Promise<WithId<Award> | null> {
    try {
      const snap = await getDoc(seasonSubDoc(seasonId, 'awards', id));
      return snap.exists() ? (snap.data() ?? null) : null;
    } catch {
      return award;
    }
  }

  function reload() {
    if (!stale) return;
    setDraft(toDraft(stale, filmById));
    setLoaded(versionOf(stale));
    setSlug(stale.slug);
    setStale(null);
    setUnblocked([]);
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setMessage('Give the award a name.');
      return;
    }
    setBusy(true);
    try {
      // Someone else (or the show sync) may have changed this award since the panel opened.
      if (award && loaded) {
        const stored = await readStored(award.id);
        if (!stored) {
          setMessage('This award was deleted since you opened it.');
          return;
        }
        if (changedSince(loaded, versionOf(stored))) {
          setStale(stored);
          return;
        }
      }

      // Only what has a name is kept. `label` is always written from person and film.
      const contenders = draft.contenders
        .filter((c) => composeLabel(c))
        .map((c) => ({
          ...c,
          label: composeLabel(c),
          personName: c.personName?.trim() || undefined,
          film: c.film?.trim() || undefined,
          caption: c.caption?.trim() || undefined,
          note: c.note?.trim() || undefined,
        }));
      const winnerIds = honoree ? [] : draft.winnerContenderIds.filter((id) => contenders.some((c) => c.id === id));
      const variant = draft.variant === 'standard' ? undefined : draft.variant;
      const withSlugs = ensureSlugs(
        {
          id: award?.id,
          name: draft.name.trim(),
          slug: slug ?? award?.slug,
          contenders,
        },
        data.awards,
        year,
      );
      const fields = {
        name: withSlugs.name,
        recognizes: draft.recognizes.trim() || undefined,
        variant,
        shortName: draft.shortName.trim() || undefined,
        slug: withSlugs.slug,
        stage: draft.stage,
        returning: draft.returning,
        segmentId: draft.segmentId || undefined,
        contenders: withSlugs.contenders,
        winnerContenderIds: winnerIds.length > 0 ? winnerIds : undefined,
        notes: draft.notes.trim() || undefined,
      };

      if (award) {
        // Pieces that were waiting on this award's winner, to show what the decision unblocks.
        const decidedNow = isDecided({ variant: fields.variant, contenders: fields.contenders, winnerContenderIds: fields.winnerContenderIds });
        const waiting = !isDecided(award) && decidedNow ? pieces.filter((p) => derivedWaiting(p, data)?.kind === 'award') : [];
        const ref = seasonSubDoc(seasonId, 'awards', award.id);
        await updateRecord(ref, fields);
        setUnblocked(waiting.map((p) => ({ id: p.id, title: p.title })));
        setMessage('Saved.');
        // The panel now holds what it saved, so the next save compares against that.
        const after = await readStored(award.id);
        setLoaded({ updatedMs: stampMs(after?.updatedAt), fingerprint: awardFingerprint({ ...award, ...fields }) });
      } else {
        const id = await createRecord(seasonCol(seasonId, 'awards'), { ...fields, order: nextOrder(data.awards) });
        onCreated(id);
      }
      // Slugs are set once: keep them in the form so a rename or a re-save never regenerates them.
      setSlug(fields.slug);
      const slugById = new Map(fields.contenders.map((c) => [c.id, c.slug]));
      setDraft((prev) => ({ ...prev, contenders: prev.contenders.map((c) => (c.slug ? c : { ...c, slug: slugById.get(c.id) })) }));
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
        steps: defaultSteps(newKind),
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

      {stale && (
        <div className="pl-banner is-warn pl-awards-stale" role="alert">
          <TriangleAlert size={16} aria-hidden />
          <div>
            <p>This award changed since you opened it.</p>
            <p className="pl-muted pl-small">Nothing was saved. Reloading shows the latest and drops the edits you haven’t saved.</p>
            <button type="button" className="pl-btn pl-btn-sm" onClick={reload}>
              Reload
            </button>
          </div>
        </div>
      )}

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
            <span>Frame</span>
            <select value={draft.variant} onChange={(e) => set('variant', e.target.value as AwardVariant)}>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>{VARIANT_LABEL[v]}</option>
              ))}
            </select>
          </label>
          <label className="pl-field">
            <span>Short name</span>
            <input value={draft.shortName} onChange={(e) => set('shortName', e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <label className="pl-field">
          <span>Show ID</span>
          <input value={slug ?? ''} readOnly placeholder="Assigned when you save" aria-label="Show ID" />
          <small className="pl-muted">Set once. Renaming the award keeps it, so run cues keep working.</small>
        </label>
        <div className="pl-field-row">
          <label className="pl-field">
            <span>Stage</span>
            <select value={draft.stage} onChange={(e) => set('stage', e.target.value as AwardStage)}>
              {AWARD_STAGES.map((s) => (
                <option key={s} value={s}>{AWARD_STAGE_LABEL[s]}</option>
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
          <legend>{honoree ? 'Honorees and other contenders' : 'Contenders'}</legend>
          <datalist id={filmListId}>
            {data.films.map((f) => (
              <option key={f.id} value={f.title} />
            ))}
          </datalist>
          {draft.contenders.length === 0 && <p className="pl-muted">None yet.</p>}
          {draft.contenders.length > 1 && (
            <p className="pl-muted pl-small">
              Drag to reorder. {honoree ? 'Honorees' : 'Nominees'} appear on screen in this order.
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={({ active, over }: DragEndEvent) => {
              if (!over || active.id === over.id) return;
              moveContender(
                draft.contenders.findIndex((c) => c.id === active.id),
                draft.contenders.findIndex((c) => c.id === over.id),
              );
            }}
          >
            <SortableContext items={draft.contenders.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {draft.contenders.map((c, i) => (
                <ContenderRow
                  key={c.id}
                  contender={c}
                  index={i}
                  variant={draft.variant}
                  filmListId={filmListId}
                  linkedFilm={Boolean(c.filmId && filmById.has(c.filmId))}
                  isWinner={draft.winnerContenderIds.includes(c.id)}
                  onPatch={patchContender}
                  onFilm={setContenderFilm}
                  onToggleWinner={toggleWinner}
                  onRemove={removeContender}
                  onMove={(from, delta) => moveContender(from, from + delta)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button type="button" className="pl-btn" onClick={addContender}>
            Add contender
          </button>
        </fieldset>

        <p className="pl-awards-winners" role="status">
          {honoree
            ? 'Honoree awards have no winner. Tick Honoree on one or two contenders.'
            : winners.length === 0
              ? 'No winner yet. Tick Winner on any contender, nominated or not. Two or more is a tie.'
              : `${winners.length > 1 ? 'Tie: ' : 'Winner: '}${listNames(winners.map(composeLabel))}${winners.some((c) => !c.nominee) ? ' (not all nominated)' : ''}`}
        </p>

        {warnings.length > 0 && (
          <div className="pl-banner is-warn pl-awards-warnings" role="status">
            <TriangleAlert size={16} aria-hidden />
            <div>
              <p>This may not fit on screen. You can still save it.</p>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
        {unblocked.length > 0 && (
          <div className="pl-banner is-good" role="status">
            <span>
              {honoree ? 'Honorees set.' : 'Winner picked.'} Now unblocked:{' '}
              {unblocked.map((p, i) => (
                <span key={p.id}>
                  <button type="button" className="pl-link-btn" onClick={() => onOpenPiece(p.id)}>
                    {p.title}
                  </button>
                  {i < unblocked.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          </div>
        )}
      </form>

      {award && (
        <section className="pl-awards-panel-pieces">
          <h3>Pieces</h3>
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
                      {PIECE_KIND_LABEL[p.kind]} · {done}/{total} · {formatDuration(pieceLengthSec(p))}
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
                <option key={k} value={k}>{PIECE_KIND_LABEL[k]}</option>
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
