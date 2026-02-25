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
  const hasEnoughSeenMovies = movies.length >= requiredCount;

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
          {movies.map(movie => {
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
          <button
            onClick={onNext}
            className="btn btn-primary"
            disabled={!hasEnoughSeenMovies || favoriteMovies.size !== requiredCount}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChooseFavorites;
