import { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import moviesData from '../../data/movies.json';
import './Admin.css';

const Testing = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [numBallots, setNumBallots] = useState(10);
    const [message, setMessage] = useState('');

    // Generate a random ballot
    const generateRandomBallot = () => {
        // Randomly select 15 movies that have been "seen"
        const shuffled = [...moviesData].sort(() => Math.random() - 0.5);
        const seenMovies = shuffled.slice(0, 15);

        // Create ballot movies array
        const ballotMovies = moviesData.map(movie => {
            const isSeen = seenMovies.some(m => m.id === movie.id);

            if (!isSeen) {
                // Unseen movies: randomly decide if they want to see it
                return {
                    id: movie.id,
                    seen: false,
                    wantToSee: Math.random() > 0.5,
                    title: movie.title
                };
            }

            // Seen movies: assign random rank (1-15)
            const rank = seenMovies.findIndex(m => m.id === movie.id) + 1;

            // Randomly assign fun categories (with low probability)
            return {
                id: movie.id,
                seen: true,
                rank: rank,
                underSeenRec: Math.random() > 0.85, // 15% chance
                favoriteScary: Math.random() > 0.9, // 10% chance
                funniest: Math.random() > 0.9, // 10% chance
                bestTimeAtMovies: Math.random() > 0.9, // 10% chance
                title: movie.title
            };
        });

        return {
            clientId: `test-${Math.random().toString(36).substring(7)}`,
            timestamp: new Date().toISOString(),
            ipHash: `test-hash-${Math.random().toString(36).substring(7)}`,
            movies: ballotMovies,
            flagged: false
        };
    };

    // Generate multiple random ballots
    const handleGenerateBallots = async () => {
        setIsGenerating(true);
        setMessage('');

        try {
            const ballots = [];
            for (let i = 0; i < numBallots; i++) {
                ballots.push(generateRandomBallot());
            }

            // Submit all ballots to Firestore
            const promises = ballots.map(ballot =>
                addDoc(collection(db, 'ballots'), ballot)
            );

            await Promise.all(promises);

            setMessage(`✅ Successfully generated ${numBallots} random ballot${numBallots > 1 ? 's' : ''}!`);
        } catch (error) {
            console.error('Error generating ballots:', error);
            setMessage(`❌ Error generating ballots: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Clear all ballots from the database
    const handleClearAllResults = async () => {
        if (!window.confirm(`⚠️ Are you sure you want to delete ALL ballots? This cannot be undone!`)) {
            return;
        }

        setIsClearing(true);
        setMessage('');

        try {
            const querySnapshot = await getDocs(collection(db, 'ballots'));
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));

            await Promise.all(deletePromises);

            setMessage(`✅ Successfully deleted ${querySnapshot.size} ballot${querySnapshot.size !== 1 ? 's' : ''}!`);
        } catch (error) {
            console.error('Error clearing ballots:', error);
            setMessage(`❌ Error clearing ballots: ${error}`);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="admin-section">
            <h2>Testing Tools</h2>
            <p className="section-description">
                Generate random test data or clear all results from the database.
            </p>

            {message && (
                <div className={`message ${message.startsWith('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            <div className="testing-section">
                <h3>Generate Random Ballots</h3>
                <p>
                    Create test ballots with randomized data. Each ballot will have 15 randomly selected movies marked as "seen"
                    with random rankings, and the rest marked as unseen with random "want to see" selections.
                </p>

                <div className="input-group">
                    <label htmlFor="numBallots">Number of ballots to generate:</label>
                    <input
                        id="numBallots"
                        type="number"
                        min="1"
                        max="100"
                        value={numBallots}
                        onChange={(e) => setNumBallots(parseInt(e.target.value) || 1)}
                        disabled={isGenerating}
                    />
                </div>

                <button
                    onClick={handleGenerateBallots}
                    disabled={isGenerating}
                    className="btn btn-primary"
                >
                    {isGenerating ? 'Generating...' : `Generate ${numBallots} Ballot${numBallots > 1 ? 's' : ''}`}
                </button>
            </div>

            <div className="testing-section danger-zone">
                <h3>⚠️ Danger Zone</h3>
                <p>
                    <strong>Warning:</strong> This will permanently delete all ballot submissions from the database.
                    This action cannot be undone!
                </p>

                <button
                    onClick={handleClearAllResults}
                    disabled={isClearing}
                    className="btn btn-danger"
                >
                    {isClearing ? 'Clearing...' : 'Clear All Results'}
                </button>
            </div>
        </div>
    );
};

export default Testing;
