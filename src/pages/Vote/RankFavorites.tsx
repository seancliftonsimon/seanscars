import { useState, useEffect } from 'react';
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
  onRankChange: (movieId: string, rank: number | null) => void;
  onUpdateRankings: (newRanked: Map<string, number>) => void;
  onNext: () => void;
  onBack: () => void;
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
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    position: 'relative' as const,
    opacity: isDragging ? 0.8 : 1,
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
  onBack
}: RankFavoritesProps) => {
  const [sortedIds, setSortedIds] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // If we haven't initialized our local sort order, do it now.
    // Or if the movie list changes significantly (length change), reset.
    // We try to respect existing ranks in rankedMovies map.

    // Sort movies based on rank. Unranked go to the end.
    if (!hasInitialized || sortedIds.length !== movies.length) {
      const sorted = [...movies].sort((a, b) => {
        const rankA = rankedMovies.get(a.id) ?? Number.MAX_VALUE;
        const rankB = rankedMovies.get(b.id) ?? Number.MAX_VALUE;
        return rankA - rankB;
      });

      const newSortedIds = sorted.map(m => m.id);
      setSortedIds(newSortedIds);

      // If we are initializing for the first time, and there are NO ranks yet, 
      // we should probably set the initial ranks 1-5 immediately based on this default order.
      // But maybe let the user verify first? 
      // The user "Next" button logic in Vote.tsx checks if all rankedMovies are set.
      // So we should auto-rank them if they aren't.
      if (rankedMovies.size === 0 && newSortedIds.length > 0) {
        const newRankMap = new Map();
        newSortedIds.forEach((id, index) => {
          newRankMap.set(id, index + 1);
        });
        onUpdateRankings(newRankMap);
      }

      setHasInitialized(true);
    }
  }, [movies, rankedMovies, hasInitialized, onUpdateRankings]);


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedIds.indexOf(active.id as string);
      const newIndex = sortedIds.indexOf(over.id as string);

      const newIds = arrayMove(sortedIds, oldIndex, newIndex);
      setSortedIds(newIds);

      // Update parent with new ranks
      const newRankMap = new Map<string, number>();
      newIds.forEach((id, index) => {
        newRankMap.set(id, index + 1);
      });
      onUpdateRankings(newRankMap);
    }
  };

  const allRanked = sortedIds.length > 0; // Since it's a list, they are always "ranked" by position

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
          Drag and drop the movies to rank them from #1 (top) to #{movies.length} (bottom).
        </p>

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
            disabled={!allRanked}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankFavorites;

