import { useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { formatClockTime, pieceLengthSec, type ScheduleRow } from '../../logic/clock';
import { formatDuration } from '../../logic/clockFormat';
import { nudge, parseLength } from '../../logic/duration';
import type { Piece, Segment, WithId } from '../../types';

const NUDGE_SEC = 30;

interface Props {
  segment: WithId<Segment>;
  row: ScheduleRow;
  presenter: string;
  pieces: WithId<Piece>[];
  unassignedPieces: WithId<Piece>[];
  ownerName: (piece: Piece) => string;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLength: (sec: number) => void;
  onAssign: (pieceId: string) => void;
  onUnassign: (pieceId: string) => void;
  /** Move one place up (-1) or down (+1). */
  onMove: (delta: -1 | 1) => void;
}

function LengthCell({ sec, onChange }: { sec: number; onChange: (sec: number) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const invalid = editing !== null && parseLength(editing) === null;

  function commit() {
    if (editing === null) return;
    const parsed = parseLength(editing);
    if (parsed !== null && parsed !== sec) onChange(parsed);
    if (parsed !== null) setEditing(null);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(null);
  }

  return (
    <div className="pl-length">
      <button type="button" className="pl-nudge" onClick={() => onChange(nudge(sec, -NUDGE_SEC))} aria-label="30 seconds shorter">
        −
      </button>
      {editing === null ? (
        <button type="button" className="pl-length-value" onClick={() => setEditing(formatDuration(sec))} title="Edit length">
          {formatDuration(sec)}
        </button>
      ) : (
        <input
          className="pl-length-input"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          aria-invalid={invalid || undefined}
          aria-label="Length, m:ss"
          autoFocus
        />
      )}
      <button type="button" className="pl-nudge" onClick={() => onChange(nudge(sec, NUDGE_SEC))} aria-label="30 seconds longer">
        +
      </button>
    </div>
  );
}

function stepsLabel(piece: Piece): string {
  const done = piece.steps.filter((s) => s.status === 'done').length;
  return `${done}/${piece.steps.length}`;
}

/** One segment as a sortable <tbody>: its row plus, when expanded, its pieces. */
export default function SegmentRow(props: Props) {
  const { segment, row, presenter, pieces, unassignedPieces, expanded } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <tbody ref={setNodeRef} style={style} className={isDragging ? 'pl-seg is-dragging' : 'pl-seg'}>
      <tr>
        <td className="pl-seg-handle">
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="pl-drag-handle"
            aria-label={`Move ${segment.title}`}
            title="Drag, or Alt+↑ / Alt+↓"
            {...attributes}
            {...listeners}
            onKeyDown={(e) => {
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                props.onMove(e.key === 'ArrowUp' ? -1 : 1);
                return;
              }
              listeners?.onKeyDown?.(e);
            }}
          >
            <GripVertical size={16} aria-hidden />
          </button>
        </td>
        <td className="pl-seg-start">
          <span className="pl-num">{formatClockTime(row.startTime)}</span>
          {row.switchCue && <span className="pl-tag pl-tag-switch" title="Playback source changes here">switch</span>}
          {row.hardTimeGapSec > 0 && (
            <span className="pl-tag" title={`Waits ${formatDuration(row.hardTimeGapSec)} for its hard time`}>
              hard {segment.hardTime}
            </span>
          )}
          {row.hardTimeConflict && (
            <span className="pl-tag pl-tag-alert" title="Computed start is after the hard time">
              hard {segment.hardTime}!
            </span>
          )}
        </td>
        <td>
          <button type="button" className="pl-link-btn pl-seg-title" onClick={props.onEdit}>
            {segment.title}
          </button>
        </td>
        <td>{presenter}</td>
        <td>{segment.type}</td>
        <td>{segment.playbackSource}</td>
        <td>
          <LengthCell sec={segment.plannedSec} onChange={props.onLength} />
        </td>
        <td>
          <button
            type="button"
            className="pl-link-btn pl-seg-pieces"
            onClick={props.onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} pieces for ${segment.title}`}
          >
            {expanded ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {row.pieceCount === 0 ? (
              <span className="pl-muted">none</span>
            ) : (
              <span className={row.piecesOver ? 'pl-error pl-num' : 'pl-num'}>
                {formatDuration(row.piecesSec)} of {formatDuration(row.durationSec)}
              </span>
            )}
          </button>
        </td>
        <td className="pl-seg-notes">{segment.notes}</td>
      </tr>
      {expanded && (
        <tr className="pl-seg-detail">
          <td />
          <td colSpan={8}>
            {pieces.length === 0 ? (
              <p className="pl-muted">No pieces in this segment.</p>
            ) : (
              <table className="pl-table pl-table-inner">
                <thead>
                  <tr>
                    <th>Piece</th>
                    <th>Owner</th>
                    <th>Length</th>
                    <th>Steps</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pieces.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td>{props.ownerName(p)}</td>
                      <td className="pl-num">{formatDuration(pieceLengthSec(p))}</td>
                      <td className="pl-num">{stepsLabel(p)}</td>
                      <td>
                        <button type="button" className="pl-link-btn" onClick={() => props.onUnassign(p.id)}>
                          Unassign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <label className="pl-field pl-assign">
              <span>Assign piece</span>
              <select
                value=""
                onChange={(e) => e.target.value && props.onAssign(e.target.value)}
                disabled={unassignedPieces.length === 0}
              >
                <option value="">
                  {unassignedPieces.length === 0 ? 'No unassigned pieces' : 'Choose an unassigned piece…'}
                </option>
                {unassignedPieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({formatDuration(pieceLengthSec(p))})
                  </option>
                ))}
              </select>
            </label>
          </td>
        </tr>
      )}
    </tbody>
  );
}
