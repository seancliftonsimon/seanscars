import { useState, useEffect } from 'react';
import type { Movie } from './Vote';
import './Vote.css';

interface RankFavoritesProps {
  movies: Movie[];
  rankedMovies: Map<string, number>;
  onRankChange: (movieId: string, rank: number | null) => void;
  onNext: () => void;
  onBack: () => void;
}

const RankFavorites = ({
  movies,
  rankedMovies,
  onRankChange,
  onNext,
  onBack
}: RankFavoritesProps) => {
  const [availableRanks, setAvailableRanks] = useState<number[]>([]);

  useEffect(() => {
    // Generate available ranks based on number of movies
    const ranks = Array.from({ length: movies.length }, (_, i) => i + 1);
    setAvailableRanks(ranks);
  }, [movies.length]);

  const handleRankSelect = (movieId: string, rank: number) => {
    onRankChange(movieId, rank);
  };

  const allRanked = movies.length > 0 && movies.every(m => rankedMovies.has(m.id));
  const maxRank = Math.max(...Array.from(rankedMovies.values()), 0);

  return (
    <div className="vote-screen rank-favorites-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Rank Your Favorites</h2>
        <div className="rank-count">
          {maxRank > 0 ? `${maxRank} of ${movies.length} ranked` : 'Not ranked'}
        </div>
      </div>

      <div className="vote-content">
        <p className="instruction-text">
          Rank your favorite movies from #1 (best) to #{movies.length}.
        </p>

        <div className="ranked-movies-list">
          {movies.map(movie => {
            const currentRank = rankedMovies.get(movie.id);
            
            return (
              <div key={movie.id} className="ranked-movie-item">
                <div className="movie-title-large">{movie.title}</div>
                <select
                  value={currentRank || ''}
                  onChange={(e) => {
                    const rank = e.target.value ? parseInt(e.target.value) : null;
                    onRankChange(movie.id, rank);
                  }}
                  className="rank-select"
                >
                  <option value="">Select rank...</option>
                  {availableRanks.map(rank => {
                    const isTaken = Array.from(rankedMovies.values()).includes(rank) && rankedMovies.get(movie.id) !== rank;
                    return (
                      <option
                        key={rank}
                        value={rank}
                        disabled={isTaken}
                      >
                        #{rank} {isTaken ? '(taken)' : ''}
                      </option>
                    );
                  })}
                </select>
                {currentRank && (
                  <div className="rank-display">#{currentRank}</div>
                )}
              </div>
            );
          })}
        </div>

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

