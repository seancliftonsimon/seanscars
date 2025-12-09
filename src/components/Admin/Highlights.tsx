import type { BestPictureResult, WeightedMovieStats } from '../../services/adminApi';
import './Admin.css';

interface HighlightsProps {
    results: BestPictureResult[] | WeightedMovieStats[];
    scoringMethod: 'standard' | 'weighted';
}

const Highlights = ({ results, scoringMethod }: HighlightsProps) => {
    if (results.length === 0) {
        return null;
    }

    const top3 = results.slice(0, 3);
    const mostSeen = [...results].sort((a, b) => b.seenCount - a.seenCount)[0];
    const hiddenGems = results.filter(r => r.seenCount === 1);

    const getScore = (movie: BestPictureResult | WeightedMovieStats) => {
        if (scoringMethod === 'weighted' && 'weightedScore' in movie) {
            return movie.weightedScore.toFixed(2);
        }
        return movie.totalPoints;
    };

    const medals = ['🥇', '🥈', '🥉'];

    return (
        <div className="highlights-section">
            <h3>🏆 Highlights</h3>

            <div className="highlight-grid">
                {/* Top 3 Winners */}
                <div className="podium-section">
                    <h4>Top 3 Winners</h4>
                    <div className="podium-cards">
                        {top3.map((movie, index) => (
                            <div key={movie.id} className={`podium-card place-${index + 1}`}>
                                <div className="medal">{medals[index]}</div>
                                <div className="rank-number">#{index + 1}</div>
                                <div className="movie-title">{movie.title}</div>
                                <div className="score">
                                    {scoringMethod === 'weighted' ? 'Weighted Score' : 'Total Points'}: {getScore(movie)}
                                </div>
                                <div className="stats">
                                    <span>Seen by {movie.seenCount}</span>
                                    <span>Avg: {movie.avgPointsPerViewer.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Most Seen Movie */}
                <div className="highlight-card most-seen">
                    <div className="card-icon">👁️</div>
                    <h4>Most Seen Movie</h4>
                    <div className="card-title">{mostSeen.title}</div>
                    <div className="card-stat">
                        Seen by <strong>{mostSeen.seenCount}</strong> voters
                        <span className="percentage">
                            ({(mostSeen.seenFraction * 100).toFixed(1)}%)
                        </span>
                    </div>
                </div>

                {/* Hidden Gems */}
                {hiddenGems.length > 0 && (
                    <div className="highlight-card hidden-gems">
                        <div className="card-icon">💎</div>
                        <h4>Hidden Gems</h4>
                        <div className="card-stat">
                            <strong>{hiddenGems.length}</strong> {hiddenGems.length === 1 ? 'movie' : 'movies'} seen by only 1 person
                        </div>
                        <div className="gem-list">
                            {hiddenGems.slice(0, 3).map(gem => (
                                <div key={gem.id} className="gem-item">{gem.title}</div>
                            ))}
                            {hiddenGems.length > 3 && (
                                <div className="gem-more">+{hiddenGems.length - 3} more</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Highlights;
