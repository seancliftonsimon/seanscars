import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Welcome from './Welcome';
import MarkSeen from './MarkSeen';
import ChooseFavorites from './ChooseFavorites';
import RankFavorites from './RankFavorites';
import ExtraQuestions from './ExtraQuestions';
import moviesData from '../../data/movies.json';
import { getOrCreateClientId } from '../../utils/voting';
import { submitBallot, hashIP, type Ballot, type BallotMovie } from '../../services/api';
import './Vote.css';

export interface Movie {
  id: string;
  title: string;
}

const Vote = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState(0);
  const [movies] = useState<Movie[]>(moviesData);
  const [seenMovies, setSeenMovies] = useState<Set<string>>(new Set());
  const [wantToSeeMovies, setWantToSeeMovies] = useState<Set<string>>(new Set());
  const [favoriteMovies, setFavoriteMovies] = useState<Set<string>>(new Set());
  const [rankedMovies, setRankedMovies] = useState<Map<string, number>>(new Map());
  const [extraQuestions, setExtraQuestions] = useState<{
    underSeenRec?: string;
    favoriteScary?: string;
    funniest?: string;
    bestTimeAtMovies?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize client ID on mount
    getOrCreateClientId();
  }, []);

  const handleMarkSeen = (movieId: string) => {
    const newSeen = new Set(seenMovies);
    if (newSeen.has(movieId)) {
      newSeen.delete(movieId);
      // Also remove from favorites if it was there
      const newFavorites = new Set(favoriteMovies);
      newFavorites.delete(movieId);
      setFavoriteMovies(newFavorites);
      // Remove from rankings
      const newRanked = new Map(rankedMovies);
      newRanked.delete(movieId);
      setRankedMovies(newRanked);
    } else {
      newSeen.add(movieId);
    }
    setSeenMovies(newSeen);
  };

  const handleWantToSee = (movieId: string) => {
    const newWantToSee = new Set(wantToSeeMovies);
    if (newWantToSee.has(movieId)) {
      newWantToSee.delete(movieId);
    } else {
      newWantToSee.add(movieId);
    }
    setWantToSeeMovies(newWantToSee);
  };

  const handleToggleFavorite = (movieId: string) => {
    const newFavorites = new Set(favoriteMovies);
    if (newFavorites.has(movieId)) {
      newFavorites.delete(movieId);
      // Remove from rankings
      const newRanked = new Map(rankedMovies);
      newRanked.delete(movieId);
      setRankedMovies(newRanked);
    } else {
      if (newFavorites.size < 5) {
        newFavorites.add(movieId);
      }
    }
    setFavoriteMovies(newFavorites);
  };

  const handleRankChange = (movieId: string, rank: number | null) => {
    const newRanked = new Map(rankedMovies);
    
    // Remove any existing rank for this movie
    newRanked.delete(movieId);
    
    // Remove the rank from any other movie that had it
    if (rank !== null) {
      for (const [id, r] of newRanked.entries()) {
        if (r === rank) {
          newRanked.delete(id);
          break;
        }
      }
      newRanked.set(movieId, rank);
    }
    
    setRankedMovies(newRanked);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const clientId = getOrCreateClientId();
      const ipHash = hashIP();
      
      // Build ballot movies array
      const ballotMovies: BallotMovie[] = movies.map(movie => ({
        id: movie.id,
        seen: seenMovies.has(movie.id),
        wantToSee: wantToSeeMovies.has(movie.id),
        rank: rankedMovies.get(movie.id) || null,
        underSeenRec: extraQuestions.underSeenRec === movie.id,
        favoriteScary: extraQuestions.favoriteScary === movie.id,
        funniest: extraQuestions.funniest === movie.id,
        bestTimeAtMovies: extraQuestions.bestTimeAtMovies === movie.id
      }));

      const ballot: Ballot = {
        clientId,
        timestamp: new Date().toISOString(),
        ipHash,
        movies: ballotMovies,
        flagged: false
      };

      await submitBallot(ballot);
      setScreen(5); // Success screen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ballot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (screen === 0) {
      setScreen(1);
    } else if (screen === 1) {
      if (seenMovies.size > 0) {
        setScreen(2);
      }
    } else if (screen === 2) {
      if (favoriteMovies.size > 0 && favoriteMovies.size <= 5) {
        setScreen(3);
      }
    }
  };

  const handleBack = () => {
    if (screen > 0) {
      setScreen(screen - 1);
    }
  };

  return (
    <div className="vote-container">
      {screen === 0 && <Welcome onStart={handleNext} />}
      {screen === 1 && (
        <MarkSeen
          movies={movies}
          seenMovies={seenMovies}
          wantToSeeMovies={wantToSeeMovies}
          onMarkSeen={handleMarkSeen}
          onWantToSee={handleWantToSee}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {screen === 2 && (
        <ChooseFavorites
          movies={movies.filter(m => seenMovies.has(m.id))}
          favoriteMovies={favoriteMovies}
          onToggleFavorite={handleToggleFavorite}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {screen === 3 && (
        <RankFavorites
          movies={movies.filter(m => favoriteMovies.has(m.id))}
          rankedMovies={rankedMovies}
          onRankChange={handleRankChange}
          onNext={() => setScreen(4)}
          onBack={handleBack}
        />
      )}
      {screen === 4 && (
        <ExtraQuestions
          movies={movies.filter(m => seenMovies.has(m.id))}
          extraQuestions={extraQuestions}
          onExtraQuestionChange={(question, movieId) => {
            setExtraQuestions(prev => ({ ...prev, [question]: movieId }));
          }}
          onSubmit={handleSubmit}
          onBack={handleBack}
          submitting={submitting}
          error={error}
        />
      )}
      {screen === 5 && (
        <div className="vote-success">
          <h1>Thank You!</h1>
          <p>Your vote has been submitted successfully.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Return to Home
          </button>
        </div>
      )}
    </div>
  );
};

export default Vote;

