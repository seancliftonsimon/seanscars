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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { seasonSubDoc, updateRecord } from '../../firestore';
import { pieceLengthSec } from '../../logic/clock';
import { formatDuration } from '../../logic/clockFormat';
import { moveItem, orderForMove, renumber } from '../../logic/order';
import { derivedWaiting } from '../../logic/waiting';
import StepDots from '../../components/StepDots';
import type { SeasonData } from '../../hooks/useSeasonData';
import type { Award, Piece, WithId } from '../../types';
import { AWARD_STAGES } from './stages';

/** Rows only move up and down. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface RowProps {
  award: WithId<Award>;
  pieces: WithId<Piece>[];
  segmentTitle: string;
  waitingCount: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
}

function AwardRow({ award, pieces, segmentTitle, waitingCount, selected, onSelect, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: award.id,
  });
  const totalSec = pieces.reduce((sum, p) => sum + pieceLengthSec(p), 0);
  const classes = ['pl-awards-row', isDragging && 'is-dragging', selected && 'is-selected'].filter(Boolean).join(' ');

  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={classes}>
      <td className="pl-seg-handle">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="pl-drag-handle"
          aria-label={`Move ${award.name}`}
          title="Drag, or Alt+↑ / Alt+↓"
          {...attributes}
          {...listeners}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              onMove(e.key === 'ArrowUp' ? -1 : 1);
              return;
            }
            listeners?.onKeyDown?.(e);
          }}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      </td>
      <td>
        <button type="button" className="pl-link-btn pl-seg-title" onClick={onSelect}>
          {award.name}
        </button>
        {award.returning && <span className="pl-tag">returning</span>}
      </td>
      <td>{segmentTitle || <span className="pl-muted">—</span>}</td>
      <td className="pl-num">{pieces.length ? formatDuration(totalSec) : <span className="pl-muted">—</span>}</td>
      <td>
        {pieces.length === 0 ? (
          <span className="pl-muted">no pieces</span>
        ) : (
          <div className="pl-awards-dots">
            {pieces.map((p) => (
              <StepDots key={p.id} steps={p.steps} />
            ))}
          </div>
        )}
        {waitingCount > 0 && <span className="pl-muted pl-awards-waiting">{waitingCount} waiting on winner</span>}
      </td>
    </tr>
  );
}

interface Props {
  seasonId: string;
  data: SeasonData;
  selectedAwardId: string | null;
  onSelect: (awardId: string) => void;
  onAdd: () => void;
  onError: (message: string) => void;
}

/** Awards grouped by stage; drag within a stage to reorder. */
export default function AwardsTab({ seasonId, data, selectedAwardId, onSelect, onAdd, onError }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const segmentTitles = new Map(data.segments.map((s) => [s.id, s.title]));

  function piecesFor(awardId: string) {
    return data.pieces.filter((p) => p.awardId === awardId);
  }

  /** Moves within one stage group; orders are global, so neighbors come from the group. */
  function move(group: WithId<Award>[], from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= group.length) return;
    const order = orderForMove(group, from, to);
    const writes =
      order !== null ? [{ id: group[from].id, order }] : renumber(moveItem(group, from, to));
    Promise.all(writes.map((w) => updateRecord(seasonSubDoc(seasonId, 'awards', w.id), { order: w.order }))).catch(
      (err: unknown) => onError(err instanceof Error ? err.message : String(err)),
    );
  }

  function handleDragEnd(group: WithId<Award>[]) {
    return ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      move(
        group,
        group.findIndex((a) => a.id === active.id),
        group.findIndex((a) => a.id === over.id),
      );
    };
  }

  if (data.awards.length === 0) {
    return (
      <div className="pl-empty">
        No awards yet.{' '}
        <button type="button" className="pl-link-btn" onClick={onAdd}>
          Add one
        </button>
        , or promote an idea from Films &amp; ideas.
      </div>
    );
  }

  return (
    <div className="pl-awards-groups">
      {AWARD_STAGES.map((stage) => {
        const group = data.awards.filter((a) => a.stage === stage);
        if (group.length === 0) return null;
        return (
          <section key={stage} className="pl-awards-group">
            <h2 className="pl-awards-stage">
              {stage} <span className="pl-muted">{group.length}</span>
            </h2>
            <div className="pl-table-wrap">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd(group)}
              >
                <table className="pl-table pl-awards-table">
                  <thead>
                    <tr>
                      <th aria-label="Reorder" />
                      <th>Award</th>
                      <th>Segment</th>
                      <th>Length</th>
                      <th>Pieces</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SortableContext items={group.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                      {group.map((award, index) => {
                        const pieces = piecesFor(award.id);
                        const waitingCount = pieces.filter((p) => derivedWaiting(p, data)?.derived).length;
                        return (
                          <AwardRow
                            key={award.id}
                            award={award}
                            pieces={pieces}
                            segmentTitle={award.segmentId ? (segmentTitles.get(award.segmentId) ?? '') : ''}
                            waitingCount={waitingCount}
                            selected={award.id === selectedAwardId}
                            onSelect={() => onSelect(award.id)}
                            onMove={(delta) => move(group, index, index + delta)}
                          />
                        );
                      })}
                    </SortableContext>
                  </tbody>
                </table>
              </DndContext>
            </div>
          </section>
        );
      })}
    </div>
  );
}
