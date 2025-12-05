import { useEffect, useState } from 'react';
import { getOverview, type Overview as OverviewType } from '../../services/adminApi';
import './Admin.css';

const Overview = () => {
  const [overview, setOverview] = useState<OverviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getOverview();
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
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
    return <div className="loading">Loading overview...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!overview) {
    return <div>No data available</div>;
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="admin-section">
      <h2>Overview</h2>
      <div className="overview-grid">
        <div className="stat-card">
          <div className="stat-label">Total Ballots</div>
          <div className="stat-value">{overview.totalBallots}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Voters</div>
          <div className="stat-value">{overview.uniqueClientIds}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Possible Duplicates</div>
          <div className="stat-value">{overview.possibleDuplicates}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Recent Submission</div>
          <div className="stat-value-small">{formatDate(overview.mostRecentSubmission)}</div>
        </div>
      </div>
      <button onClick={fetchData} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        Refresh
      </button>
    </div>
  );
};

export default Overview;

