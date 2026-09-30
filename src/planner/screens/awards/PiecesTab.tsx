import { useMemo, useState } from 'react';
import StepDots from '../../components/StepDots';
import { seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { formatDuration } from '../../logic/clockFormat';
import { pieceLengthSec } from '../../logic/clock';
import { cycleStep, isComplete, nextStep, PIECE_KIND_LABELS } from '../../logic/steps';
import { derivedWaiting, isResolved, waitingLabel, type WaitReason } from '../../logic/waiting';
import type { Piece, PieceKind, WithId } from '../../types';
import type { SeasonData } from '../../hooks/useSeasonData';
import './awards.css';

const KINDS: PieceKind[] = ['award-video', 'song', 'slides-bit', 'contributor-deck', 'other'];

interface Props {
  seasonId: string;
  data: SeasonData;
  selectedPieceId: string | null;
  onSelectPiece: (id: string | null) => void;
  onAddPiece: () => void;
}

/** Today as YYYY-MM-DD in local time. */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The wait to show: an unresolved manual wait, else a derived one. */
function currentWait(piece: WithId<Piece>, data: SeasonData): WaitReason | null {
  if (piece.waitingOn) {
    const w: WaitReason = { kind: piece.waitingOn.kind, id: piece.waitingOn.id, label: '', derived: false };
    if (!isResolved(w, data)) return w;
  }
  return derivedWaiting(piece, data);
}

const SEAN = 'sean';
const UNASSIGNED = 'none';

export default function PiecesTab({ seasonId, data, selectedPieceId, onSelectPiece, onAddPiece }: Props) {
  const [kind, setKind] = useState('all');
  const [owner, setOwner] = useState('all');
  const [segment, setSegment] = useState('all');
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  const awardsById = useMemo(() => new Map(data.awards.map((a) => [a.id, a])), [data.awards]);
  const segmentsById = useMemo(() => new Map(data.segments.map((s) => [s.id, s])), [data.segments]);

  const ownerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of data.pieces) p.ownerPersonIds.forEach((id) => ids.add(id));
    return [...ids]
      .filter((id) => data.peopleById.has(id))
      .sort((a, b) => data.peopleById.get(a)!.name.localeCompare(data.peopleById.get(b)!.name));
  }, [data.pieces, data.peopleById]);

  const rows = data.pieces.map((piece) => ({ piece, wait: currentWait(piece, data) }));
  const totalWaiting = rows.filter((r) => r.wait).length;
  const totalIncomplete = rows.filter((r) => !isComplete(r.piece)).length;

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(({ piece, wait }) => {
    if (kind !== 'all' && piece.kind !== kind) return false;
    if (owner === SEAN && piece.ownerPersonIds.length > 0) return false;
    if (owner !== 'all' && owner !== SEAN && !piece.ownerPersonIds.includes(owner)) return false;
    if (segment === UNASSIGNED && piece.segmentId) return false;
    if (segment !== 'all' && segment !== UNASSIGNED && piece.segmentId !== segment) return false;
    if (waitingOnly && !wait) return false;
    if (incompleteOnly && isComplete(piece)) return false;
    if (needle && !piece.title.toLowerCase().includes(needle)) return false;
    return true;
  });

  async function cycle(piece: WithId<Piece>, index: number) {
    setError(null);
    try {
      await updateRecord(seasonSubDoc(seasonId, 'pieces', piece.id), { steps: cycleStep(piece.steps, index) });
    } catch (err) {
      setError(`Couldn't update the step: ${errorMessage(err)}`);
    }
  }

  const ownerNames = (piece: WithId<Piece>) =>
    piece.ownerPersonIds.length === 0
      ? 'Sean'
      : piece.ownerPersonIds.map((id) => data.peopleById.get(id)?.name ?? 'Unknown').join(' & ');

  return (
    <div className="pl-awards-pieces">
      <div className="pl-awards-filters">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by kind">
          <option value="all">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {PIECE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
          <option value="all">All owners</option>
          <option value={SEAN}>Sean</option>
          {ownerIds.map((id) => (
            <option key={id} value={id}>
              {data.peopleById.get(id)?.name}
            </option>
          ))}
        </select>
        <select value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Filter by segment">
          <option value="all">All segments</option>
          <option value={UNASSIGNED}>Unassigned</option>
          {data.segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <label className="pl-check">
          <input type="checkbox" checked={waitingOnly} onChange={(e) => setWaitingOnly(e.target.checked)} />
          <span>Waiting</span>
        </label>
        <label className="pl-check">
          <input type="checkbox" checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
          <span>Incomplete</span>
        </label>
        <input
          type="search"
          placeholder="Search titles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search titles"
        />
      </div>

      <div className="pl-awards-count">
        <span className="pl-muted">
          {visible.length === rows.length ? `${rows.length} pieces` : `${visible.length} of ${rows.length} pieces`} ·{' '}
          {totalWaiting} waiting · {totalIncomplete} incomplete
        </span>
        <button type="button" className="pl-btn pl-btn-primary" onClick={onAddPiece}>
          Add piece
        </button>
      </div>
      {error && <p className="pl-error">{error}</p>}

      {rows.length === 0 ? (
        <p className="pl-muted pl-awards-empty">No pieces yet. Add one to start tracking.</p>
      ) : visible.length === 0 ? (
        <p className="pl-muted pl-awards-empty">No pieces match these filters.</p>
      ) : (
        <div className="pl-awards-pieces-scroll">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Award</th>
                <th>Segment</th>
                <th>Steps</th>
                <th>Next</th>
                <th>Due</th>
                <th className="pl-num">Length</th>
                <th>Waiting</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ piece, wait }) => {
                const complete = isComplete(piece);
                const next = nextStep(piece);
                const len = pieceLengthSec(piece);
                const overdue = Boolean(piece.dueDate) && !complete && (piece.dueDate as string) < today;
                return (
                  <tr key={piece.id} className={piece.id === selectedPieceId ? 'is-selected' : undefined}>
                    <td>
                      <button type="button" className="pl-awards-title-btn" onClick={() => onSelectPiece(piece.id)}>
                        {piece.title}
                      </button>
                    </td>
                    <td>{ownerNames(piece)}</td>
                    <td>{piece.awardId ? (awardsById.get(piece.awardId)?.name ?? '—') : '—'}</td>
                    <td>{piece.segmentId ? (segmentsById.get(piece.segmentId)?.title ?? '—') : '—'}</td>
                    <td>
                      <StepDots steps={piece.steps} onCycle={(i) => cycle(piece, i)} />
                    </td>
                    <td>{complete ? 'Done' : (next?.label ?? 'Done')}</td>
                    <td className={overdue ? 'pl-error' : undefined}>{piece.dueDate ?? '—'}</td>
                    <td className="pl-num">{len > 0 ? formatDuration(len) : '—'}</td>
                    <td className="pl-muted">{wait ? `waiting on ${waitingLabel(wait, data)}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
