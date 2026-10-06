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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Hourglass, Trophy, X } from 'lucide-react';
import { seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { Chip, ChipSelect } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { ProgressRing } from '../../components/ui/Progress';
import { awardChip } from '../../components/status';
import { AWARD_STAGE_LABEL } from '../../logic/labels';
import { moveItem, orderForMove, renumber } from '../../logic/order';
import { composeLabel, listNames, variantOf, winnersOf } from '../../logic/showGraphics';
import { progress } from '../../logic/steps';
import { derivedWaiting } from '../../logic/waiting';
import type { Award, WithId } from '../../types';
import { AWARD_STAGES } from '../awards/stages';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function AwardRow({ award, onOpen, onOpenPiece, onMove }: { award: WithId<Award>; onOpen: () => void; onOpenPiece: (id: string) => void; onMove: (d: -1 | 1) => void }) {
  const { season, data } = usePlanner();
  const toast = useToast();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: award.id });
  const pieces = data.pieces.filter((p) => p.awardId === award.id);
  const waiting = pieces.filter((p) => derivedWaiting(p, data)?.kind === 'award');
  const contenders = award.contenders ?? [];
  const nominees = contenders.filter((c) => c.nominee);
  const winners = winnersOf(award);
  const honoree = variantOf(award) === 'honoree';
  const chip = awardChip(award.stage);

  /** Writes the winners and keeps the stage in step: any winner means "winner", none steps back to "nominees". */
  async function setWinners(ids: string[], message: string) {
    if (!season) return;
    const ref = seasonSubDoc(season.id, 'awards', award.id);
    const before = { winnerContenderIds: award.winnerContenderIds, stage: award.stage };
    const stage = ids.length > 0 ? 'winner' : award.stage === 'winner' ? 'nominees' : award.stage;
    await updateRecord(ref, { winnerContenderIds: ids.length > 0 ? ids : undefined, stage });
    toast({ message, undo: () => updateRecord(ref, before) });
  }

  /** Adds a winner; a second one makes a tie. */
  async function pickWinner(id: string) {
    const picked = contenders.find((c) => c.id === id);
    if (!picked) return;
    const now = [...winners, picked];
    const names = listNames(now.map(composeLabel));
    const verb = now.length > 1 ? 'win' : 'wins';
    await setWinners(
      now.map((c) => c.id),
      waiting.length ? `${names} ${verb}. Unblocked: ${waiting.map((p) => p.title).join(', ')}` : `${names} ${verb} ${award.name}`,
    );
  }

  async function removeWinner(id: string) {
    const gone = contenders.find((c) => c.id === id);
    await setWinners(
      winners.map((c) => c.id).filter((x) => x !== id),
      `${gone ? composeLabel(gone) : 'That contender'} is no longer a winner of ${award.name}`,
    );
  }

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'is-dragging' : undefined}>
      <div className="pl-list-row pl-award-row">
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
        <div className="pl-list-main">
          <button type="button" className="pl-list-title" onClick={onOpen}>{award.name}</button>
          <span className="pl-list-meta">
            <Chip tone={chip.tone} icon={chip.icon}>{chip.label}</Chip>
            {award.returning && <span>Returning</span>}
            {award.stage !== 'idea' && <span>{contenders.length} contenders · {nominees.length} {honoree ? 'honorees' : 'nominees'}</span>}
            {award.segmentId && (
              <Link to={`/plan/show?segment=${award.segmentId}`}>{data.segments.find((s) => s.id === award.segmentId)?.title}</Link>
            )}
          </span>
          {pieces.length > 0 && (
            <span className="pl-award-pieces">
              {pieces.map((p) => {
                const { done, total } = progress(p);
                const blocked = waiting.includes(p);
                return (
                  <button key={p.id} type="button" className={`pl-award-piece${blocked ? ' is-blocked' : ''}`} onClick={() => onOpenPiece(p.id)}>
                    <ProgressRing done={done} total={total} size={22} />
                    {p.title}
                    {blocked && <><Hourglass size={12} aria-hidden /> waiting on the winner</>}
                  </button>
                );
              })}
            </span>
          )}
        </div>
        <div className="pl-list-actions">
          {award.stage === 'cut' ? null : honoree ? (
            nominees.length > 0 ? (
              nominees.map((c) => (
                <Chip key={c.id} tone="good" icon={Trophy}>{composeLabel(c)}</Chip>
              ))
            ) : (
              <button type="button" className="pl-btn pl-btn-sm" onClick={onOpen}>Pick honorees</button>
            )
          ) : nominees.length > 0 || winners.length > 0 ? (
            <>
              {winners.map((c) => (
                <Chip key={c.id} tone="good" icon={Trophy} className="pl-award-winner" title={c.nominee ? undefined : 'Won without being nominated'}>
                  {composeLabel(c)}
                  <button type="button" className="pl-award-winner-x" aria-label={`Remove ${composeLabel(c)} as a winner of ${award.name}`} onClick={() => void removeWinner(c.id)}>
                    <X size={12} aria-hidden />
                  </button>
                </Chip>
              ))}
              {nominees.some((c) => !winners.includes(c)) && (
                <ChipSelect
                  value=""
                  placeholder={winners.length ? 'Add a winner' : 'Pick the winner'}
                  options={nominees.filter((c) => !winners.includes(c)).map((c) => ({ value: c.id, label: composeLabel(c), tone: 'good' as const, icon: Trophy }))}
                  label={`Winner of ${award.name}`}
                  onChange={(id) => void pickWinner(id)}
                />
              )}
            </>
          ) : (
            <button type="button" className="pl-btn pl-btn-sm" onClick={onOpen}>
              {award.stage === 'idea' ? 'Add contenders' : 'Pick nominees'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Awards grouped by where they are, from idea to winner, with the winner picked in place. */
export default function AwardsView({ onOpenAward, onOpenPiece, onAdd }: { onOpenAward: (id: string) => void; onOpenPiece: (id: string) => void; onAdd: () => void }) {
  const { season, data } = usePlanner();
  const write = useSafeWrite();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (!season) return null;

  if (data.awards.length === 0) {
    return (
      <EmptyState icon={Trophy} title="No awards yet" action={<><button type="button" className="pl-btn pl-btn-primary" onClick={onAdd}>Add an award</button><Link to="/plan/ideas" className="pl-btn">Promote an idea</Link></>}>
        Each award goes from an idea, to contenders, to nominees, to a winner. Picking the winner unblocks its video.
      </EmptyState>
    );
  }

  function move(group: WithId<Award>[], from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= group.length) return;
    const order = orderForMove(group, from, to);
    const writes = order !== null ? [{ id: group[from].id, order }] : renumber(moveItem(group, from, to));
    void write(() => Promise.all(writes.map((w) => updateRecord(seasonSubDoc(season!.id, 'awards', w.id), { order: w.order }))));
  }

  // Undecided first: the stages that still need you.
  const stages = ['nominees', 'contenders', 'idea', 'winner', 'cut'] as const;
  return (
    <div className="pl-stack">
      {stages.filter((s) => AWARD_STAGES.includes(s)).map((stage) => {
        const group = data.awards.filter((a) => a.stage === stage);
        if (group.length === 0) return null;
        return (
          <section key={stage} className="pl-section" aria-label={AWARD_STAGE_LABEL[stage]}>
            <h2 className="pl-group-title">{AWARD_STAGE_LABEL[stage]} <span className="pl-count">{group.length}</span></h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={({ active, over }: DragEndEvent) => {
                if (!over || active.id === over.id) return;
                move(group, group.findIndex((a) => a.id === active.id), group.findIndex((a) => a.id === over.id));
              }}
            >
              <SortableContext items={group.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <ul className="pl-list">
                  {group.map((award, i) => (
                    <AwardRow key={award.id} award={award} onOpen={() => onOpenAward(award.id)} onOpenPiece={onOpenPiece} onMove={(d) => move(group, i, i + d)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
    </div>
  );
}
