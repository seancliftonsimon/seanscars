import moviesData from "../data/movies.json";
import type { Ballot as AdminBallot } from "../services/adminApi";
import { isIncludedInAnalysis } from "../services/adminApi";
import { calculateBordaScores } from "./scoring";
import { getCanonicalBestPictureRanks } from "./bestPictureRanks";

interface PreparedBallot {
	ballot: AdminBallot;
	included: boolean;
	voterName: string;
	seenMovieIds: Set<string>;
	seenCount: number;
	topFiveMovieIds: string[];
	leastFavoriteMovieId: string | null;
}

interface BallotMatch {
	ballot: PreparedBallot;
	score: number;
	sharedTopFiveCount: number;
}

interface ReportCardExportRow {
	ballot_id: string;
	voter_name: string;
	client_id: string;
	submitted_at: string;
	included_in_analysis: string;
	top_1: string;
	top_2: string;
	top_3: string;
	top_4: string;
	top_5: string;
	top_5_recap: string;
	recommendation_to_parents: string;
	recommendation_to_kid: string;
	recommendation_to_freakiest_friend: string;
	recommendation_underseen_gem: string;
	recommendation_profile_snapshot: string;
	seen_movies_count: number;
	seen_more_than_other_voters: number;
	seen_tied_with_other_voters: number;
	seen_count_percentile: number;
	seen_count_placement_summary: string;
	taste_twin_name: string;
	taste_twin_similarity_percent: number;
	taste_twin_shared_top5_count: number;
	taste_twin_recommendation: string;
	taste_twin_recommendation_source: string;
	taste_twin_recommendation_similarity_percent: number;
	most_unique_top_pick: string;
	most_unique_top_pick_other_voters_ranked_top_2_count: number;
	least_favorite: string;
	least_favorite_same_vote_other_voters_count: number;
	least_favorite_ranked_top_5_by_voters_count: number;
	least_favorite_context_summary: string;
	independent_taste_score: number;
	independent_taste_label: string;
	group_total_ballots_submitted: number;
	group_ballots_in_analysis: number;
	group_unique_voters_in_analysis: number;
	group_most_seen_movie: string;
	group_most_seen_movie_seen_by_count: number;
	group_least_seen_movie: string;
	group_least_seen_movie_seen_by_count: number;
	group_borda_top_10: string;
	group_most_polarizing_movies: string;
}

export interface ReportCardExportResult {
	csvContent: string;
	exportedBallotCount: number;
	analysisBallotCount: number;
}

const RECOMMENDATION_NOT_SELECTED = "Not selected";
const FALLBACK_VOTER_NAME = "Anonymous";
const CSV_HEADERS: Array<keyof ReportCardExportRow> = [
	"ballot_id",
	"voter_name",
	"client_id",
	"submitted_at",
	"included_in_analysis",
	"top_1",
	"top_2",
	"top_3",
	"top_4",
	"top_5",
	"top_5_recap",
	"recommendation_to_parents",
	"recommendation_to_kid",
	"recommendation_to_freakiest_friend",
	"recommendation_underseen_gem",
	"recommendation_profile_snapshot",
	"seen_movies_count",
	"seen_more_than_other_voters",
	"seen_tied_with_other_voters",
	"seen_count_percentile",
	"seen_count_placement_summary",
	"taste_twin_name",
	"taste_twin_similarity_percent",
	"taste_twin_shared_top5_count",
	"taste_twin_recommendation",
	"taste_twin_recommendation_source",
	"taste_twin_recommendation_similarity_percent",
	"most_unique_top_pick",
	"most_unique_top_pick_other_voters_ranked_top_2_count",
	"least_favorite",
	"least_favorite_same_vote_other_voters_count",
	"least_favorite_ranked_top_5_by_voters_count",
	"least_favorite_context_summary",
	"independent_taste_score",
	"independent_taste_label",
	"group_total_ballots_submitted",
	"group_ballots_in_analysis",
	"group_unique_voters_in_analysis",
	"group_most_seen_movie",
	"group_most_seen_movie_seen_by_count",
	"group_least_seen_movie",
	"group_least_seen_movie_seen_by_count",
	"group_borda_top_10",
	"group_most_polarizing_movies",
];

const incrementCount = (target: Map<string, number>, key: string) => {
	target.set(key, (target.get(key) || 0) + 1);
};

const clampUnitInterval = (value: number) => Math.min(1, Math.max(0, value));

const formatCountNoun = (count: number, singular: string, plural: string) =>
	`${count} ${count === 1 ? singular : plural}`;

const escapeCsvField = (value: string | number) =>
	`"${String(value).replace(/"/g, '""')}"`;

const buildMovieTitleMap = (ballots: AdminBallot[]) => {
	const movieTitleById = new Map<string, string>();

	moviesData.forEach((movie) => {
		movieTitleById.set(movie.id, movie.title);
	});

	ballots.forEach((ballot) => {
		ballot.movies.forEach((movie) => {
			if (movie.id && movie.title && !movieTitleById.has(movie.id)) {
				movieTitleById.set(movie.id, movie.title);
			}
		});
	});

	return movieTitleById;
};

const getMovieTitle = (
	movieId: string | null,
	movieTitleById: Map<string, string>
): string => {
	if (!movieId) {
		return RECOMMENDATION_NOT_SELECTED;
	}

	return movieTitleById.get(movieId) || movieId;
};

const prepareBallots = (ballots: AdminBallot[]) =>
	ballots.map((ballot) => {
		const topFiveMovieIds = getCanonicalBestPictureRanks(ballot).slice(0, 5);
		const leastFavoriteMovieId = ballot.recommendations?.leastFavorite || null;
		const seenMovieIds = new Set(
			Array.isArray(ballot.movies)
				? ballot.movies.filter((movie) => movie.seen).map((movie) => movie.id)
				: []
		);
		const normalizedVoterName =
			typeof ballot.voterName === "string" && ballot.voterName.trim().length > 0
				? ballot.voterName.trim()
				: FALLBACK_VOTER_NAME;

		return {
			ballot,
			included: isIncludedInAnalysis(ballot),
			voterName: normalizedVoterName,
			seenMovieIds,
			seenCount: seenMovieIds.size,
			topFiveMovieIds,
			leastFavoriteMovieId,
		} as PreparedBallot;
	});

const getSetIntersectionCount = <T,>(left: Set<T>, right: Set<T>): number => {
	let count = 0;
	left.forEach((value) => {
		if (right.has(value)) {
			count += 1;
		}
	});
	return count;
};

const getSetJaccard = <T,>(left: Set<T>, right: Set<T>): number => {
	const intersection = getSetIntersectionCount(left, right);
	const union = left.size + right.size - intersection;
	return union === 0 ? 0 : intersection / union;
};

const getRankMap = (movieIds: string[]) =>
	new Map(movieIds.map((movieId, index) => [movieId, index + 1]));

const getBallotSimilarity = (
	baseBallot: PreparedBallot,
	candidateBallot: PreparedBallot
): Omit<BallotMatch, "ballot"> => {
	const baseTopFiveSet = new Set(baseBallot.topFiveMovieIds);
	const candidateTopFiveSet = new Set(candidateBallot.topFiveMovieIds);
	const topFiveJaccard = getSetJaccard(baseTopFiveSet, candidateTopFiveSet);

	const baseRankByMovieId = getRankMap(baseBallot.topFiveMovieIds);
	const candidateRankByMovieId = getRankMap(candidateBallot.topFiveMovieIds);
	let sharedTopFiveCount = 0;
	let rankAgreementSum = 0;

	baseRankByMovieId.forEach((baseRank, movieId) => {
		const candidateRank = candidateRankByMovieId.get(movieId);
		if (!candidateRank) {
			return;
		}
		sharedTopFiveCount += 1;
		rankAgreementSum += 1 - Math.abs(baseRank - candidateRank) / 4;
	});

	const rankAgreement =
		sharedTopFiveCount > 0 ? rankAgreementSum / sharedTopFiveCount : 0;
	const seenJaccard = getSetJaccard(
		baseBallot.seenMovieIds,
		candidateBallot.seenMovieIds
	);

	const weightedSimilarity = clampUnitInterval(
		0.55 * topFiveJaccard + 0.3 * rankAgreement + 0.15 * seenJaccard
	);

	return {
		score: weightedSimilarity,
		sharedTopFiveCount,
	};
};

const getIndependentTasteLabel = (score: number): string => {
	if (score >= 70) {
		return "Highly independent taste";
	}
	if (score >= 40) {
		return "Moderately independent taste";
	}
	return "Mostly consensus-aligned";
};

const getPolarizingMoviesSummary = (
	topFiveCountByMovieId: Map<string, number>,
	leastFavoriteCountByMovieId: Map<string, number>,
	movieTitleById: Map<string, string>
): string => {
	const uniqueMovieIds = new Set([
		...topFiveCountByMovieId.keys(),
		...leastFavoriteCountByMovieId.keys(),
	]);

	const polarizingMovies = Array.from(uniqueMovieIds)
		.map((movieId) => {
			const topFiveCount = topFiveCountByMovieId.get(movieId) || 0;
			const leastFavoriteCount = leastFavoriteCountByMovieId.get(movieId) || 0;
			return {
				movieId,
				title: movieTitleById.get(movieId) || movieId,
				topFiveCount,
				leastFavoriteCount,
				polarizingScore: topFiveCount * leastFavoriteCount,
			};
		})
		.filter(
			(movie) => movie.topFiveCount > 0 && movie.leastFavoriteCount > 0
		)
		.sort((left, right) => {
			if (right.polarizingScore !== left.polarizingScore) {
				return right.polarizingScore - left.polarizingScore;
			}
			if (right.leastFavoriteCount !== left.leastFavoriteCount) {
				return right.leastFavoriteCount - left.leastFavoriteCount;
			}
			if (right.topFiveCount !== left.topFiveCount) {
				return right.topFiveCount - left.topFiveCount;
			}
			return left.title.localeCompare(right.title);
		})
		.slice(0, 5);

	if (polarizingMovies.length === 0) {
		return "None";
	}

	return polarizingMovies
		.map(
			(movie) =>
				`${movie.title} (top 5: ${movie.topFiveCount}, least favorite: ${movie.leastFavoriteCount})`
		)
		.join(" | ");
};

const buildSeenPlacementSummary = (
	seenCount: number,
	moreThanCount: number,
	tiedCount: number
) => {
	let summary = `You marked ${seenCount} movies as seen, which is more than ${formatCountNoun(
		moreThanCount,
		"other voter",
		"other voters"
	)}.`;

	if (tiedCount > 0) {
		summary += ` You tied with ${formatCountNoun(
			tiedCount,
			"other voter",
			"other voters"
		)}.`;
	}

	return summary;
};

export const buildReportCardsCsv = (
	ballots: AdminBallot[]
): ReportCardExportResult => {
	const movieTitleById = buildMovieTitleMap(ballots);
	const preparedBallots = prepareBallots(ballots);
	const analysisBallots = preparedBallots.filter((preparedBallot) => preparedBallot.included);
	const analysisBallotById = new Map(
		analysisBallots.map((preparedBallot) => [preparedBallot.ballot.id, preparedBallot])
	);
	const uniqueVotersInAnalysis = new Set(
		analysisBallots.map((preparedBallot) => preparedBallot.ballot.clientId)
	).size;

	const topFiveCountByMovieId = new Map<string, number>();
	const highRankCountByMovieId = new Map<string, number>();
	const leastFavoriteCountByMovieId = new Map<string, number>();
	const seenCountByMovieId = new Map<string, number>();

	analysisBallots.forEach((preparedBallot) => {
		preparedBallot.topFiveMovieIds.forEach((movieId, index) => {
			incrementCount(topFiveCountByMovieId, movieId);
			if (index <= 1) {
				incrementCount(highRankCountByMovieId, movieId);
			}
		});

		if (preparedBallot.leastFavoriteMovieId) {
			incrementCount(leastFavoriteCountByMovieId, preparedBallot.leastFavoriteMovieId);
		}

		preparedBallot.seenMovieIds.forEach((movieId) => {
			incrementCount(seenCountByMovieId, movieId);
		});
	});

	const bordaResults = calculateBordaScores(
		analysisBallots.map((preparedBallot) => preparedBallot.ballot)
	);
	const consensusRankByMovieId = new Map<string, number>();
	bordaResults.forEach((result, index) => {
		consensusRankByMovieId.set(result.id, index + 1);
	});

	const groupMostSeenMovie = Array.from(seenCountByMovieId.entries())
		.map(([movieId, count]) => ({
			movieId,
			title: movieTitleById.get(movieId) || movieId,
			count,
		}))
		.sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}
			return left.title.localeCompare(right.title);
		})[0] || null;

	const groupLeastSeenMovie = Array.from(seenCountByMovieId.entries())
		.map(([movieId, count]) => ({
			movieId,
			title: movieTitleById.get(movieId) || movieId,
			count,
		}))
		.filter((movie) => movie.count > 0)
		.sort((left, right) => {
			if (left.count !== right.count) {
				return left.count - right.count;
			}
			return left.title.localeCompare(right.title);
		})[0] || null;

	const groupBordaTopTen = bordaResults
		.slice(0, 10)
		.map((movie, index) => `${index + 1}. ${movie.title} (${movie.totalPoints} pts)`)
		.join(" | ");
	const groupPolarizingMovies = getPolarizingMoviesSummary(
		topFiveCountByMovieId,
		leastFavoriteCountByMovieId,
		movieTitleById
	);

	const reportRows: ReportCardExportRow[] = preparedBallots.map((preparedBallot) => {
		const isInAnalysisPool = analysisBallotById.has(preparedBallot.ballot.id);
		const analysisPeers = analysisBallots.filter(
			(candidate) =>
				!isInAnalysisPool || candidate.ballot.id !== preparedBallot.ballot.id
		);

		const seenMoreThanCount = analysisPeers.filter(
			(peer) => preparedBallot.seenCount > peer.seenCount
		).length;
		const seenTiedCount = analysisPeers.filter(
			(peer) => preparedBallot.seenCount === peer.seenCount
		).length;
		const seenPercentile =
			analysisPeers.length > 0
				? Math.round((seenMoreThanCount / analysisPeers.length) * 100)
				: 0;

		const rankedMatches: BallotMatch[] = analysisPeers
			.map((peer) => ({
				ballot: peer,
				...getBallotSimilarity(preparedBallot, peer),
			}))
			.sort((left, right) => {
				if (right.score !== left.score) {
					return right.score - left.score;
				}
				if (right.sharedTopFiveCount !== left.sharedTopFiveCount) {
					return right.sharedTopFiveCount - left.sharedTopFiveCount;
				}
				return left.ballot.voterName.localeCompare(right.ballot.voterName);
			});

		const tasteTwin = rankedMatches[0] || null;

		let recommendationFromTwinTitle = "";
		let recommendationFromTwinSource = "";
		let recommendationFromTwinSimilarityPercent = 0;
		rankedMatches.slice(0, 3).some((match) => {
			const unseenRecommendationMovieId = match.ballot.topFiveMovieIds.find(
				(movieId) => !preparedBallot.seenMovieIds.has(movieId)
			);

			if (!unseenRecommendationMovieId) {
				return false;
			}

			recommendationFromTwinTitle = getMovieTitle(
				unseenRecommendationMovieId,
				movieTitleById
			);
			recommendationFromTwinSource = match.ballot.voterName;
			recommendationFromTwinSimilarityPercent = Math.round(match.score * 100);
			return true;
		});

		let mostUniqueTopPickTitle = "";
		let mostUniqueTopPickOtherHighRankCount = 0;
		preparedBallot.topFiveMovieIds.forEach((movieId, rankIndex) => {
			const selfContributedHighRank =
				isInAnalysisPool && rankIndex <= 1 ? 1 : 0;
			const otherHighRankCount = Math.max(
				(highRankCountByMovieId.get(movieId) || 0) - selfContributedHighRank,
				0
			);

			const shouldReplaceCurrentPick =
				mostUniqueTopPickTitle.length === 0 ||
				otherHighRankCount < mostUniqueTopPickOtherHighRankCount;
			if (!shouldReplaceCurrentPick) {
				return;
			}

			mostUniqueTopPickTitle = getMovieTitle(movieId, movieTitleById);
			mostUniqueTopPickOtherHighRankCount = otherHighRankCount;
		});

		const leastFavoriteTitle = getMovieTitle(
			preparedBallot.leastFavoriteMovieId,
			movieTitleById
		);
		const leastFavoriteRawCount = preparedBallot.leastFavoriteMovieId
			? leastFavoriteCountByMovieId.get(preparedBallot.leastFavoriteMovieId) || 0
			: 0;
		const leastFavoriteSameVoteOtherVotersCount = Math.max(
			leastFavoriteRawCount - (isInAnalysisPool ? 1 : 0),
			0
		);
		const leastFavoriteRawTopFiveCount = preparedBallot.leastFavoriteMovieId
			? topFiveCountByMovieId.get(preparedBallot.leastFavoriteMovieId) || 0
			: 0;
		const selfRankedLeastFavoriteInTopFive =
			preparedBallot.leastFavoriteMovieId !== null &&
			preparedBallot.topFiveMovieIds.includes(preparedBallot.leastFavoriteMovieId);
		const leastFavoriteRankedTopFiveByCount = Math.max(
			leastFavoriteRawTopFiveCount -
				(isInAnalysisPool && selfRankedLeastFavoriteInTopFive ? 1 : 0),
			0
		);

		const leastFavoriteSummary = preparedBallot.leastFavoriteMovieId
			? `Your least favorite was ${leastFavoriteTitle}; ${formatCountNoun(
					leastFavoriteSameVoteOtherVotersCount,
					"other voter",
					"other voters"
			  )} also picked it as least favorite, and ${formatCountNoun(
					leastFavoriteRankedTopFiveByCount,
					"voter",
					"voters"
			  )} ranked it in their top 5.`
			: "No least favorite was selected.";

		const consensusCount = Math.max(consensusRankByMovieId.size, 1);
		const independentTasteScore = preparedBallot.topFiveMovieIds.length
			? Math.round(
					(preparedBallot.topFiveMovieIds.reduce((weightedTotal, movieId, index) => {
						const weight = Math.max(1, 5 - index);
						const consensusRank =
							consensusRankByMovieId.get(movieId) || consensusCount + 1;
						const normalizedDistance = (consensusRank - 1) / consensusCount;
						return weightedTotal + normalizedDistance * weight;
					}, 0) /
						preparedBallot.topFiveMovieIds.reduce(
							(totalWeight, _, index) => totalWeight + Math.max(1, 5 - index),
							0
						)) *
						100
			  )
			: 0;

		const topFiveTitles = preparedBallot.topFiveMovieIds.map((movieId) =>
			getMovieTitle(movieId, movieTitleById)
		);
		const recommendationToParents = getMovieTitle(
			preparedBallot.ballot.recommendations?.toParents || null,
			movieTitleById
		);
		const recommendationToKid = getMovieTitle(
			preparedBallot.ballot.recommendations?.toKid || null,
			movieTitleById
		);
		const recommendationToFreakiestFriend = getMovieTitle(
			preparedBallot.ballot.recommendations?.toFreakiestFriend || null,
			movieTitleById
		);
		const recommendationUnderseenGem = getMovieTitle(
			preparedBallot.ballot.recommendations?.underseenGem || null,
			movieTitleById
		);
		const recommendationProfileSnapshot = [
			`Parents: ${recommendationToParents}`,
			`Kid: ${recommendationToKid}`,
			`Freakiest friend: ${recommendationToFreakiestFriend}`,
			`Underseen gem: ${recommendationUnderseenGem}`,
		].join(" | ");

		return {
			ballot_id: preparedBallot.ballot.id,
			voter_name: preparedBallot.voterName,
			client_id: preparedBallot.ballot.clientId,
			submitted_at: preparedBallot.ballot.timestamp,
			included_in_analysis: preparedBallot.included ? "Yes" : "No",
			top_1: topFiveTitles[0] || "",
			top_2: topFiveTitles[1] || "",
			top_3: topFiveTitles[2] || "",
			top_4: topFiveTitles[3] || "",
			top_5: topFiveTitles[4] || "",
			top_5_recap: topFiveTitles.length > 0 ? topFiveTitles.join(" > ") : "",
			recommendation_to_parents: recommendationToParents,
			recommendation_to_kid: recommendationToKid,
			recommendation_to_freakiest_friend: recommendationToFreakiestFriend,
			recommendation_underseen_gem: recommendationUnderseenGem,
			recommendation_profile_snapshot: recommendationProfileSnapshot,
			seen_movies_count: preparedBallot.seenCount,
			seen_more_than_other_voters: seenMoreThanCount,
			seen_tied_with_other_voters: seenTiedCount,
			seen_count_percentile: seenPercentile,
			seen_count_placement_summary: buildSeenPlacementSummary(
				preparedBallot.seenCount,
				seenMoreThanCount,
				seenTiedCount
			),
			taste_twin_name: tasteTwin ? tasteTwin.ballot.voterName : "",
			taste_twin_similarity_percent: tasteTwin ? Math.round(tasteTwin.score * 100) : 0,
			taste_twin_shared_top5_count: tasteTwin ? tasteTwin.sharedTopFiveCount : 0,
			taste_twin_recommendation: recommendationFromTwinTitle,
			taste_twin_recommendation_source: recommendationFromTwinSource,
			taste_twin_recommendation_similarity_percent:
				recommendationFromTwinSimilarityPercent,
			most_unique_top_pick: mostUniqueTopPickTitle,
			most_unique_top_pick_other_voters_ranked_top_2_count:
				mostUniqueTopPickOtherHighRankCount,
			least_favorite: leastFavoriteTitle,
			least_favorite_same_vote_other_voters_count:
				leastFavoriteSameVoteOtherVotersCount,
			least_favorite_ranked_top_5_by_voters_count:
				leastFavoriteRankedTopFiveByCount,
			least_favorite_context_summary: leastFavoriteSummary,
			independent_taste_score: independentTasteScore,
			independent_taste_label: getIndependentTasteLabel(independentTasteScore),
			group_total_ballots_submitted: preparedBallots.length,
			group_ballots_in_analysis: analysisBallots.length,
			group_unique_voters_in_analysis: uniqueVotersInAnalysis,
			group_most_seen_movie: groupMostSeenMovie?.title || "",
			group_most_seen_movie_seen_by_count: groupMostSeenMovie?.count || 0,
			group_least_seen_movie: groupLeastSeenMovie?.title || "",
			group_least_seen_movie_seen_by_count: groupLeastSeenMovie?.count || 0,
			group_borda_top_10: groupBordaTopTen,
			group_most_polarizing_movies: groupPolarizingMovies,
		};
	});

	const csvRows = [
		CSV_HEADERS.join(","),
		...reportRows.map((row) =>
			CSV_HEADERS.map((header) => escapeCsvField(row[header])).join(",")
		),
	];

	return {
		csvContent: csvRows.join("\n"),
		exportedBallotCount: reportRows.length,
		analysisBallotCount: analysisBallots.length,
	};
};
