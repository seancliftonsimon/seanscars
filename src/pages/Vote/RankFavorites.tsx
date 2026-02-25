import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Movie } from './Vote';
import './Vote.css';

interface RankFavoritesProps {
  movies: Movie[];
  rankedMovies: Map<string, number>;
  onUpdateRankings: (newRanked: Map<string, number>) => void;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
  requiredCount: number;
  submitting: boolean;
}

function SortableItem(props: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, x: 0 } : transform
    ),
    transition,
    zIndex: isDragging ? 2 : 1,
    position: 'relative' as const,
    opacity: isDragging ? 0.8 : 1,
    width: '100%',
    maxWidth: '100%',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-item">
      {props.children}
    </div>
  );
}

const RankFavorites = ({
  movies,
  rankedMovies,
  onUpdateRankings,
  onNext,
  onBack,
  error,
  requiredCount,
  submitting
}: RankFavoritesProps) => {
  const sortedIds = useMemo(() => {
    const movieIds = movies.map((movie) => movie.id);

    const moviesByRank = new Map<number, string>();
    movieIds.forEach((movieId) => {
      const rank = rankedMovies.get(movieId);

      if (
        typeof rank === 'number' &&
        Number.isInteger(rank) &&
        rank >= 1 &&
        rank <= movieIds.length &&
        !moviesByRank.has(rank)
      ) {
        moviesByRank.set(rank, movieId);
      }
    });

    const orderedByRank: string[] = [];
    for (let rank = 1; rank <= movieIds.length; rank += 1) {
      const movieId = moviesByRank.get(rank);
      if (movieId) {
        orderedByRank.push(movieId);
      }
    }

    const fallbackIds = movieIds.filter((movieId) => !orderedByRank.includes(movieId));
    return [...orderedByRank, ...fallbackIds];
  }, [movies, rankedMovies]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedIds.indexOf(active.id as string);
      const newIndex = sortedIds.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const newIds = arrayMove(sortedIds, oldIndex, newIndex);
      const newRankMap = new Map<string, number>();
      newIds.forEach((id, index) => {
        newRankMap.set(id, index + 1);
      });
      onUpdateRankings(newRankMap);
    }
  };

  const hasExactlyRequiredFavorites = movies.length === requiredCount;
  const allRanked =
    sortedIds.length === requiredCount && new Set(sortedIds).size === requiredCount;

  return (
    <div className="vote-screen rank-favorites-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Rank Your Favorites</h2>
        <div className="rank-count">
          Drag to reorder (Top is #1)
        </div>
      </div>

      <div className="vote-content">
        <p className="instruction-text">
          Drag to rank your top {requiredCount}.
        </p>
        {!hasExactlyRequiredFavorites && (
          <div className="error-message">
            Pick exactly {requiredCount} favorites first, then return here to rank them.
          </div>
        )}
        {error && <div className="error-message">{error}</div>}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="ranked-movies-list">
            <SortableContext
              items={sortedIds}
              strategy={verticalListSortingStrategy}
            >
              {sortedIds.map((id, index) => {
                const movie = movies.find(m => m.id === id);
                if (!movie) return null;

                return (
                  <SortableItem key={id} id={id}>
                    <div className="ranked-movie-item drag-item">
                      <div className="rank-number">#{index + 1}</div>
                      <div className="movie-title-large">{movie.title}</div>
                      <div className="drag-handle">☰</div>
                    </div>
                  </SortableItem>
                );
              })}
            </SortableContext>
          </div>
        </DndContext>

        <div className="vote-footer">
          <button
            onClick={onNext}
            className="btn btn-primary"
            disabled={!hasExactlyRequiredFavorites || !allRanked || submitting}
          >
            {submitting ? "Submitting..." : "Submit Vote"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankFavorites;
