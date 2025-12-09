import { useState } from 'react';
import { seedRandomBallots, clearAllBallots } from '../../services/api';

const TestTools = () => {
    const [seedCount, setSeedCount] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSeed = async () => {
        if (confirm(`Are you sure you want to generate ${seedCount} random ballots?`)) {
            setLoading(true);
            try {
                await seedRandomBallots(seedCount);
                setMessage(`Successfully seeded ${seedCount} ballots.`);
                // Refresh data across components
                window.dispatchEvent(new Event('refresh-data'));
            } catch (error) {
                console.error(error);
                setMessage('Error seeding ballots.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleClear = async () => {
        if (confirm('WARNING: This will delete ALL ballots. This action cannot be undone. Are you sure?')) {
            if (confirm('Seriously, are you absolutely sure you want to delete ALL data?')) {
                setLoading(true);
                try {
                    await clearAllBallots();
                    setMessage('All ballots have been cleared.');
                    // Refresh data across components
                    window.dispatchEvent(new Event('refresh-data'));
                } catch (error) {
                    console.error(error);
                    setMessage('Error clearing ballots.');
                } finally {
                    setLoading(false);
                }
            }
        }
    };

    return (
        <div className="admin-section">
            <h2>Test Tools</h2>
            {message && <div className="alert alert-info">{message}</div>}

            <div className="tool-card">
                <h3>Generate Random Ballots</h3>
                <p>Use this tool to populate the database with random voting data for testing.</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                    <input
                        type="number"
                        min="1"
                        max="1000"
                        value={seedCount}
                        onChange={(e) => setSeedCount(parseInt(e.target.value) || 0)}
                        style={{ padding: '8px', fontSize: '16px' }}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSeed}
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : 'Generate Ballots'}
                    </button>
                </div>
            </div>

            <div className="tool-card" style={{ marginTop: '30px', borderTop: '1px solid #444', paddingTop: '20px' }}>
                <h3 style={{ color: '#ff4444' }}>Danger Zone</h3>
                <p>Clear all ballot data from the database.</p>
                <button
                    className="btn"
                    style={{ backgroundColor: '#ff4444', color: 'white' }}
                    onClick={handleClear}
                    disabled={loading}
                >
                    {loading ? 'Clearing...' : 'Clear All Ballots'}
                </button>
            </div>
        </div>
    );
};

export default TestTools;
