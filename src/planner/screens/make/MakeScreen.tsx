import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Wand2 } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/Basics';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { DrawerFrame } from '../../components/ui/Drawer';
import { deckPipeline } from '../../logic/contributors';
import { plural } from '../../logic/dates';
import { isComplete } from '../../logic/steps';
import { derivedWaiting } from '../../logic/waiting';
import AwardPanel from '../awards/AwardPanel';
import PiecePanel from '../awards/PiecePanel';
import Queue from './Queue';
import AwardsView from './AwardsView';
import Pipeline from './Pipeline';
import PiecesView from './PiecesView';
import Songbook from './Songbook';
import { songProgress } from '../../logic/lyrics';
import '../awards/awards.css';
import './make.css';

type View = 'queue' | 'awards' | 'guests' | 'songs' | 'pieces';
const VIEWS: View[] = ['queue', 'awards', 'guests', 'songs', 'pieces'];

/**
 * Make: my queue, awards, guest presentations and every piece.
 * Records open in a drawer: `?award=<id|new>`, `?piece=<id|new>`.
 */
export default function MakeScreen() {
  const { season, data, today } = usePlanner();
  const [params, setParams] = useSearchParams();
  const raw = params.get('view') as View | null;
  const view: View = raw && VIEWS.includes(raw) ? raw : 'queue';
  const awardParam = params.get('award');
  const pieceParam = params.get('piece');

  function go(next: { award?: string | null; piece?: string | null }) {
    const p = new URLSearchParams();
    if (view !== 'queue') p.set('view', view);
    if (next.award) p.set('award', next.award);
    if (next.piece) p.set('piece', next.piece);
    setParams(p);
  }

  if (!season) {
    return <EmptyState icon={Wand2} title="No season yet" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create a season</Link>}>Pieces and awards belong to a season.</EmptyState>;
  }
  if (data.loading) return <div className="pl-page"><Skeleton rows={2} label="Loading" /><Skeleton rows={8} /></div>;

  const mine = data.pieces.filter((p) => p.ownerPersonIds.length === 0 && !isComplete(p));
  const ready = mine.filter((p) => !derivedWaiting(p, data)).length;
  const pipe = deckPipeline(data.pieces, today);
  const decks = Object.values(pipe).flat();
  const overdueDecks = decks.filter((d) => d.overdue).length;
  const undecided = data.awards.filter((a) => a.stage !== 'cut' && a.stage !== 'idea' && !a.winnerContenderId).length;
  const answers: Record<View, string> = {
    queue: mine.length ? `${ready} ready to work on, ${mine.length - ready} blocked.` : 'Your queue is clear.',
    awards: undecided ? `${plural(undecided, 'award')} still need a winner.` : 'Every award has a winner.',
    guests: decks.length ? `${decks.length - pipe.inDeck.length} of ${decks.length} presentations not in the master deck${overdueDecks ? `; ${overdueDecks} overdue` : ''}.` : 'No guest presentations yet.',
    songs: data.songs.length ? `${data.songs.length} songs, ${data.songs.filter((s) => { const p = songProgress(s); return p.total > 0 && p.written === p.total; }).length} fully rewritten.` : 'No songs yet.',
    pieces: `${data.pieces.length} pieces, ${data.pieces.filter((p) => !isComplete(p)).length} not finished.`,
  };

  const award = awardParam && awardParam !== 'new' ? (data.awards.find((a) => a.id === awardParam) ?? null) : null;
  const piece = pieceParam && pieceParam !== 'new' ? (data.pieces.find((p) => p.id === pieceParam) ?? null) : null;
  const showAward = !pieceParam && (awardParam === 'new' || award !== null);
  const showPiece = pieceParam === 'new' || piece !== null;

  return (
    <>
      <div className="pl-page">
        <PageHeader
          title="Make"
          answer={answers[view]}
          actions={
            <>
              {view === 'awards' && (
                <button type="button" className="pl-btn" onClick={() => go({ award: 'new' })}>
                  <Plus size={16} aria-hidden /> Add award
                </button>
              )}
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => go({ piece: 'new' })}>
                <Plus size={16} aria-hidden /> Add piece
              </button>
            </>
          }
        />
        <ViewTabs<View>
          label="Make views"
          current={view}
          defaultView="queue"
          views={[
            { id: 'queue', label: 'My queue', count: ready },
            { id: 'awards', label: 'Awards', count: undecided },
            { id: 'guests', label: 'Guest presentations', count: overdueDecks || decks.length, attention: overdueDecks > 0 },
            { id: 'songs', label: 'Songs', count: data.songs.length },
            { id: 'pieces', label: 'All pieces', count: data.pieces.length },
          ]}
        />
        {view === 'queue' && <Queue onOpenPiece={(id) => go({ piece: id })} onAdd={() => go({ piece: 'new' })} />}
        {view === 'awards' && <AwardsView onOpenAward={(id) => go({ award: id })} onOpenPiece={(id) => go({ piece: id })} onAdd={() => go({ award: 'new' })} />}
        {view === 'guests' && <Pipeline onOpenPiece={(id) => go({ piece: id })} />}
        {view === 'songs' && <Songbook />}
        {view === 'pieces' && <PiecesView onOpenPiece={(id) => go({ piece: id })} initialShow={params.get('show')} />}
      </div>

      {showAward && (
        <DrawerFrame onClose={() => go({})}>
          <AwardPanel
            key={awardParam ?? 'none'}
            seasonId={season.id}
            award={award}
            data={data}
            onClose={() => go({})}
            onOpenPiece={(id) => go({ award: award?.id ?? null, piece: id })}
            onCreated={(id) => go({ award: id })}
          />
        </DrawerFrame>
      )}
      {showPiece && (
        <DrawerFrame onClose={() => go({ award: awardParam })}>
          <PiecePanel
            key={pieceParam ?? 'none'}
            seasonId={season.id}
            piece={piece}
            defaults={awardParam && awardParam !== 'new' ? { awardId: awardParam } : view === 'guests' ? { kind: 'contributor-deck' } : undefined}
            data={data}
            onClose={() => go({ award: awardParam })}
          />
        </DrawerFrame>
      )}
    </>
  );
}
