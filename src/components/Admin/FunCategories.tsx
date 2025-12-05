import { useEffect, useState } from 'react';
import { getFunCategories, type FunCategories as FunCategoriesType } from '../../services/adminApi';
import './Admin.css';

const FunCategories = () => {
  const [results, setResults] = useState<FunCategoriesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getFunCategories();
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fun categories');
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
    return <div className="loading">Loading fun categories...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!results) {
    return <div>No data available</div>;
  }

  const CategoryTable = ({ 
    title, 
    result 
  }: { 
    title: string; 
    result: { winner: { id: string; title: string; votes: number } | null; allResults: Array<{ id: string; title: string; votes: number }> } 
  }) => (
    <div className="fun-category-card">
      <h3>{title}</h3>
      {result.winner ? (
        <div className="category-winner">
          <div className="winner-title">{result.winner.title}</div>
          <div className="winner-votes">{result.winner.votes} vote{result.winner.votes !== 1 ? 's' : ''}</div>
        </div>
      ) : (
        <div className="no-winner">No votes yet</div>
      )}
      
      {result.allResults.length > 1 && (
        <div className="category-all-results">
          <h4>All Results:</h4>
          <table className="category-table">
            <thead>
              <tr>
                <th>Movie</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              {result.allResults.map((item, index) => (
                <tr key={item.id} className={index === 0 ? 'top-result' : ''}>
                  <td>{item.title}</td>
                  <td>{item.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-section">
      <h2>Fun Categories</h2>
      <div className="fun-categories-grid">
        <CategoryTable title="Favorite Scary Movie" result={results.favoriteScary} />
        <CategoryTable title="Funniest Movie" result={results.funniest} />
        <CategoryTable title="Best Time at the Movies" result={results.bestTimeAtMovies} />
      </div>
      <button onClick={fetchData} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        Refresh
      </button>
    </div>
  );
};

export default FunCategories;

