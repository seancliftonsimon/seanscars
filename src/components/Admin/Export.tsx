import { useState } from 'react';
import {
  getAllBallots,
  getBestPictureResults,
  getWeightedResults
} from '../../services/adminApi';
import { getCanonicalBestPictureRanks } from '../../utils/bestPictureRanks';
import './Admin.css';

const Export = () => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportToJSON = async () => {
    setExporting(true);
    setError(null);

    try {
      const [ballots, bestPicture, weightedBestPicture] = await Promise.all([
        getAllBallots(),
        getBestPictureResults(),
        getWeightedResults()
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        ballots,
        results: {
          bestPicture,
          weightedBestPicture
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `awards-voting-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    setError(null);

    try {
      const ballots = await getAllBallots();

      // Create CSV header
      const headers = [
        'ID',
        'Client ID',
        'Voter Name',
        'Timestamp',
        'Flagged',
        'Seen Movies',
        'Ranked Movies'
      ];

      // Create CSV rows
      const rows = ballots.map(ballot => {
        const seenMovies = ballot.movies.filter(m => m.seen).map(m => m.id).join('; ');
        const rankedMovies = getCanonicalBestPictureRanks(ballot)
          .map((movieId, index) => `${movieId} (#${index + 1})`)
          .join('; ');

        return [
          ballot.id,
          ballot.clientId,
          ballot.voterName || '',
          ballot.timestamp,
          ballot.flagged ? 'Yes' : 'No',
          seenMovies,
          rankedMovies
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      // Combine header and rows
      const csvContent = [headers.join(','), ...rows].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `awards-voting-ballots-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-section">
      <h2>Export Data</h2>
      <p className="section-description">
        Download all voting data and results in JSON or CSV format.
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="export-buttons">
        <button
          onClick={exportToJSON}
          className="btn btn-primary"
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Download JSON'}
        </button>
        <button
          onClick={exportToCSV}
          className="btn btn-primary"
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Download CSV'}
        </button>
      </div>

      <div className="export-info">
        <h3>Export Contents:</h3>
        <ul>
          <li><strong>JSON:</strong> Complete ballot data plus Best Picture results</li>
          <li><strong>CSV:</strong> All ballots in spreadsheet format</li>
        </ul>
      </div>
    </div>
  );
};

export default Export;
