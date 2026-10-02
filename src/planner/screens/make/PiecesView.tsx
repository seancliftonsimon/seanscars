import { useState } from 'react';
import { usePlanner } from '../../hooks/plannerContext';
import { EmptyState } from '../../components/ui/Basics';
import { Wand2 } from 'lucide-react';
import { PIECE_KIND_LABEL, PIECE_KINDS } from '../../logic/labels';
import { isComplete } from '../../logic/steps';
import { derivedWaiting } from '../../logic/waiting';
import type { PieceKind } from '../../types';
import PieceRow from './PieceRow';

type Show = 'all' | 'incomplete' | 'waiting' | 'unplaced' | 'mine' | 'guests';

/** Every piece with filters; the full inventory behind My queue and the pipeline. */
export default function PiecesView({ onOpenPiece, initialShow }: { onOpenPiece: (id: string) => void; initialShow: string | null }) {
  const { data } = usePlanner();
  const [show, setShow] = useState<Show>((['incomplete', 'waiting', 'unplaced', 'mine', 'guests'] as Show[]).find((s) => s === initialShow) ?? 'all');
  const [kind, setKind] = useState<PieceKind | 'all'>('all');
  const [q, setQ] = useState('');
  const segIds = new Set(data.segments.map((s) => s.id));
  const rows = data.pieces.map((p) => ({ p, wait: derivedWaiting(p, data) }));
  const tests: Record<Show, (r: (typeof rows)[number]) => boolean> = {
    all: () => true,
    incomplete: (r) => !isComplete(r.p),
    waiting: (r) => Boolean(r.wait),
    unplaced: (r) => !r.p.segmentId || !segIds.has(r.p.segmentId),
    mine: (r) => r.p.ownerPersonIds.length === 0,
    guests: (r) => r.p.ownerPersonIds.length > 0,
  };
  const labels: Record<Show, string> = { all: 'All', incomplete: 'Not finished', waiting: 'Blocked', unplaced: 'Not placed in the show', mine: 'Mine', guests: 'Guests’' };
  const needle = q.trim().toLowerCase();
  const visible = rows.filter((r) => tests[show](r) && (kind === 'all' || r.p.kind === kind) && (!needle || r.p.title.toLowerCase().includes(needle)));

  if (data.pieces.length === 0) {
    return <EmptyState icon={Wand2} title="No pieces yet">Add a piece for each thing you’ll make or collect for the show.</EmptyState>;
  }

  return (
    <div className="pl-stack">
      <div className="pl-toolbar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pieces" aria-label="Search pieces" />
        <select value={kind} onChange={(e) => setKind(e.target.value as PieceKind | 'all')} aria-label="Kind" className="pl-select-auto">
          <option value="all">Every kind</option>
          {PIECE_KINDS.map((k) => (
            <option key={k} value={k}>{PIECE_KIND_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <div className="pl-filters" role="group" aria-label="Show">
        {(Object.keys(labels) as Show[]).map((s) => (
          <button key={s} type="button" className="pl-filter" aria-pressed={show === s} onClick={() => setShow(s)}>
            {labels[s]} <span className="pl-count">{rows.filter(tests[s]).length}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="pl-muted">No pieces match.</p>
      ) : (
        <ul className="pl-list">
          {visible.map(({ p, wait }) => (
            <li key={p.id}><PieceRow piece={p} wait={wait} onOpen={() => onOpenPiece(p.id)} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
