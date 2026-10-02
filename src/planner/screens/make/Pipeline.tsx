import { Copy, RotateCcw, Sparkles } from 'lucide-react';
import { seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useActions } from '../../hooks/useActions';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { EmptyState } from '../../components/ui/Basics';
import { Chip } from '../../components/ui/Chip';
import { DECK_STAGES, deckPipeline, deckStage } from '../../logic/contributors';
import { dueLabel, formatLongDay } from '../../logic/dates';
import { ownerNames } from '../../logic/labels';
import { nextStep, revisionReceived } from '../../logic/steps';
import type { Piece, WithId } from '../../types';

/** Who owes Sean a presentation, and by when: a board from asked to in the master deck. */
export default function Pipeline({ onOpenPiece }: { onOpenPiece: (id: string) => void }) {
  const { season, data, today } = usePlanner();
  const { advancePiece } = useActions();
  const update = useUndoableUpdate();
  const toast = useToast();
  if (!season) return null;
  const pipe = deckPipeline(data.pieces, today);
  const total = Object.values(pipe).flat().length;

  if (total === 0) {
    return (
      <EmptyState icon={Sparkles} title="No guest presentations yet">
        When a guest says they’ll present (on the RSVP form, or you add a “Guest presentation” piece), they show up here, from asked to
        in the master deck.
      </EmptyState>
    );
  }

  async function askAgain(p: WithId<Piece>) {
    const who = ownerNames(p.ownerPersonIds, data.peopleById, 'there');
    const first = who.split(/\s|&/)[0];
    const due = p.dueDate ? ` by ${formatLongDay(p.dueDate)}` : '';
    const text = `Hi ${first}! How’s “${p.title}” coming along? Could you send me the deck${due}? Thanks!`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `Message for ${first} copied` });
    } catch {
      window.prompt('Copy this message:', text);
    }
  }

  function revision(p: WithId<Piece>) {
    const next = revisionReceived(p, today);
    void update(seasonSubDoc(season!.id, 'pieces', p.id), p, next, `${p.title}: revision received, check it again`);
  }

  return (
    <div className="pl-board" role="list" aria-label="Guest presentations by stage">
      {DECK_STAGES.map((stage) => (
        <section key={stage.id} className="pl-board-col" role="listitem" aria-label={stage.label}>
          <header>
            <h3>{stage.label} <span className="pl-count">{pipe[stage.id].length}</span></h3>
            <p className="pl-small pl-faint">{stage.hint}</p>
          </header>
          {pipe[stage.id].map(({ piece, overdue }) => {
            const next = nextStep(piece);
            const submitted = ['submitted', 'checked', 'inDeck'].includes(deckStage(piece));
            return (
              <article key={piece.id} className={`pl-board-card${overdue ? ' is-overdue' : ''}`}>
                <button type="button" className="pl-list-title" onClick={() => onOpenPiece(piece.id)}>{piece.title}</button>
                <span className="pl-small">{ownerNames(piece.ownerPersonIds, data.peopleById)}</span>
                {piece.dueDate && stage.id !== 'inDeck' && (
                  <Chip tone={overdue ? 'danger' : 'faint'}>{dueLabel(piece.dueDate, today)}</Chip>
                )}
                <div className="pl-row">
                  {next && (
                    <button type="button" className="pl-btn pl-btn-sm" onClick={() => void advancePiece(piece)} title={`Mark “${next.label}” done`}>
                      ✓ {next.label.split(' (')[0].length > 16 ? 'Next step' : next.label.split(' (')[0]}
                    </button>
                  )}
                  {submitted && (
                    <button type="button" className="pl-icon-btn" onClick={() => revision(piece)} aria-label={`Revision received for ${piece.title}`} title="Revision received">
                      <RotateCcw size={15} aria-hidden />
                    </button>
                  )}
                  {!submitted && (
                    <button type="button" className="pl-icon-btn" onClick={() => void askAgain(piece)} aria-label={`Copy a reminder for ${piece.title}`} title="Copy a reminder to send">
                      <Copy size={15} aria-hidden />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
