import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { CheckCircle2, Clapperboard, Plus, Printer, Radio } from 'lucide-react';
import { deleteRecord, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived } from '../../hooks/useDerived';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { orderForMove, renumber, moveItem } from '../../logic/order';
import { formatDuration } from '../../logic/clockFormat';
import { formatClockTime, pieceLengthSec } from '../../logic/clock';
import { PIECE_KIND_LABEL } from '../../logic/labels';
import ConfirmDialog from '../../components/ConfirmDialog';
import ClockSummary from '../../components/blocks/ClockSummary';
import { EmptyState, PageHeader, Section, Skeleton } from '../../components/ui/Basics';
import { Chip } from '../../components/ui/Chip';
import { DrawerFrame } from '../../components/ui/Drawer';
import SegmentPanel from './SegmentPanel';
import SegmentCard from './SegmentCard';
import PublishDialog from './PublishDialog';
import { PublishStatus } from './PublishStatus';
import type { Segment, WithId } from '../../types';
import './show.css';

/** Rows only move up and down. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** The run of show as a timeline, with the clock verdict on top. `?segment=<id|new>`. */
export default function ShowScreen() {
  const { season, data } = usePlanner();
  const d = useDerived();
  const [params, setParams] = useSearchParams();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const [publishing, setPublishing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<WithId<Segment> | null>(null);
  const [busy, setBusy] = useState(false);
  const segmentParam = params.get('segment');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const segments = data.segments;
  const segmentIds = useMemo(() => new Set(segments.map((s) => s.id)), [segments]);
  const unassigned = data.pieces.filter((p) => !p.segmentId || !segmentIds.has(p.segmentId));

  if (!season) {
    return <EmptyState icon={Clapperboard} title="No season yet" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create a season</Link>}>The run of show belongs to a season.</EmptyState>;
  }
  if (!d) return <div className="pl-page"><Skeleton rows={2} label="Loading run of show" /><Skeleton rows={10} /></div>;
  const sid = season.id;
  const rowsById = new Map(d.schedule.rows.map((r) => [r.segmentId, r]));
  const trimIds = new Set(d.verdict.candidates.map((c) => c.segmentId));

  const openSegment = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('segment', id);
    else p.delete('segment');
    setParams(p);
  };

  function move(from: number, to: number) {
    if (from < 0 || to < 0 || to >= segments.length || from === to) return;
    const order = orderForMove(segments, from, to);
    void write(async () => {
      if (order !== null) await updateRecord(seasonSubDoc(sid, 'segments', segments[from].id), { order });
      else {
        const changes = renumber(moveItem(segments, from, to));
        await Promise.all(changes.map((c) => updateRecord(seasonSubDoc(sid, 'segments', c.id), { order: c.order })));
      }
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(segments.findIndex((s) => s.id === active.id), segments.findIndex((s) => s.id === over.id));
  }

  const assign = (pieceId: string, segmentId: string | undefined) => {
    const piece = data.pieces.find((p) => p.id === pieceId);
    if (!piece) return;
    const seg = segments.find((s) => s.id === segmentId);
    void update(seasonSubDoc(sid, 'pieces', pieceId), piece, { segmentId }, seg ? `${piece.title} placed in ${seg.title}` : `${piece.title} removed from its segment`);
  };

  async function deleteSegment(segment: WithId<Segment>) {
    setBusy(true);
    await write(async () => {
      const here = data.pieces.filter((p) => p.segmentId === segment.id);
      await Promise.all(here.map((p) => updateRecord(seasonSubDoc(sid, 'pieces', p.id), { segmentId: undefined })));
      await deleteRecord(seasonSubDoc(sid, 'segments', segment.id));
      openSegment(null);
    }, `Deleted “${segment.title}”`);
    setBusy(false);
    setConfirmDelete(null);
  }

  const editing = segmentParam && segmentParam !== 'new' ? (segments.find((s) => s.id === segmentParam) ?? null) : null;
  const ready = d.ready.filter((r) => r.done).length;

  return (
    <>
      <div className="pl-page pl-show">
        <PageHeader
          title="Show"
          answer={segments.length ? <>Starts {formatClockTime(season.showStartTime)}. {d.verdict.headline}</> : 'No run of show yet.'}
          actions={
            <>
              <Link to="/plan/show/ready" className="pl-btn">
                <CheckCircle2 size={16} aria-hidden /> Show week <span className="pl-count">{ready}/{d.ready.length}</span>
              </Link>
              <Link to="/plan/show/print" className="pl-btn">
                <Printer size={16} aria-hidden /> Print
              </Link>
              <button type="button" className="pl-btn" onClick={() => setPublishing(true)} disabled={segments.length === 0}>
                <Radio size={16} aria-hidden /> Publish to timer
              </button>
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => openSegment('new')}>
                <Plus size={16} aria-hidden /> Add segment
              </button>
            </>
          }
        />
        <PublishStatus />

        {segments.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title="Shape the evening"
            action={
              <>
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => openSegment('new')}>Add the first segment</button>
                <Link to="/plan/season" className="pl-btn">Start from last year</Link>
              </>
            }
          >
            The run of show is the order of the night: each segment’s length, who’s on, and what plays. Times add up as you go, and the
            clock tells you whether it fits.
          </EmptyState>
        ) : (
          <div className="pl-show-layout">
            <div className="pl-show-main">
              <div className="pl-card pl-show-clock">
                <ClockSummary totals={d.schedule.totals} verdict={d.verdict} />
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ol className="pl-timeline" aria-label="Run of show">
                    {segments.map((segment, index) => {
                      const row = rowsById.get(segment.id);
                      if (!row) return null;
                      return (
                        <SegmentCard
                          key={segment.id}
                          segment={segment}
                          row={row}
                          pieces={data.pieces.filter((p) => p.segmentId === segment.id)}
                          unassigned={unassigned}
                          peopleById={data.peopleById}
                          expanded={expanded.has(segment.id)}
                          trim={trimIds.has(segment.id)}
                          onToggle={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (!next.delete(segment.id)) next.add(segment.id);
                              return next;
                            })
                          }
                          onEdit={() => openSegment(segment.id)}
                          onLength={(plannedSec) =>
                            void update(seasonSubDoc(sid, 'segments', segment.id), segment, { plannedSec }, `${segment.title}: ${formatDuration(plannedSec)}`)
                          }
                          onAssign={(pieceId) => assign(pieceId, segment.id)}
                          onUnassign={(pieceId) => assign(pieceId, undefined)}
                          onMove={(delta) => move(index, index + delta)}
                        />
                      );
                    })}
                    <li className="pl-tl-end">
                      <div className="pl-tl-time pl-num">{d.schedule.rows.length ? formatEnd(season.showStartTime, d.schedule.totals.totalSec) : ''}</div>
                      <div className="pl-small pl-muted">End of show</div>
                    </li>
                  </ol>
                </SortableContext>
              </DndContext>
            </div>
            <aside className="pl-show-side">
              <Section title={`Not placed yet (${unassigned.length})`}>
                {unassigned.length === 0 ? (
                  <p className="pl-small pl-muted">Every piece has a segment.</p>
                ) : (
                  <ul className="pl-list">
                    {unassigned.map((p) => (
                      <li key={p.id}>
                        <div className="pl-list-row pl-unplaced">
                          <div className="pl-list-main">
                            <Link to={`/plan/make?piece=${p.id}`} className="pl-list-title">{p.title}</Link>
                            <span className="pl-list-meta">
                              <Chip tone="faint">{PIECE_KIND_LABEL[p.kind]}</Chip> {formatDuration(pieceLengthSec(p))}
                            </span>
                          </div>
                          <select value="" aria-label={`Place ${p.title}`} onChange={(e) => e.target.value && assign(p.id, e.target.value)}>
                            <option value="">Place in…</option>
                            {segments.map((s) => (
                              <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                          </select>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </aside>
          </div>
        )}
      </div>

      {segmentParam && (segmentParam === 'new' || editing) && (
        <DrawerFrame onClose={() => openSegment(null)}>
          <SegmentPanel
            key={segmentParam}
            seasonId={sid}
            segment={editing}
            segments={segments}
            people={data.people}
            onClose={() => openSegment(null)}
            onDelete={setConfirmDelete}
          />
        </DrawerFrame>
      )}

      {publishing && <PublishDialog season={season} segments={segments} people={data.people} publishes={data.publishes} onClose={() => setPublishing(false)} />}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${confirmDelete.title}”?`}
          message={data.pieces.some((p) => p.segmentId === confirmDelete.id) ? 'Its pieces are kept and become unplaced.' : 'This removes the segment from the run of show.'}
          confirmLabel="Delete segment"
          busy={busy}
          onConfirm={() => void deleteSegment(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

function formatEnd(start: string, totalSec: number): string {
  const [h, m] = start.split(':').map(Number);
  const mins = (h * 60 + m + Math.round(totalSec / 60)) % (24 * 60);
  const hh = Math.floor(mins / 60);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mins % 60).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}
