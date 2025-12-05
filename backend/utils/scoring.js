// Borda count scoring: #1 = 5 points, #2 = 4, #3 = 3, #4 = 2, #5 = 1

export function calculateBordaScores(ballots) {
	const movieStats = {};

	// Get all unique movie IDs and titles from ballots
	const movieTitles = {};
	ballots.forEach((ballot) => {
		if (ballot.movies && Array.isArray(ballot.movies)) {
			ballot.movies.forEach((movie) => {
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
		const rankedMovies = ballot.movies
			.filter((m) => m.seen && m.rank && m.rank >= 1 && m.rank <= 5)
			.sort((a, b) => a.rank - b.rank);

		rankedMovies.forEach((movie) => {
			if (movieStats[movie.id]) {
				const points = 6 - movie.rank; // #1 = 5, #2 = 4, etc.
				movieStats[movie.id].totalPoints += points;
				movieStats[movie.id].rankings.push(movie.rank);

				if (movie.rank === 1) {
					movieStats[movie.id].numOneVotes++;
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

// Calculate under-seen award results
export function calculateUnderSeenAwards(ballots, threshold = 0.4) {
	const bestPictureResults = calculateBordaScores(ballots);
	const totalBallots = ballots.length;

	// Filter for under-seen movies (seenFraction <= threshold)
	const underSeenMovies = bestPictureResults.filter(
		(movie) => movie.seenFraction <= threshold
	);

	// Count under-seen recommendation votes
	const recommendationCounts = {};
	ballots.forEach((ballot) => {
		if (ballot.movies && Array.isArray(ballot.movies)) {
			ballot.movies.forEach((movie) => {
				if (movie.underSeenRec && movie.id) {
					recommendationCounts[movie.id] =
						(recommendationCounts[movie.id] || 0) + 1;
				}
			});
		}
	});

	// Add recommendation counts to under-seen movies
	const results = underSeenMovies.map((movie) => ({
		...movie,
		recommendationVotes: recommendationCounts[movie.id] || 0,
	}));

	// Sort by avg points per viewer (descending), then by recommendation votes
	return results.sort((a, b) => {
		if (b.avgPointsPerViewer !== a.avgPointsPerViewer) {
			return b.avgPointsPerViewer - a.avgPointsPerViewer;
		}
		return b.recommendationVotes - a.recommendationVotes;
	});
}

// Calculate fun category winners
export function calculateFunCategories(ballots) {
	const categories = {
		favoriteScary: {},
		funniest: {},
		bestTimeAtMovies: {},
	};

	// Count votes for each category
	ballots.forEach((ballot) => {
		if (ballot.movies && Array.isArray(ballot.movies)) {
			ballot.movies.forEach((movie) => {
				if (movie.favoriteScary && movie.id) {
					categories.favoriteScary[movie.id] =
						(categories.favoriteScary[movie.id] || 0) + 1;
				}
				if (movie.funniest && movie.id) {
					categories.funniest[movie.id] =
						(categories.funniest[movie.id] || 0) + 1;
				}
				if (movie.bestTimeAtMovies && movie.id) {
					categories.bestTimeAtMovies[movie.id] =
						(categories.bestTimeAtMovies[movie.id] || 0) + 1;
				}
			});
		}
	});

	// Get movie titles
	const movieTitles = {};
	ballots.forEach((ballot) => {
		if (ballot.movies && Array.isArray(ballot.movies)) {
			ballot.movies.forEach((movie) => {
				if (movie.id && !movieTitles[movie.id]) {
					movieTitles[movie.id] = movie.title || movie.id;
				}
			});
		}
	});

	// Find winners for each category
	const results = {};
	Object.keys(categories).forEach((category) => {
		const votes = categories[category];
		const entries = Object.entries(votes)
			.map(([movieId, count]) => ({
				id: movieId,
				title: movieTitles[movieId] || movieId,
				votes: count,
			}))
			.sort((a, b) => b.votes - a.votes);

		results[category] = {
			winner: entries.length > 0 ? entries[0] : null,
			allResults: entries,
		};
	});

	return results;
}
