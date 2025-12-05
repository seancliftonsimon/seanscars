import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
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

const MarkSeen = ({
  movies,
  seenMovies,
  wantToSeeMovies,
  onMarkSeen,
  onWantToSee,
  onNext,
  onBack
}: MarkSeenProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovies = useMemo(() => {
    if (!searchQuery.trim()) return movies;
    const query = searchQuery.toLowerCase();
    return movies.filter(m => m.title.toLowerCase().includes(query));
  }, [movies, searchQuery]);

  const handleMovieClick = (movieId: string) => {
    onMarkSeen(movieId);
  };

  const handleWantToSeeClick = (e: React.MouseEvent, movieId: string) => {
    e.stopPropagation();
    onWantToSee(movieId);
  };

  return (
    <div className="vote-screen mark-seen-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Mark Movies You've Seen</h2>
        <div className="seen-count">Seen: {seenMovies.size}</div>
      </div>

      <div className="vote-content">
        <div className="search-container">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search movies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="movies-list">
          {filteredMovies.map(movie => {
            const isSeen = seenMovies.has(movie.id);
            const isWantToSee = wantToSeeMovies.has(movie.id);
            
            return (
              <div
                key={movie.id}
                className={`movie-item ${isSeen ? 'seen' : ''}`}
                onClick={() => handleMovieClick(movie.id)}
              >
                <div className="movie-checkbox">
                  <div className={`checkbox ${isSeen ? 'checked' : ''}`}>
                    {isSeen && '✓'}
                  </div>
                </div>
                <div className="movie-title">{movie.title}</div>
                {isSeen && (
                  <button
                    className={`want-to-see-btn ${isWantToSee ? 'active' : ''}`}
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

        <div className="vote-footer">
          <button
            onClick={onNext}
            className="btn btn-primary"
            disabled={seenMovies.size === 0}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkSeen;

