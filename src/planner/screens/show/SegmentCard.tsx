import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, GripVertical, MonitorPlay, Music, Pause, Repeat, Video, Mic } from 'lucide-react';
import { formatClockTime, pieceLengthSec, type ScheduleRow } from '../../logic/clock';
import { formatDuration } from '../../logic/clockFormat';
import { PLAYBACK_LABEL, PIECE_KIND_LABEL, SEGMENT_TYPE_LABEL, ownerNames } from '../../logic/labels';
import { progress } from '../../logic/steps';
import { Chip } from '../../components/ui/Chip';
import { ProgressRing } from '../../components/ui/Progress';
import type { Person, Piece, Segment, WithId } from '../../types';
import LengthControl from './LengthControl';

const TYPE_ICON = { live: Mic, pretape: Video, song: Music, intermission: Pause };

interface Props {
  segment: WithId<Segment>;
  row: ScheduleRow;
  pieces: WithId<Piece>[];
  unassigned: WithId<Piece>[];
  peopleById: ReadonlyMap<string, WithId<Person>>;
  expanded: boolean;
  trim: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLength: (sec: number) => void;
  onAssign: (pieceId: string) => void;
  onUnassign: (pieceId: string) => void;
  onMove: (delta: -1 | 1) => void;
}

/** One segment on the timeline: clock time, what it is, who, how long, and its pieces. */
export default function SegmentCard(props: Props) {
  const { segment, row, pieces, expanded, peopleById } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: segment.id });
  const Icon = TYPE_ICON[segment.type];
  const presenter = segment.ownerPersonIds.length ? ownerNames(segment.ownerPersonIds, peopleById) : segment.presenterLabel || 'Sean';
  // Taller for longer segments, like a day view, within limits.
  const minHeight = `${Math.min(9, 3.4 + row.durationSec / 240)}rem`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`pl-tl-item is-${row.group}${isDragging ? ' is-dragging' : ''}${props.trim ? ' is-trim' : ''}`}
      id={`segment-${segment.id}`}
    >
      <div className="pl-tl-time">
        <span className="pl-num">{formatClockTime(row.startTime)}</span>
        {row.hardTimeGapSec > 0 && <span className="pl-small pl-faint">waits {formatDuration(row.hardTimeGapSec)}</span>}
      </div>
      <div className="pl-tl-card" style={{ minHeight }}>
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
        <div className="pl-tl-body">
          <div className="pl-tl-head">
            <button type="button" className="pl-list-title pl-tl-title" onClick={props.onEdit}>
              {segment.title}
            </button>
            <LengthControl sec={segment.plannedSec} onChange={props.onLength} label={`Length of ${segment.title}`} />
          </div>
          <div className="pl-list-meta">
            <span className="pl-tl-who">{presenter}</span>
            <Chip tone="faint" icon={Icon}>{SEGMENT_TYPE_LABEL[segment.type]}</Chip>
            {row.switchCue && (
              <Chip tone="accent" icon={Repeat} title="Playback source changes here">
                Switch to {PLAYBACK_LABEL[segment.playbackSource]}
              </Chip>
            )}
            {!row.switchCue && segment.playbackSource !== 'none' && (
              <span className="pl-faint"><MonitorPlay size={12} aria-hidden /> {PLAYBACK_LABEL[segment.playbackSource]}</span>
            )}
            {segment.hardTime && !row.hardTimeConflict && <Chip tone="info" icon={Clock}>Hard time {formatClockTime(segment.hardTime)}</Chip>}
            {row.hardTimeConflict && (
              <Chip tone="danger" icon={AlertTriangle} title="The show reaches this segment after its hard time">
                Misses hard time {formatClockTime(segment.hardTime!)}
              </Chip>
            )}
            {props.trim && <Chip tone="warn">Trim candidate</Chip>}
          </div>
          {segment.notes && <p className="pl-small pl-muted pl-tl-notes">{segment.notes}</p>}
          <button type="button" className="pl-tl-pieces" onClick={props.onToggle} aria-expanded={expanded}>
            {expanded ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {row.pieceCount === 0 ? (
              <span className="pl-faint">No pieces</span>
            ) : (
              <span className={row.piecesOver ? 'pl-danger-text' : undefined}>
                {row.pieceCount} {row.pieceCount === 1 ? 'piece' : 'pieces'} · {formatDuration(row.piecesSec)} of {formatDuration(row.durationSec)}
                {row.piecesOver ? ' — longer than the segment' : ''}
              </span>
            )}
          </button>
          {expanded && (
            <div className="pl-tl-detail">
              {pieces.map((p) => {
                const { done, total } = progress(p);
                return (
                  <div key={p.id} className="pl-tl-piece">
                    <ProgressRing done={done} total={total} size={26} />
                    <Link to={`/plan/make?piece=${p.id}`} className="pl-list-title">{p.title}</Link>
                    <span className="pl-small pl-muted">{PIECE_KIND_LABEL[p.kind]} · {ownerNames(p.ownerPersonIds, peopleById)} · {formatDuration(pieceLengthSec(p))}</span>
                    <button type="button" className="pl-link-btn pl-small" onClick={() => props.onUnassign(p.id)}>Remove</button>
                  </div>
                );
              })}
              {props.unassigned.length > 0 && (
                <label className="pl-field pl-assign">
                  <span>Add a piece that isn’t placed yet</span>
                  <select value="" onChange={(e) => e.target.value && props.onAssign(e.target.value)}>
                    <option value="">Choose…</option>
                    {props.unassigned.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({formatDuration(pieceLengthSec(p))})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
