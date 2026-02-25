import { useMemo, useState } from "react";
import type { Movie } from "./Vote";
import './Vote.css';

interface ChooseFavoritesProps {
  movies: Movie[];
  favoriteMovies: Set<string>;
  onToggleFavorite: (movieId: string) => void;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
  requiredCount: number;
}

const ChooseFavorites = ({
  movies,
  favoriteMovies,
  onToggleFavorite,
  onNext,
  onBack,
  error,
  requiredCount
}: ChooseFavoritesProps) => {
  const moviesPerPage = 5;
  const [currentPage, setCurrentPage] = useState(0);
  const hasEnoughSeenMovies = movies.length >= requiredCount;
  const totalPages = Math.max(1, Math.ceil(movies.length / moviesPerPage));
  const effectivePage = Math.min(currentPage, totalPages - 1);
  const hasPreviousPage = effectivePage > 0;
  const hasMorePages = effectivePage < totalPages - 1;

  const paginatedMovies = useMemo(() => {
    const start = effectivePage * moviesPerPage;
    return movies.slice(start, start + moviesPerPage);
  }, [effectivePage, movies]);

  const shownStartIndex = movies.length === 0 ? 0 : effectivePage * moviesPerPage + 1;
  const shownEndIndex =
    movies.length === 0
      ? 0
      : Math.min(shownStartIndex + paginatedMovies.length - 1, movies.length);

  const handleMovieClick = (movieId: string) => {
    if (!hasEnoughSeenMovies) {
      return;
    }

    onToggleFavorite(movieId);
  };

  return (
    <div className="vote-screen choose-favorites-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Choose Your Favorites</h2>
        <div className="favorites-count">
          Selected {favoriteMovies.size} of {requiredCount}
        </div>
      </div>

      <div className="vote-content">
        <p className="instruction-text">
          Pick exactly {requiredCount} favorites.
        </p>
        <div className="mark-seen-progress">
          Page {effectivePage + 1} of {totalPages} | Shown {shownStartIndex}-{shownEndIndex} of {movies.length}
        </div>

        {!hasEnoughSeenMovies && (
          <div className="error-message">
            You have only seen {movies.length} movie{movies.length === 1 ? "" : "s"}. Go back to Mark Seen and select at least {requiredCount} so you can continue.
            <div style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                Back to Mark Seen
              </button>
            </div>
          </div>
        )}
        {error && <div className="error-message">{error}</div>}

        <div className="movies-list">
          {paginatedMovies.map(movie => {
            const isFavorite = favoriteMovies.has(movie.id);
            
            return (
              <div
                key={movie.id}
                className={`movie-item favorite-item ${isFavorite ? 'selected' : ''}`}
                onClick={() => handleMovieClick(movie.id)}
              >
                <div className="movie-checkbox">
                  <div className={`checkbox ${isFavorite ? 'checked' : ''}`}>
                    {isFavorite && '✓'}
                  </div>
                </div>
                <div className="movie-title">{movie.title}</div>
                {isFavorite && (
                  <div className="favorite-badge">Favorite</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="vote-footer favorites-footer">
          <div className="favorites-page-controls">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage(Math.max(0, effectivePage - 1))}
              disabled={!hasPreviousPage}
            >
              Prev Page
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, effectivePage + 1))}
              disabled={!hasMorePages}
            >
              Next Page
            </button>
          </div>
          <button
            onClick={onNext}
            className="btn btn-primary"
            disabled={!hasEnoughSeenMovies || favoriteMovies.size !== requiredCount}
          >
            Rank Favorites
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChooseFavorites;
