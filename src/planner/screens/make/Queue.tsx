import { Wand2 } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { EmptyState, Section } from '../../components/ui/Basics';
import { isComplete } from '../../logic/steps';
import { derivedWaiting } from '../../logic/waiting';
import type { Piece, WithId } from '../../types';
import PieceRow from './PieceRow';

/** Sean's own pieces: what's ready (most urgent first), then what's blocked and why. */
export default function Queue({ onOpenPiece, onAdd }: { onOpenPiece: (id: string) => void; onAdd: () => void }) {
  const { data } = usePlanner();
  const segPos = new Map(data.segments.map((s, i) => [s.id, i]));
  const pos = (p: Piece) => (p.segmentId ? (segPos.get(p.segmentId) ?? 999) : 999);
  const byUrgency = (a: WithId<Piece>, b: WithId<Piece>) =>
    (a.dueDate ?? '9999') .localeCompare(b.dueDate ?? '9999') || pos(a) - pos(b);
  const mine = data.pieces.filter((p) => p.ownerPersonIds.length === 0);
  const open = mine.filter((p) => !isComplete(p)).map((p) => ({ p, wait: derivedWaiting(p, data) }));
  const ready = open.filter((x) => !x.wait).sort((a, b) => byUrgency(a.p, b.p));
  const blocked = open.filter((x) => x.wait).sort((a, b) => byUrgency(a.p, b.p));
  const finished = mine.filter(isComplete);

  if (mine.length === 0) {
    return (
      <EmptyState icon={Wand2} title="Nothing in your queue yet" action={<button type="button" className="pl-btn pl-btn-primary" onClick={onAdd}>Add a piece</button>}>
        Pieces are the things you make for the show: award videos, songs, slide bits. Each has steps; your queue shows the next step for each.
      </EmptyState>
    );
  }

  return (
    <div className="pl-stack pl-queue">
      <Section title={`Ready to work on (${ready.length})`} aside="Soonest due first, then show order">
        {ready.length ? (
          <ul className="pl-list">
            {ready.map(({ p }) => (
              <li key={p.id}><PieceRow piece={p} wait={null} onOpen={() => onOpenPiece(p.id)} showOwner={false} /></li>
            ))}
          </ul>
        ) : (
          <p className="pl-muted">Nothing ready right now; everything open is waiting on something.</p>
        )}
      </Section>
      {blocked.length > 0 && (
        <Section title={`Blocked (${blocked.length})`} aside="Unblock these by deciding what they wait on">
          <ul className="pl-list">
            {blocked.map(({ p, wait }) => (
              <li key={p.id}><PieceRow piece={p} wait={wait} onOpen={() => onOpenPiece(p.id)} showOwner={false} /></li>
            ))}
          </ul>
        </Section>
      )}
      {finished.length > 0 && (
        <details className="pl-details">
          <summary>Finished ({finished.length})</summary>
          <ul className="pl-list">
            {finished.map((p) => (
              <li key={p.id}><PieceRow piece={p} wait={null} onOpen={() => onOpenPiece(p.id)} showOwner={false} /></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
