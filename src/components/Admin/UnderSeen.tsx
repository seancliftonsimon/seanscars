import { useEffect, useState } from 'react';
import { getUnderSeenResults, type UnderSeenResult } from '../../services/adminApi';
import './Admin.css';

const UnderSeen = () => {
  const [results, setResults] = useState<UnderSeenResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getUnderSeenResults();
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load under-seen results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      fetchData();
    };

    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  if (loading) {
    return <div className="loading">Loading under-seen results...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="admin-section">
      <h2>Under-Seen / Hidden Gem Award</h2>
      <p className="section-description">
        Movies with seen fraction ≤ 40%, sorted by average points per viewer.
      </p>
      
      {results.length === 0 ? (
        <p>No under-seen movies found.</p>
      ) : (
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Movie</th>
                <th>Avg Points/Viewer</th>
                <th>Seen Fraction</th>
                <th>Recommendation Votes</th>
                <th>Total Points</th>
                <th>Seen Count</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={result.id} className={index === 0 ? 'winner' : ''}>
                  <td>{index + 1}</td>
                  <td className="movie-title-cell">
                    {result.title}
                    {index === 0 && <span className="winner-badge">Winner</span>}
                  </td>
                  <td>{result.avgPointsPerViewer.toFixed(2)}</td>
                  <td>{(result.seenFraction * 100).toFixed(1)}%</td>
                  <td>{result.recommendationVotes}</td>
                  <td>{result.totalPoints}</td>
                  <td>{result.seenCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={fetchData} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        Refresh
      </button>
    </div>
  );
};

export default UnderSeen;

