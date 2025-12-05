import { useState, useMemo } from 'react';
import type { Movie } from './Vote';
import './Vote.css';

interface MarkSeenProps {
  movies: Movie[];
  seenMovies: Set<string>;
  wantToSeeMovies: Set<string>;
  onMarkSeen: (movieId: string) => void;
  onMarkSeenBatch: (movieIds: string[], action: 'add' | 'remove') => void;
  onWantToSee: (movieId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const MOVIES_PER_PAGE = 8;

const MarkSeen = ({
  movies,
  seenMovies,
  wantToSeeMovies,
  onMarkSeen,
  onMarkSeenBatch,
  onWantToSee,
  onNext,
  onBack
}: MarkSeenProps) => {
  const [currentPage, setCurrentPage] = useState(0);

  // Get movies for current page - show all movies regardless of seen status
  const paginatedMovies = useMemo(() => {
    const start = currentPage * MOVIES_PER_PAGE;
    const end = start + MOVIES_PER_PAGE;
    return movies.slice(start, end);
  }, [movies, currentPage]);

  const totalPages = Math.ceil(movies.length / MOVIES_PER_PAGE);
  const hasMorePages = currentPage < totalPages - 1;

  const rowOneMovies = paginatedMovies.slice(0, 4);
  const rowTwoMovies = paginatedMovies.slice(4, 8);


  const handleMovieClick = (movieId: string) => {
    onMarkSeen(movieId);
  };

  const handleWantToSeeClick = (e: React.MouseEvent, movieId: string) => {
    e.stopPropagation();
    onWantToSee(movieId);
  };

  const handleSeenAllRow = (rowMovies: Movie[]) => {
    const moviesToMark = rowMovies.map(m => m.id);
    onMarkSeenBatch(moviesToMark, 'add');
  };

  const handleSeenNoneRow = (rowMovies: Movie[]) => {
    const moviesToUnmark = rowMovies.map(m => m.id);
    onMarkSeenBatch(moviesToUnmark, 'remove');
  };

  const handleNextPage = () => {
    if (hasMorePages) {
      setCurrentPage(prev => prev + 1);
    } else {
      onNext();
    }
  };

  const renderMovieRow = (rowMovies: Movie[], rowIndex: number) => (
    <div className="movie-row-container" key={rowIndex}>
      <div className="row-controls-left">
        <button
          onClick={() => handleSeenNoneRow(rowMovies)}
          className="btn btn-secondary btn-small btn-row-action"
        >
          None
        </button>
      </div>

      <div className="movies-row">
        {rowMovies.map(movie => {
          const isSeen = seenMovies.has(movie.id);
          const isWantToSee = wantToSeeMovies.has(movie.id);

          return (
            <div
              key={movie.id}
              className={`movie-grid-item ${isSeen ? 'seen' : 'not-seen'}`}
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

      <div className="row-controls-right">
        <button
          onClick={() => handleSeenAllRow(rowMovies)}
          className="btn btn-secondary btn-small btn-row-action"
        >
          All
        </button>
      </div>
    </div>
  );

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
        <div className="instruction-text">
          Select the movies you've seen. Page {currentPage + 1} of {totalPages}
        </div>

        <div className="movies-rows-layout">
          {renderMovieRow(rowOneMovies, 1)}
          {rowTwoMovies.length > 0 && renderMovieRow(rowTwoMovies, 2)}
        </div>

        <div className="vote-footer">
          <button
            onClick={handleNextPage}
            className="btn btn-primary"
          >
            {hasMorePages ? 'Next' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkSeen;

