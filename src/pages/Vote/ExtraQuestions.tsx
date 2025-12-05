import type { Movie } from './Vote';
import './Vote.css';

interface ExtraQuestionsProps {
  movies: Movie[];
  extraQuestions: {
    underSeenRec?: string;
    favoriteScary?: string;
    funniest?: string;
    bestTimeAtMovies?: string;
  };
  onExtraQuestionChange: (question: string, movieId: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

const ExtraQuestions = ({
  movies,
  extraQuestions,
  onExtraQuestionChange,
  onSubmit,
  onBack,
  submitting,
  error
}: ExtraQuestionsProps) => {
  const handleChange = (question: string, value: string) => {
    onExtraQuestionChange(question, value || '');
  };

  return (
    <div className="vote-screen extra-questions-screen">
      <div className="vote-header">
        <button onClick={onBack} className="btn-back">← Back</button>
        <h2>Optional Questions</h2>
      </div>

      <div className="vote-content">
        <p className="instruction-text">
          Answer these optional questions to help us discover hidden gems and favorites. You can skip any question.
        </p>

        <div className="extra-questions-list">
          <div className="question-item">
            <label htmlFor="underSeenRec" className="question-label">
              Under-seen recommendation
            </label>
            <select
              id="underSeenRec"
              value={extraQuestions.underSeenRec || ''}
              onChange={(e) => handleChange('underSeenRec', e.target.value)}
              className="question-select"
            >
              <option value="">Select a movie...</option>
              {movies.map(movie => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>

          <div className="question-item">
            <label htmlFor="favoriteScary" className="question-label">
              Favorite scary movie
            </label>
            <select
              id="favoriteScary"
              value={extraQuestions.favoriteScary || ''}
              onChange={(e) => handleChange('favoriteScary', e.target.value)}
              className="question-select"
            >
              <option value="">Select a movie...</option>
              {movies.map(movie => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>

          <div className="question-item">
            <label htmlFor="funniest" className="question-label">
              Funniest movie
            </label>
            <select
              id="funniest"
              value={extraQuestions.funniest || ''}
              onChange={(e) => handleChange('funniest', e.target.value)}
              className="question-select"
            >
              <option value="">Select a movie...</option>
              {movies.map(movie => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>

          <div className="question-item">
            <label htmlFor="bestTimeAtMovies" className="question-label">
              Best "time at the movies"
            </label>
            <select
              id="bestTimeAtMovies"
              value={extraQuestions.bestTimeAtMovies || ''}
              onChange={(e) => handleChange('bestTimeAtMovies', e.target.value)}
              className="question-select"
            >
              <option value="">Select a movie...</option>
              {movies.map(movie => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <div className="vote-footer">
          <button
            onClick={onSubmit}
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtraQuestions;

