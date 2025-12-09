import { useEffect, useState } from 'react';
import { getBestPictureResults, getWeightedResults, type BestPictureResult, type WeightedMovieStats } from '../../services/adminApi';
import Highlights from './Highlights';
import './Admin.css';

type SortField = 'totalPoints' | 'weightedScore' | 'numOneVotes' | 'seenCount' | 'seenFraction' | 'avgPointsPerViewer';
type SortDirection = 'asc' | 'desc';
type ScoringMethod = 'standard' | 'weighted';

const BestPicture = () => {
  const [standardResults, setStandardResults] = useState<BestPictureResult[]>([]);
  const [weightedResults, setWeightedResults] = useState<WeightedMovieStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('totalPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>('standard');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [standard, weighted] = await Promise.all([
        getBestPictureResults(),
        getWeightedResults()
      ]);
      setStandardResults(standard);
      setWeightedResults(weighted);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
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

  // Switch sort field when changing scoring method
  useEffect(() => {
    if (scoringMethod === 'weighted' && sortField === 'totalPoints') {
      setSortField('weightedScore');
    } else if (scoringMethod === 'standard' && sortField === 'weightedScore') {
      setSortField('totalPoints');
    }
  }, [scoringMethod, sortField]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const currentResults = scoringMethod === 'standard' ? standardResults : weightedResults;

  const sortedResults = [...currentResults].sort((a, b) => {
    const aVal = a[sortField as keyof typeof a] as number;
    const bVal = b[sortField as keyof typeof b] as number;
    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => {
    // Don't show weighted score button in standard mode or total points in weighted mode
    if (scoringMethod === 'standard' && field === 'weightedScore') return null;
    if (scoringMethod === 'weighted' && field === 'totalPoints') return null;

    return (
      <button
        className={`sort-button ${sortField === field ? 'active' : ''}`}
        onClick={() => handleSort(field)}
      >
        {label}
        {sortField === field && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
      </button>
    );
  };

  return (
    <div className="admin-section">
      <h2>Best Picture Results</h2>

      {/* Scoring Method Toggle */}
      <div className="scoring-toggle">
        <button
          className={`toggle-btn ${scoringMethod === 'standard' ? 'active' : ''}`}
          onClick={() => setScoringMethod('standard')}
        >
          Standard (Borda Count)
        </button>
        <button
          className={`toggle-btn ${scoringMethod === 'weighted' ? 'active' : ''}`}
          onClick={() => setScoringMethod('weighted')}
        >
          Weighted (Quality + Reach)
        </button>
      </div>

      {/* Highlights Section */}
      <Highlights results={currentResults} scoringMethod={scoringMethod} />

      {/* Results Table */}
      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>
                <SortButton field="totalPoints" label="Movie" />
              </th>
              <th>
                <SortButton field="totalPoints" label="Total Points" />
                <SortButton field="weightedScore" label="Weighted Score" />
              </th>
              <th>
                <SortButton field="numOneVotes" label="#1 Votes" />
              </th>
              <th>
                <SortButton field="seenCount" label="Seen Count" />
              </th>
              <th>
                <SortButton field="seenFraction" label="Seen Fraction" />
              </th>
              <th>
                <SortButton field="avgPointsPerViewer" label="Avg Points/Viewer" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => (
              <tr key={result.id} className={index < 3 ? 'top-three' : ''}>
                <td>{index + 1}</td>
                <td className="movie-title-cell">{result.title}</td>
                <td>
                  {scoringMethod === 'weighted' && 'weightedScore' in result
                    ? (result as WeightedMovieStats).weightedScore.toFixed(2)
                    : result.totalPoints}
                </td>
                <td>{result.numOneVotes}</td>
                <td>{result.seenCount}</td>
                <td>{(result.seenFraction * 100).toFixed(1)}%</td>
                <td>{result.avgPointsPerViewer.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={fetchData} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        Refresh
      </button>
    </div>
  );
};

export default BestPicture;

