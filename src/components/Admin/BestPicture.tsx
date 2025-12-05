import { useEffect, useState } from 'react';
import { getBestPictureResults, type BestPictureResult } from '../../services/adminApi';
import './Admin.css';

type SortField = 'totalPoints' | 'numOneVotes' | 'seenCount' | 'seenFraction' | 'avgPointsPerViewer';
type SortDirection = 'asc' | 'desc';

const BestPicture = () => {
  const [results, setResults] = useState<BestPictureResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('totalPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getBestPictureResults();
      setResults(data);
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className={`sort-button ${sortField === field ? 'active' : ''}`}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortField === field && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
    </button>
  );

  return (
    <div className="admin-section">
      <h2>Best Picture Results</h2>
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
                <td>{result.totalPoints}</td>
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

