import { useState, useMemo, useEffect } from 'react';
import type { Movie } from './Vote';
import './Vote.css';

interface MarkSeenProps {
  movies: Movie[];
  seenMovies: Set<string>;
  wantToSeeMovies: Set<string>;
  onMarkSeen: (movieId: string) => void;
  onWantToSee: (movieId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const MOVIES_PER_PAGE = 12;

const MarkSeen = ({
  movies,
  seenMovies,
  wantToSeeMovies,
  onMarkSeen,
  onWantToSee,
  onNext,
  onBack
}: MarkSeenProps) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Filter to only show movies that haven't been seen yet
  const unseenMovies = useMemo(() => {
    return movies.filter(m => !seenMovies.has(m.id));
  }, [movies, seenMovies]);

  // Get movies for current page
  const paginatedMovies = useMemo(() => {
    const start = currentPage * MOVIES_PER_PAGE;
    const end = start + MOVIES_PER_PAGE;
    return unseenMovies.slice(start, end);
  }, [unseenMovies, currentPage]);

  // Adjust page if current page becomes empty
  useEffect(() => {
    if (paginatedMovies.length === 0 && currentPage > 0 && unseenMovies.length > 0) {
      const newPage = Math.max(0, Math.ceil(unseenMovies.length / MOVIES_PER_PAGE) - 1);
      setCurrentPage(newPage);
    }
  }, [paginatedMovies.length, currentPage, unseenMovies.length]);

  const totalPages = Math.ceil(unseenMovies.length / MOVIES_PER_PAGE);
  const hasMorePages = currentPage < totalPages - 1;
  const allMoviesProcessed = unseenMovies.length === 0;

  const handleMovieClick = (movieId: string) => {
    onMarkSeen(movieId);
  };

  const handleWantToSeeClick = (e: React.MouseEvent, movieId: string) => {
    e.stopPropagation();
    onWantToSee(movieId);
  };

  const handleConfirm = () => {
    if (allMoviesProcessed) {
      // All movies have been processed, move to next screen
      onNext();
    } else if (hasMorePages) {
      // Move to next page
      setCurrentPage(prev => prev + 1);
    } else {
      // Last page, move to next screen
      onNext();
    }
  };

  return (
    <div className="vote-screen mark-seen-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Select the Movies You've Seen</h2>
        <div className="seen-count">
          Seen: {seenMovies.size} / {movies.length}
        </div>
      </div>

      <div className="vote-content">
        {allMoviesProcessed ? (
          <div className="instruction-text" style={{ textAlign: 'center', padding: '2rem' }}>
            <p>You've reviewed all movies!</p>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--color-gray)' }}>
              Click "Continue" to proceed to the next step.
            </p>
          </div>
        ) : (
          <>
            <div className="instruction-text">
              Select the movies you've seen. Showing {paginatedMovies.length} of {unseenMovies.length} remaining.
              {hasMorePages && ` (Page ${currentPage + 1} of ${totalPages})`}
            </div>

            <div className="movies-grid">
              {paginatedMovies.map(movie => {
                const isSeen = seenMovies.has(movie.id);
                const isWantToSee = wantToSeeMovies.has(movie.id);
                
                return (
                  <div
                    key={movie.id}
                    className={`movie-grid-item ${isSeen ? 'seen' : ''}`}
                    onClick={() => handleMovieClick(movie.id)}
                  >
                    <div className="movie-checkbox-small">
                      <div className={`checkbox-small ${isSeen ? 'checked' : ''}`}>
                        {isSeen && '✓'}
                      </div>
                    </div>
                    <div className="movie-title-small">{movie.title}</div>
                    {isSeen && (
                      <button
                        className={`want-to-see-btn-small ${isWantToSee ? 'active' : ''}`}
                        onClick={(e) => handleWantToSeeClick(e, movie.id)}
                        title="Want to See"
                      >
                        {isWantToSee ? '★' : '☆'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="vote-footer">
          <button
            onClick={handleConfirm}
            className="btn btn-primary"
          >
            {allMoviesProcessed ? 'Continue' : hasMorePages ? 'Confirm & Next Page' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkSeen;

