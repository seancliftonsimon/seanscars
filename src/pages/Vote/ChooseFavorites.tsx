import type { Movie } from './Vote';
import './Vote.css';

interface ChooseFavoritesProps {
  movies: Movie[];
  favoriteMovies: Set<string>;
  onToggleFavorite: (movieId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const ChooseFavorites = ({
  movies,
  favoriteMovies,
  onToggleFavorite,
  onNext,
  onBack
}: ChooseFavoritesProps) => {
  const handleMovieClick = (movieId: string) => {
    onToggleFavorite(movieId);
  };

  return (
    <div className="vote-screen choose-favorites-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Choose Your Favorites</h2>
        <div className="favorites-count">
          Selected {favoriteMovies.size} of 5
        </div>
      </div>

      <div className="vote-content">
        <p className="instruction-text">
          Select up to 5 of your favorite movies from the ones you've seen.
        </p>

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

        <div className="vote-footer">
          <button
            onClick={onNext}
            className="btn btn-primary"
            disabled={favoriteMovies.size === 0 || favoriteMovies.size > 5}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChooseFavorites;

