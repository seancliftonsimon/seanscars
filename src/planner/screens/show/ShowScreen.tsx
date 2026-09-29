import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSeason } from '../../hooks/useSeason';
import { useCollection } from '../../hooks/useCollection';
import { deleteRecord, peopleCol, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { computeSchedule } from '../../logic/clock';
import { orderForMove, renumber, moveItem } from '../../logic/order';
import ClockBar from '../../components/ClockBar';
import ConfirmDialog from '../../components/ConfirmDialog';
import SegmentPanel from './SegmentPanel';
import SegmentRow from './SegmentRow';
import PublishDialog from './PublishDialog';
import { toTimerPayload } from '../../logic/timerPayload';
import { diffTimerConfigs } from '../../logic/publishDiff';
import type { Piece, Segment, WithId } from '../../types';

/** Rows only move up and down. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type Panel = { mode: 'add' } | { mode: 'edit'; id: string } | null;

export default function ShowScreen() {
  const { season } = useSeason();
  const seasonId = season?.id ?? null;
  const segmentsState = useCollection(seasonId ? seasonCol(seasonId, 'segments') : null);
  const piecesState = useCollection(seasonId ? seasonCol(seasonId, 'pieces') : null);
  const { data: people } = useCollection(peopleCol());
  const { data: publishData } = useCollection(seasonId ? seasonCol(seasonId, 'publishes') : null);
  const [publishing, setPublishing] = useState(false);

  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<WithId<Segment> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segments = useMemo(
    () => [...segmentsState.data].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    [segmentsState.data],
  );
  const pieces = piecesState.data;
  const schedule = useMemo(
    () => (season ? computeSchedule(season, segments, pieces) : null),
    [season, segments, pieces],
  );
  const rowsById = useMemo(() => new Map(schedule?.rows.map((r) => [r.segmentId, r])), [schedule]);
  const namesById = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const publishes = useMemo(
    () => [...publishData].sort((a, b) => (b.payloadUpdatedAtMs ?? 0) - (a.payloadUpdatedAtMs ?? 0)),
    [publishData],
  );
  const lastPublish = publishes[0] ?? null;
  // "Changed since" compares what would be published now with what was published last.
  const changedSincePublish = useMemo(() => {
    if (!season || !lastPublish?.segments) return false;
    const now = toTimerPayload(season, segments, new Map(people.map((p) => [p.id, p])), 0);
    const before = { showStartTime: season.showStartTime, segments: lastPublish.segments, updatedAtMs: 0 };
    return !diffTimerConfigs(before, now).identical;
  }, [season, segments, people, lastPublish]);
  const segmentIds = useMemo(() => new Set(segments.map((s) => s.id)), [segments]);
  // Pieces pointing at a deleted segment count as unassigned.
  const unassigned = pieces.filter((p) => !p.segmentId || !segmentIds.has(p.segmentId));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function names(ids: string[]): string {
    return ids.map((id) => namesById.get(id) ?? 'Unknown').join(' & ');
  }

  function presenterFor(segment: Segment): string {
    if (segment.ownerPersonIds.length > 0) return names(segment.ownerPersonIds);
    return segment.presenterLabel || 'Sean';
  }

  function pieceOwner(piece: Piece): string {
    return piece.ownerPersonIds.length > 0 ? names(piece.ownerPersonIds) : 'Sean';
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(
      segments.findIndex((s) => s.id === active.id),
      segments.findIndex((s) => s.id === over.id),
    );
  }

  function move(from: number, to: number) {
    if (!seasonId || from < 0 || to < 0 || to >= segments.length || from === to) return;
    const order = orderForMove(segments, from, to);
    void run(async () => {
      if (order !== null) {
        await updateRecord(seasonSubDoc(seasonId, 'segments', segments[from].id), { order });
      } else {
        const changes = renumber(moveItem(segments, from, to));
        await Promise.all(changes.map((c) => updateRecord(seasonSubDoc(seasonId, 'segments', c.id), { order: c.order })));
      }
    });
  }

  function setLength(segment: WithId<Segment>, plannedSec: number) {
    if (!seasonId) return;
    void run(() => updateRecord(seasonSubDoc(seasonId, 'segments', segment.id), { plannedSec }));
  }

  function assignPiece(pieceId: string, segmentId: string | undefined) {
    if (!seasonId) return;
    void run(() => updateRecord(seasonSubDoc(seasonId, 'pieces', pieceId), { segmentId }));
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSegment(segment: WithId<Segment>) {
    if (!seasonId) return;
    setBusy(true);
    // Unassign its pieces first so none point at a missing segment.
    await run(async () => {
      const piecesHere = pieces.filter((p) => p.segmentId === segment.id);
      await Promise.all(
        piecesHere.map((p) => updateRecord(seasonSubDoc(seasonId, 'pieces', p.id), { segmentId: undefined })),
      );
      await deleteRecord(seasonSubDoc(seasonId, 'segments', segment.id));
      setPanel(null);
    });
    setBusy(false);
    setConfirmDelete(null);
  }

  if (!season) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Show</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  const editing = panel?.mode === 'edit' ? (segments.find((s) => s.id === panel.id) ?? null) : null;
  const loading = segmentsState.loading || piecesState.loading;
  const loadError = segmentsState.error ?? piecesState.error;

  return (
    <>
      <section className="pl-screen pl-screen-wide">
        {schedule && <ClockBar totals={schedule.totals} />}
        <header className="pl-screen-header">
          <h1>Show</h1>
          <span className="pl-muted">
            {season.name} · starts {season.showStartTime}
          </span>
          <div className="pl-header-actions">
            <Link to="/plan/show/print" className="pl-btn">
              Print
            </Link>
            <button type="button" className="pl-btn" onClick={() => setPublishing(true)} disabled={segments.length === 0}>
              Publish to timer
            </button>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => setPanel({ mode: 'add' })}>
              Add segment
            </button>
          </div>
        </header>
        <p className="pl-muted pl-publish-status">
          {lastPublish ? (
            <>
              Last published {lastPublish.at ? lastPublish.at.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now'}{' '}
              to <code>{lastPublish.targetDocId}</code>
              {changedSincePublish && <span className="pl-tag pl-tag-switch">changed since</span>}
            </>
          ) : (
            'Not published to the timer yet.'
          )}
        </p>
        {error && <p className="pl-error">Couldn't save: {error}</p>}

        {loading ? (
          <p className="pl-muted">Loading run of show…</p>
        ) : loadError ? (
          <p className="pl-error">Couldn't load: {errorMessage(loadError)}</p>
        ) : segments.length === 0 ? (
          <p className="pl-empty">
            No segments yet. Add one, or <Link to="/plan/season">start this season from the last one</Link>.
          </p>
        ) : (
          <div className="pl-table-wrap">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <table className="pl-table pl-show-table">
                <thead>
                  <tr>
                    <th aria-label="Reorder" />
                    <th>Start</th>
                    <th>Title</th>
                    <th>Presenter</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Length</th>
                    <th>Pieces</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {segments.map((segment, index) => {
                    const row = rowsById.get(segment.id);
                    if (!row) return null;
                    return (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
                        row={row}
                        presenter={presenterFor(segment)}
                        pieces={pieces.filter((p) => p.segmentId === segment.id)}
                        unassignedPieces={unassigned}
                        ownerName={pieceOwner}
                        expanded={expanded.has(segment.id)}
                        onToggle={() => toggle(segment.id)}
                        onEdit={() => setPanel({ mode: 'edit', id: segment.id })}
                        onLength={(sec) => setLength(segment, sec)}
                        onAssign={(pieceId) => assignPiece(pieceId, segment.id)}
                        onUnassign={(pieceId) => assignPiece(pieceId, undefined)}
                        onMove={(delta) => move(index, index + delta)}
                      />
                    );
                  })}
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}
      </section>

      {panel && (panel.mode === 'add' || editing) && (
        <SegmentPanel
          key={panel.mode === 'edit' ? panel.id : 'add'}
          seasonId={season.id}
          segment={editing}
          segments={segments}
          people={people}
          onClose={() => setPanel(null)}
          onDelete={setConfirmDelete}
        />
      )}

      {publishing && (
        <PublishDialog
          season={season}
          segments={segments}
          people={people}
          publishes={publishes}
          onClose={() => setPublishing(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${confirmDelete.title}”?`}
          message={
            pieces.some((p) => p.segmentId === confirmDelete.id)
              ? 'Its pieces are kept and become unassigned.'
              : 'This removes the segment from the run of show.'
          }
          confirmLabel="Delete segment"
          busy={busy}
          onConfirm={() => void deleteSegment(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
