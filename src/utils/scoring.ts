import type { Ballot } from '../services/api';
import moviesData from '../data/movies.json';
import { getCanonicalBestPictureRanks } from './bestPictureRanks';

export interface MovieStats {
    id: string;
    title: string;
    totalPoints: number;
    numOneVotes: number;
    seenCount: number;
    seenFraction: number;
    avgPointsPerViewer: number;
    rankings: number[];
}

// Borda count scoring: #1 = 5 points, #2 = 4, #3 = 3, #4 = 2, #5 = 1
export function calculateBordaScores(ballots: Ballot[]): MovieStats[] {
    const movieStats: Record<string, MovieStats> = {};

    // Get all unique movie IDs and titles from ballots
    const movieTitles: Record<string, string> = {};

    // Pre-populate with known titles from static data
    moviesData.forEach((m) => {
        movieTitles[m.id] = m.title;
    });

    ballots.forEach((ballot) => {
        if (ballot.movies && Array.isArray(ballot.movies)) {
            ballot.movies.forEach((movie) => {
                // Only use ballot title if we don't already have it from static data
                if (movie.id && !movieTitles[movie.id]) {
                    movieTitles[movie.id] = movie.title || movie.id;
                }
            });
        }
    });

    // Initialize stats for all movies
    Object.keys(movieTitles).forEach((movieId) => {
        movieStats[movieId] = {
            id: movieId,
            title: movieTitles[movieId],
            totalPoints: 0,
            numOneVotes: 0,
            seenCount: 0,
            seenFraction: 0,
            avgPointsPerViewer: 0,
            rankings: [],
        };
    });

    // Process each ballot
    ballots.forEach((ballot) => {
        if (!ballot.movies || !Array.isArray(ballot.movies)) return;

        // Count seen movies
        ballot.movies.forEach((movie) => {
            if (movie.seen && movieStats[movie.id]) {
                movieStats[movie.id].seenCount++;
            }
        });

        // Calculate Borda points for ranked movies
        const rankedMovieIds = getCanonicalBestPictureRanks(ballot);
        rankedMovieIds.forEach((movieId, index) => {
            const rank = index + 1;
            if (movieStats[movieId]) {
                const points = 6 - rank; // #1 = 5, #2 = 4, etc.
                movieStats[movieId].totalPoints += points;
                movieStats[movieId].rankings.push(rank);

                if (rank === 1) {
                    movieStats[movieId].numOneVotes++;
                }
            }
        });
    });

    // Calculate derived metrics
    const totalBallots = ballots.length;
    const results = Object.values(movieStats).map((movie) => {
        const seenFraction = totalBallots > 0 ? movie.seenCount / totalBallots : 0;
        const avgPointsPerViewer =
            movie.seenCount > 0 ? movie.totalPoints / movie.seenCount : 0;

        return {
            ...movie,
            seenFraction: parseFloat(seenFraction.toFixed(3)),
            avgPointsPerViewer: parseFloat(avgPointsPerViewer.toFixed(2)),
        };
    });

    // Sort by total points (descending)
    return results.sort((a, b) => b.totalPoints - a.totalPoints);
}

export interface WeightedMovieStats extends MovieStats {
    weightedScore: number;
}

// Weighted scoring: balances quality with reach
// Formula: (avgPointsPerViewer * 2) + (seenFraction * 5)
// This allows highly-rated niche films to compete with popular blockbusters
export function calculateWeightedScores(ballots: Ballot[]): WeightedMovieStats[] {
    const bordaResults = calculateBordaScores(ballots);

    const weightedResults = bordaResults.map((movie) => {
        // Weighted score balances quality (2x weight) with reach (5x weight)
        const weightedScore = (movie.avgPointsPerViewer * 2) + (movie.seenFraction * 5);

        return {
            ...movie,
            weightedScore: parseFloat(weightedScore.toFixed(2)),
        };
    });

    // Sort by weighted score (descending)
    return weightedResults.sort((a, b) => b.weightedScore - a.weightedScore);
}
