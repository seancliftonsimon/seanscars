import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Welcome from "./Welcome";
import MarkSeen from "./MarkSeen";
import ChooseFavorites from "./ChooseFavorites";
import RankFavorites from "./RankFavorites";
import OptionalRecommendations from "./OptionalRecommendations";
import StepMessage from "./StepMessage";
import moviesData from "../../data/movies.json";
import { getOrCreateClientId } from "../../utils/voting";
import {
	BALLOT_SCHEMA_VERSION,
	type BallotRecommendationKey,
	type BallotRecommendations,
	getPopularityOrderedMovieIds,
	hashIP,
	incrementSeenCounts,
	setBallotRecommendationsCompletedAt,
	submitBallot,
	updateBallotRecommendation,
	type Ballot,
	type BallotMovie,
} from "../../services/api";
import "./Vote.css";

export interface Movie {
	id: string;
	title: string;
}

const VOTER_NAME_STORAGE_KEY = "vote.voterName";
const SEEN_MOVIES_STORAGE_KEY = "vote.seenMovies";
const MARK_SEEN_ORDER_STORAGE_KEY = "vote.markSeenOrder";
const FAVORITES_ORDER_STORAGE_KEY = "vote.favoritesOrder";
const SEEN_COUNT_COMMIT_STATE_STORAGE_KEY = "vote.seenCountCommitState";
const REQUIRED_FAVORITES_COUNT = 5;
const SEAN_NEW_MOVIES_SEEN_COUNT = 57;
const MASTER_MOVIE_IDS = moviesData.map((movie) => movie.id);
const MASTER_MOVIE_ID_SET = new Set(MASTER_MOVIE_IDS);

interface SeenCountCommitState {
	committedMovieIds: string[];
	committedAt: string | null;
}

interface OptionalRecommendationQuestion {
	key: BallotRecommendationKey;
	prompt: string;
}

interface BallotSnapshot {
	seenCount: number;
	topFavoriteTitle: string;
	leastFavoriteTitle: string;
}

const parseStoredStringArray = (storedValue: string | null): string[] | null => {
	if (!storedValue) {
		return null;
	}

	try {
		const parsedValue = JSON.parse(storedValue);
		if (!Array.isArray(parsedValue)) {
			return null;
		}

		if (!parsedValue.every((value) => typeof value === "string")) {
			return null;
		}

		return parsedValue;
	} catch (error) {
		console.warn("Failed to parse vote session data:", error);
		return null;
	}
};

const getStoredSeenCountCommitState = (): SeenCountCommitState => {
	if (typeof window === "undefined") {
		return {
			committedMovieIds: [],
			committedAt: null,
		};
	}

	const storedState = sessionStorage.getItem(SEEN_COUNT_COMMIT_STATE_STORAGE_KEY);
	if (!storedState) {
		return {
			committedMovieIds: [],
			committedAt: null,
		};
	}

	try {
		const parsedState = JSON.parse(storedState);
		if (typeof parsedState !== "object" || parsedState === null) {
			return {
				committedMovieIds: [],
				committedAt: null,
			};
		}

		const rawMovieIds =
			"committedMovieIds" in parsedState
				? (parsedState as { committedMovieIds?: unknown }).committedMovieIds
				: [];
		const committedMovieIds = Array.isArray(rawMovieIds)
			? rawMovieIds.filter(
					(movieId): movieId is string =>
						typeof movieId === "string" && MASTER_MOVIE_ID_SET.has(movieId)
				)
			: [];
		const rawCommittedAt =
			"committedAt" in parsedState
				? (parsedState as { committedAt?: unknown }).committedAt
				: null;
		const committedAt = typeof rawCommittedAt === "string" ? rawCommittedAt : null;

		return {
			committedMovieIds: [...new Set(committedMovieIds)],
			committedAt,
		};
	} catch (error) {
		console.warn("Failed to parse seen count commit state:", error);
		return {
			committedMovieIds: [],
			committedAt: null,
		};
	}
};

const storeSeenCountCommitState = (state: SeenCountCommitState) => {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.setItem(
		SEEN_COUNT_COMMIT_STATE_STORAGE_KEY,
		JSON.stringify(state)
	);
};

const getStoredSeenMovies = (): Set<string> => {
	if (typeof window === "undefined") {
		return new Set();
	}

	const storedSeenMovies = parseStoredStringArray(
		sessionStorage.getItem(SEEN_MOVIES_STORAGE_KEY)
	);

	if (!storedSeenMovies) {
		return new Set();
	}

	return new Set(
		storedSeenMovies.filter((movieId) => MASTER_MOVIE_ID_SET.has(movieId))
	);
};

const getStoredMarkSeenOrder = (): string[] | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const storedOrder = parseStoredStringArray(
		sessionStorage.getItem(MARK_SEEN_ORDER_STORAGE_KEY)
	);

	if (!storedOrder || storedOrder.length !== MASTER_MOVIE_IDS.length) {
		return null;
	}

	const uniqueStoredIds = new Set(storedOrder);

	if (uniqueStoredIds.size !== MASTER_MOVIE_IDS.length) {
		return null;
	}

	const hasAllMovieIds = MASTER_MOVIE_IDS.every((movieId) =>
		uniqueStoredIds.has(movieId)
	);

	return hasAllMovieIds ? storedOrder : null;
};

const getStoredFavoritesOrder = (): string[] | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const storedOrder = parseStoredStringArray(
		sessionStorage.getItem(FAVORITES_ORDER_STORAGE_KEY)
	);

	if (!storedOrder || storedOrder.length !== MASTER_MOVIE_IDS.length) {
		return null;
	}

	const uniqueStoredIds = new Set(storedOrder);
	if (uniqueStoredIds.size !== MASTER_MOVIE_IDS.length) {
		return null;
	}

	const hasAllMovieIds = MASTER_MOVIE_IDS.every((movieId) =>
		uniqueStoredIds.has(movieId)
	);

	return hasAllMovieIds ? storedOrder : null;
};

const getShuffledMovieIds = (movieIds: string[]): string[] => {
	const shuffled = [...movieIds];
	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const randomIndex = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
	}
	return shuffled;
};

const clearVoteSessionData = () => {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.removeItem(VOTER_NAME_STORAGE_KEY);
	sessionStorage.removeItem(SEEN_MOVIES_STORAGE_KEY);
	sessionStorage.removeItem(MARK_SEEN_ORDER_STORAGE_KEY);
	sessionStorage.removeItem(FAVORITES_ORDER_STORAGE_KEY);
	sessionStorage.removeItem(SEEN_COUNT_COMMIT_STATE_STORAGE_KEY);
};

const getFavoriteSeenMovieIds = (
	favoriteMovies: Set<string>,
	seenMovies: Set<string>,
	movies: Movie[]
) =>
	movies
		.filter((movie) => favoriteMovies.has(movie.id) && seenMovies.has(movie.id))
		.map((movie) => movie.id);

const getBestPictureRanks = (
	favoriteSeenMovieIds: string[],
	rankedMovies: Map<string, number>
): string[] | null => {
	if (favoriteSeenMovieIds.length !== REQUIRED_FAVORITES_COUNT) {
		return null;
	}

	const favoriteSet = new Set(favoriteSeenMovieIds);
	const rankedEntries: Array<{ movieId: string; rank: number }> = [];
	const usedRanks = new Set<number>();

	for (const [movieId, rank] of rankedMovies.entries()) {
		if (!favoriteSet.has(movieId)) {
			continue;
		}

		if (!Number.isInteger(rank) || rank < 1 || rank > REQUIRED_FAVORITES_COUNT) {
			return null;
		}

		if (usedRanks.has(rank)) {
			return null;
		}

		usedRanks.add(rank);
		rankedEntries.push({ movieId, rank });
	}

	if (rankedEntries.length !== REQUIRED_FAVORITES_COUNT) {
		return null;
	}

	const orderedIds = rankedEntries
		.sort((a, b) => a.rank - b.rank)
		.map((entry) => entry.movieId);

	if (new Set(orderedIds).size !== REQUIRED_FAVORITES_COUNT) {
		return null;
	}

	return orderedIds;
};

const buildNormalizedRankMap = (
	movieIds: string[],
	existingRankedMovies: Map<string, number>
): Map<string, number> => {
	const moviesByRank = new Map<number, string>();

	movieIds.forEach((movieId) => {
		const rank = existingRankedMovies.get(movieId);
		if (
			typeof rank === "number" &&
			Number.isInteger(rank) &&
			rank >= 1 &&
			rank <= movieIds.length &&
			!moviesByRank.has(rank)
		) {
			moviesByRank.set(rank, movieId);
		}
	});

	const orderedByRank: string[] = [];
	for (let rank = 1; rank <= movieIds.length; rank += 1) {
		const movieId = moviesByRank.get(rank);
		if (movieId) {
			orderedByRank.push(movieId);
		}
	}

	const fallbackIds = movieIds.filter((movieId) => !orderedByRank.includes(movieId));
	const normalizedMap = new Map<string, number>();
	[...orderedByRank, ...fallbackIds].forEach((movieId, index) => {
		normalizedMap.set(movieId, index + 1);
	});

	return normalizedMap;
};

const SCREEN_WELCOME = 0;
const SCREEN_INTRO_MARK_SEEN = 1;
const SCREEN_MARK_SEEN = 2;
const SCREEN_INTRO_CHOOSE_FAVORITES = 3;
const SCREEN_CHOOSE_FAVORITES = 4;
const SCREEN_INTRO_RANK_FAVORITES = 5;
const SCREEN_RANK_FAVORITES = 6;
const SCREEN_POST_SUBMIT_CONFIRMATION = 7;
const SCREEN_OPTIONAL_RECOMMENDATIONS = 8;
const SCREEN_DONE = 9;

const OPTIONAL_RECOMMENDATION_QUESTIONS: OptionalRecommendationQuestion[] = [
	{
		key: "toParents",
		prompt: "Choose one movie you’d recommend to your parents",
	},
	{
		key: "toKid",
		prompt: "Choose one movie you’d recommend to your 9-year-old niece or nephew",
	},
	{
		key: "underseenGem",
		prompt: "Choose one underseen gem more people should see",
	},
	{
		key: "toFreakiestFriend",
		prompt: "Choose one movie you’d recommend to your freakiest friend",
	},
	{
		key: "leastFavorite",
		prompt: "Choose your least favorite movie",
	},
];

const EMPTY_RECOMMENDATIONS: BallotRecommendations = {
	toParents: null,
	toKid: null,
	underseenGem: null,
	toFreakiestFriend: null,
	leastFavorite: null,
};

const buildOptionalQuestionMovieOrder = (
	seenMovieIds: string[]
): Record<BallotRecommendationKey, string[]> => ({
	toParents: getShuffledMovieIds(seenMovieIds),
	toKid: getShuffledMovieIds(seenMovieIds),
	underseenGem: getShuffledMovieIds(seenMovieIds),
	toFreakiestFriend: getShuffledMovieIds(seenMovieIds),
	leastFavorite: getShuffledMovieIds(seenMovieIds),
});

const Vote = () => {
	const navigate = useNavigate();
	const [screen, setScreen] = useState(SCREEN_WELCOME);
	const [voterName, setVoterName] = useState(() => {
		if (typeof window === "undefined") {
			return "";
		}
		return sessionStorage.getItem(VOTER_NAME_STORAGE_KEY) ?? "";
	});
	const [movies] = useState<Movie[]>(moviesData);
	const [markSeenMovieOrder, setMarkSeenMovieOrder] = useState<string[] | null>(
		() => getStoredMarkSeenOrder()
	);
	const [isLoadingMarkSeenOrder, setIsLoadingMarkSeenOrder] = useState(
		() => markSeenMovieOrder === null
	);
	const [favoritesMovieOrder, setFavoritesMovieOrder] = useState<string[] | null>(
		() => getStoredFavoritesOrder()
	);
	const [seenMovies, setSeenMovies] = useState<Set<string>>(
		() => getStoredSeenMovies()
	);
	const [favoriteMovies, setFavoriteMovies] = useState<Set<string>>(new Set());
	const [rankedMovies, setRankedMovies] = useState<Map<string, number>>(
		new Map()
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [favoritesError, setFavoritesError] = useState<string | null>(null);
	const [rankingError, setRankingError] = useState<string | null>(null);
	const [markSeenCommitError, setMarkSeenCommitError] = useState<string | null>(
		null
	);
	const [isCommittingSeenCounts, setIsCommittingSeenCounts] = useState(false);
	const seenCountCommitInFlightRef = useRef(false);
	const [submittedBallotId, setSubmittedBallotId] = useState<string | null>(null);
	const [recommendations, setRecommendations] =
		useState<BallotRecommendations>(EMPTY_RECOMMENDATIONS);
	const [answeredRecommendationKeys, setAnsweredRecommendationKeys] = useState<
		Set<BallotRecommendationKey>
	>(new Set());
	const [optionalQuestionIndex, setOptionalQuestionIndex] = useState(0);
	const [optionalQuestionMovieOrder, setOptionalQuestionMovieOrder] = useState<
		Record<BallotRecommendationKey, string[]>
	>(() => buildOptionalQuestionMovieOrder([]));
	const [optionalError, setOptionalError] = useState<string | null>(null);
	const [isSavingOptionalAnswer, setIsSavingOptionalAnswer] = useState(false);
	const [ballotSnapshot, setBallotSnapshot] = useState<BallotSnapshot | null>(
		null
	);

	useEffect(() => {
		// Initialize client ID on mount
		getOrCreateClientId();
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		sessionStorage.setItem(VOTER_NAME_STORAGE_KEY, voterName);
	}, [voterName]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		sessionStorage.setItem(
			SEEN_MOVIES_STORAGE_KEY,
			JSON.stringify(Array.from(seenMovies))
		);
	}, [seenMovies]);

	useEffect(() => {
		if (markSeenMovieOrder !== null) {
			setIsLoadingMarkSeenOrder(false);
			return;
		}

		let isCancelled = false;
		setIsLoadingMarkSeenOrder(true);

		const loadMovieOrder = async () => {
			try {
				const firestoreOrder = await getPopularityOrderedMovieIds(movies);
				if (isCancelled) {
					return;
				}

				setMarkSeenMovieOrder(firestoreOrder);
				sessionStorage.setItem(
					MARK_SEEN_ORDER_STORAGE_KEY,
					JSON.stringify(firestoreOrder)
				);
			} catch (fetchError) {
				console.warn(
					"Failed to load Firestore popularity order; using static movie order.",
					fetchError
				);

				if (isCancelled) {
					return;
				}

				const fallbackOrder = movies.map((movie) => movie.id);
				setMarkSeenMovieOrder(fallbackOrder);
				sessionStorage.setItem(
					MARK_SEEN_ORDER_STORAGE_KEY,
					JSON.stringify(fallbackOrder)
				);
			} finally {
				if (!isCancelled) {
					setIsLoadingMarkSeenOrder(false);
				}
			}
		};

		void loadMovieOrder();

		return () => {
			isCancelled = true;
		};
	}, [markSeenMovieOrder, movies]);

	const sessionOrderedMovies = useMemo(() => {
		if (!markSeenMovieOrder) {
			return movies;
		}

		const movieById = new Map(movies.map((movie) => [movie.id, movie]));
		const orderedMovies = markSeenMovieOrder
			.map((movieId) => movieById.get(movieId))
			.filter((movie): movie is Movie => Boolean(movie));

		return orderedMovies.length === movies.length ? orderedMovies : movies;
	}, [markSeenMovieOrder, movies]);

	const sessionOrderedMoviesForFavorites = useMemo(() => {
		if (!favoritesMovieOrder) {
			return movies;
		}

		const movieById = new Map(movies.map((movie) => [movie.id, movie]));
		const orderedMovies = favoritesMovieOrder
			.map((movieId) => movieById.get(movieId))
			.filter((movie): movie is Movie => Boolean(movie));

		return orderedMovies.length === movies.length ? orderedMovies : movies;
	}, [favoritesMovieOrder, movies]);

	const seenMovieOptionsForFavorites = useMemo(
		() =>
			sessionOrderedMoviesForFavorites.filter((movie) => seenMovies.has(movie.id)),
		[sessionOrderedMoviesForFavorites, seenMovies]
	);
	const seenMoviesForOptional = useMemo(
		() => sessionOrderedMovies.filter((movie) => seenMovies.has(movie.id)),
		[sessionOrderedMovies, seenMovies]
	);
	const bestPictureRanksForSubmit = useMemo(() => {
		const favoriteSeenMovieIds = getFavoriteSeenMovieIds(
			favoriteMovies,
			seenMovies,
			sessionOrderedMovies
		);

		return getBestPictureRanks(favoriteSeenMovieIds, rankedMovies);
	}, [favoriteMovies, seenMovies, sessionOrderedMovies, rankedMovies]);
	const currentOptionalQuestion =
		OPTIONAL_RECOMMENDATION_QUESTIONS[optionalQuestionIndex] ?? null;
	const currentOptionalSelection = currentOptionalQuestion
		? recommendations[currentOptionalQuestion.key]
		: null;
	const canContinueOptionalQuestion = Boolean(
		currentOptionalQuestion &&
			(currentOptionalSelection !== null ||
				answeredRecommendationKeys.has(currentOptionalQuestion.key))
	);
	const movieTitleById = useMemo(
		() => new Map(movies.map((movie) => [movie.id, movie.title])),
		[movies]
	);
	const getMovieTitleById = useCallback(
		(movieId: string | null): string => {
			if (!movieId) {
				return "Not selected";
			}

			return movieTitleById.get(movieId) ?? "Unknown title";
		},
		[movieTitleById]
	);
	const ballotSnapshotComparisonText = useMemo(() => {
		if (!ballotSnapshot) {
			return null;
		}

		const difference = ballotSnapshot.seenCount - SEAN_NEW_MOVIES_SEEN_COUNT;
		if (difference === 0) {
			return "That's exactly the same as Sean.";
		}

		return `That's ${Math.abs(difference)} ${
			difference > 0 ? "more" : "less"
		} than Sean.`;
	}, [ballotSnapshot]);
	const ballotSnapshotLeastFavoriteTitle = useMemo(() => {
		if (!ballotSnapshot) {
			return null;
		}

		if (recommendations.leastFavorite) {
			return getMovieTitleById(recommendations.leastFavorite);
		}

		return ballotSnapshot.leastFavoriteTitle;
	}, [ballotSnapshot, getMovieTitleById, recommendations.leastFavorite]);

	const handleMarkSeen = (movieId: string) => {
		setMarkSeenCommitError(null);
		const newSeen = new Set(seenMovies);
		if (newSeen.has(movieId)) {
			newSeen.delete(movieId);
			// Also remove from favorites if it was there
			const newFavorites = new Set(favoriteMovies);
			newFavorites.delete(movieId);
			setFavoriteMovies(newFavorites);
			// Remove from rankings
			const newRanked = new Map(rankedMovies);
			newRanked.delete(movieId);
			setRankedMovies(newRanked);
		} else {
			newSeen.add(movieId);
		}
		setSeenMovies(newSeen);
	};

	const handleToggleFavorite = (movieId: string) => {
		setFavoritesError(null);
		const newFavorites = new Set(favoriteMovies);
		if (newFavorites.has(movieId)) {
			newFavorites.delete(movieId);
			// Remove from rankings
			const newRanked = new Map(rankedMovies);
			newRanked.delete(movieId);
			setRankedMovies(newRanked);
		} else {
			if (newFavorites.size < REQUIRED_FAVORITES_COUNT) {
				newFavorites.add(movieId);
			}
		}
		setFavoriteMovies(newFavorites);
	};

	const handleUpdateRankings = (newRanked: Map<string, number>) => {
		setRankingError(null);
		setError(null);
		setRankedMovies(newRanked);
	};

	const commitSeenCountsIfNeeded = async (): Promise<void> => {
		const commitState = getStoredSeenCountCommitState();
		const alreadyCommittedIds = new Set(commitState.committedMovieIds);
		const currentSeenMovieIds = Array.from(seenMovies).filter((movieId) =>
			MASTER_MOVIE_ID_SET.has(movieId)
		);
		const movieIdsToIncrement = currentSeenMovieIds.filter(
			(movieId) => !alreadyCommittedIds.has(movieId)
		);

		if (movieIdsToIncrement.length > 0) {
			await incrementSeenCounts(movieIdsToIncrement);
		}

		storeSeenCountCommitState({
			committedMovieIds: Array.from(
				new Set([...commitState.committedMovieIds, ...currentSeenMovieIds])
			),
			committedAt: new Date().toISOString(),
		});
	};

	const moveToNextOptionalQuestionOrFinish = () => {
		if (optionalQuestionIndex >= OPTIONAL_RECOMMENDATION_QUESTIONS.length - 1) {
			clearVoteSessionData();
			setScreen(SCREEN_DONE);
			return;
		}

		setOptionalQuestionIndex((previousIndex) =>
			Math.min(
				previousIndex + 1,
				OPTIONAL_RECOMMENDATION_QUESTIONS.length - 1
			)
		);
	};

	const saveOptionalAnswerAndAdvance = async (
		questionKey: BallotRecommendationKey,
		answer: string | null
	) => {
		if (!submittedBallotId) {
			setOptionalError("Couldn't find your ballot. You can finish now.");
			return;
		}

		const isLastQuestion =
			optionalQuestionIndex >= OPTIONAL_RECOMMENDATION_QUESTIONS.length - 1;
		const completedAt = isLastQuestion ? new Date().toISOString() : undefined;
		setIsSavingOptionalAnswer(true);
		setOptionalError(null);

		try {
			await updateBallotRecommendation(
				submittedBallotId,
				questionKey,
				answer,
				completedAt ? { recommendationsCompletedAt: completedAt } : undefined
			);

			setRecommendations((previousAnswers) => ({
				...previousAnswers,
				[questionKey]: answer,
			}));
			setAnsweredRecommendationKeys((previousKeys) => {
				const nextKeys = new Set(previousKeys);
				nextKeys.add(questionKey);
				return nextKeys;
			});

			moveToNextOptionalQuestionOrFinish();
		} catch (saveError) {
			setOptionalError(
				saveError instanceof Error
					? saveError.message
					: "Couldn't save that answer yet. Please try again."
			);
		} finally {
			setIsSavingOptionalAnswer(false);
		}
	};

	const handleStartOptionalRecommendations = () => {
		setOptionalError(null);
		setOptionalQuestionIndex(0);
		setScreen(SCREEN_OPTIONAL_RECOMMENDATIONS);
	};

	const handleSkipOptionalRecommendations = () => {
		clearVoteSessionData();
		setScreen(SCREEN_DONE);
	};

	const handleOptionalBack = () => {
		setOptionalError(null);
		if (optionalQuestionIndex === 0) {
			setScreen(SCREEN_POST_SUBMIT_CONFIRMATION);
			return;
		}

		setOptionalQuestionIndex((previousIndex) => Math.max(0, previousIndex - 1));
	};

	const handleOptionalSelectMovie = (movieId: string) => {
		if (!currentOptionalQuestion) {
			return;
		}

		setOptionalError(null);
		setRecommendations((previousAnswers) => ({
			...previousAnswers,
			[currentOptionalQuestion.key]: movieId,
		}));
	};

	const handleOptionalSkipQuestion = async () => {
		if (!currentOptionalQuestion || isSavingOptionalAnswer) {
			return;
		}

		await saveOptionalAnswerAndAdvance(currentOptionalQuestion.key, null);
	};

	const handleOptionalContinueQuestion = async () => {
		if (!currentOptionalQuestion || isSavingOptionalAnswer) {
			return;
		}

		if (currentOptionalSelection !== null) {
			await saveOptionalAnswerAndAdvance(
				currentOptionalQuestion.key,
				currentOptionalSelection
			);
			return;
		}

		if (answeredRecommendationKeys.has(currentOptionalQuestion.key)) {
			moveToNextOptionalQuestionOrFinish();
		}
	};

	const handleFinishOptionalWithoutSeen = async () => {
		if (!submittedBallotId) {
			clearVoteSessionData();
			setScreen(SCREEN_DONE);
			return;
		}

		setIsSavingOptionalAnswer(true);
		setOptionalError(null);

		try {
			await setBallotRecommendationsCompletedAt(
				submittedBallotId,
				new Date().toISOString()
			);
			clearVoteSessionData();
			setScreen(SCREEN_DONE);
		} catch (saveError) {
			setOptionalError(
				saveError instanceof Error
					? saveError.message
					: "Couldn't finish optional selections yet. Please try again."
			);
		} finally {
			setIsSavingOptionalAnswer(false);
		}
	};

	const handleSubmit = async () => {
		if (!bestPictureRanksForSubmit) {
			setRankingError("Rank your 5 favorites (#1-#5) before submitting.");
			return;
		}

		setSubmitting(true);
		setRankingError(null);
		setError(null);

		try {
			const clientId = getOrCreateClientId();
			const ipHash = hashIP();
			const topFiveSubmittedAt = new Date().toISOString();
			const rankByMovieId = new Map(
				bestPictureRanksForSubmit.map((movieId, index) => [movieId, index + 1])
			);

			// Build ballot movies array
			const ballotMovies: BallotMovie[] = movies.map((movie) => ({
				id: movie.id,
				seen: seenMovies.has(movie.id),
				rank: rankByMovieId.get(movie.id) || null,
			}));

			const ballot: Ballot = {
				schemaVersion: BALLOT_SCHEMA_VERSION,
				clientId,
				timestamp: topFiveSubmittedAt,
				topFiveSubmittedAt,
				ipHash,
				voterName: voterName.trim(),
				movies: ballotMovies,
				bestPictureRanks: bestPictureRanksForSubmit,
				flagged: false,
				recommendations: EMPTY_RECOMMENDATIONS,
				recommendationsCompletedAt: null,
			};

			const submitResult = await submitBallot(ballot);
			if (!submitResult.id) {
				throw new Error("Ballot was submitted but no ID was returned.");
			}

			const seenCount = ballotMovies.filter((movie) => movie.seen).length;
			const topFavoriteMovieId = bestPictureRanksForSubmit[0] ?? null;
			const leastFavoriteMovieId =
				bestPictureRanksForSubmit[bestPictureRanksForSubmit.length - 1] ?? null;
			setBallotSnapshot({
				seenCount,
				topFavoriteTitle: getMovieTitleById(topFavoriteMovieId),
				leastFavoriteTitle: getMovieTitleById(leastFavoriteMovieId),
			});
			setSubmittedBallotId(submitResult.id);
			setRecommendations(EMPTY_RECOMMENDATIONS);
			setAnsweredRecommendationKeys(new Set());
			setOptionalQuestionIndex(0);
			setOptionalQuestionMovieOrder(
				buildOptionalQuestionMovieOrder(
					sessionOrderedMovies
						.filter((movie) => seenMovies.has(movie.id))
						.map((movie) => movie.id)
				)
			);
			setOptionalError(null);
			setScreen(SCREEN_POST_SUBMIT_CONFIRMATION);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit ballot");
		} finally {
			setSubmitting(false);
		}
	};

	const handleNext = async () => {
		if (screen === SCREEN_WELCOME) {
			if (voterName.trim().length > 0) {
				setScreen(SCREEN_INTRO_MARK_SEEN);
			}
		} else if (screen === SCREEN_INTRO_MARK_SEEN) {
			setScreen(SCREEN_MARK_SEEN);
		} else if (screen === SCREEN_MARK_SEEN) {
			if (seenCountCommitInFlightRef.current || isCommittingSeenCounts) {
				return;
			}

			setMarkSeenCommitError(null);
			seenCountCommitInFlightRef.current = true;
			setIsCommittingSeenCounts(true);
			try {
				await commitSeenCountsIfNeeded();
			} catch (commitError) {
				console.error("Failed to commit seen counts on Mark Seen exit:", commitError);
				setMarkSeenCommitError(
					"Couldn't sync seen counts yet. Check your connection and tap Next again."
				);
				return;
			} finally {
				seenCountCommitInFlightRef.current = false;
				setIsCommittingSeenCounts(false);
			}

			setFavoritesError(null);
			setScreen(SCREEN_INTRO_CHOOSE_FAVORITES);
		} else if (screen === SCREEN_INTRO_CHOOSE_FAVORITES) {
			if (favoritesMovieOrder === null) {
				const shuffledOrder = getShuffledMovieIds(MASTER_MOVIE_IDS);
				setFavoritesMovieOrder(shuffledOrder);
				if (typeof window !== "undefined") {
					sessionStorage.setItem(
						FAVORITES_ORDER_STORAGE_KEY,
						JSON.stringify(shuffledOrder)
					);
				}
			}

			setScreen(SCREEN_CHOOSE_FAVORITES);
		} else if (screen === SCREEN_CHOOSE_FAVORITES) {
			if (seenMovieOptionsForFavorites.length < REQUIRED_FAVORITES_COUNT) {
				setFavoritesError(
					`You need at least ${REQUIRED_FAVORITES_COUNT} seen movies before choosing favorites.`
				);
				return;
			}

			if (favoriteMovies.size === REQUIRED_FAVORITES_COUNT) {
				const favoriteSeenMovieIds = getFavoriteSeenMovieIds(
					favoriteMovies,
					seenMovies,
					seenMovieOptionsForFavorites
				);
				setRankedMovies(buildNormalizedRankMap(favoriteSeenMovieIds, rankedMovies));
				setFavoritesError(null);
				setScreen(SCREEN_INTRO_RANK_FAVORITES);
				return;
			}

			setFavoritesError(`Pick exactly ${REQUIRED_FAVORITES_COUNT} favorites to continue.`);
		} else if (screen === SCREEN_INTRO_RANK_FAVORITES) {
			setRankingError(null);
			setScreen(SCREEN_RANK_FAVORITES);
		} else if (screen === SCREEN_RANK_FAVORITES) {
			void handleSubmit();
		}
	};

	const handleBack = () => {
		if (screen > 0) {
			setScreen(screen - 1);
		}
	};

	return (
		<div className="vote-container">
			{screen === SCREEN_WELCOME && (
				<Welcome
					voterName={voterName}
					onNameChange={setVoterName}
					onStart={() => {
						void handleNext();
					}}
				/>
			)}
			{screen === SCREEN_INTRO_MARK_SEEN && (
				<StepMessage
					title="Let's Start"
					message="First, you'll pick all the movies you've seen in the last year."
					onNext={() => {
						void handleNext();
					}}
					nextLabel="Let's do it"
				/>
			)}
			{screen === SCREEN_MARK_SEEN && (
				<MarkSeen
					movies={sessionOrderedMovies}
					seenMovies={seenMovies}
					onMarkSeen={handleMarkSeen}
					onNext={() => {
						void handleNext();
					}}
					onBack={handleBack}
					isLoadingOrder={isLoadingMarkSeenOrder}
					isCommittingSeenCounts={isCommittingSeenCounts}
					error={markSeenCommitError}
				/>
			)}
			{screen === SCREEN_INTRO_CHOOSE_FAVORITES && (
				<StepMessage
					title="Nice work"
					message="Great, next, you'll pick your five favorite films out of the ones you've seen."
					onNext={() => {
						void handleNext();
					}}
					onBack={handleBack}
					nextLabel="Next"
				/>
			)}
			{screen === SCREEN_CHOOSE_FAVORITES && (
				<ChooseFavorites
					movies={seenMovieOptionsForFavorites}
					favoriteMovies={favoriteMovies}
					onToggleFavorite={handleToggleFavorite}
					onNext={() => {
						void handleNext();
					}}
					onBack={handleBack}
					error={favoritesError}
					requiredCount={REQUIRED_FAVORITES_COUNT}
				/>
			)}
			{screen === SCREEN_INTRO_RANK_FAVORITES && (
				<StepMessage
					title="Almost done"
					message="Great, now let's rank those five films so you can submit your ballot."
					onNext={() => {
						void handleNext();
					}}
					onBack={handleBack}
					nextLabel="Start ranking"
				/>
			)}
			{screen === SCREEN_RANK_FAVORITES && (
				<RankFavorites
					movies={sessionOrderedMovies.filter((movie) =>
						favoriteMovies.has(movie.id)
					)}
					rankedMovies={rankedMovies}
					onUpdateRankings={handleUpdateRankings}
					onNext={() => {
						void handleNext();
					}}
					onBack={handleBack}
					error={rankingError ?? error}
					requiredCount={REQUIRED_FAVORITES_COUNT}
					submitting={submitting}
				/>
			)}
			{screen === SCREEN_POST_SUBMIT_CONFIRMATION && (
				<div className="vote-success post-submit-confirmation">
					<h1>Your top five have been submitted!</h1>
					<p>
						Anything below is optional. You can finish now, or answer a few
						quick recommendation questions.
					</p>
					{ballotSnapshot && ballotSnapshotComparisonText && (
						<div className="ballot-snapshot-card">
							<h2>Your Ballot Snapshot</h2>
							<ul>
								<li>You saw {ballotSnapshot.seenCount} new movies in 2025.</li>
								<li>{ballotSnapshotComparisonText}</li>
								<li>Your number one favorite was {ballotSnapshot.topFavoriteTitle}.</li>
								{ballotSnapshotLeastFavoriteTitle && (
									<li>Your least favorite was {ballotSnapshotLeastFavoriteTitle}.</li>
								)}
							</ul>
						</div>
					)}
					<div className="post-submit-actions">
						<button
							type="button"
							className="btn btn-primary"
							onClick={handleStartOptionalRecommendations}
						>
							Continue for a few more optional selections
						</button>
						<button
							type="button"
							className="btn-link"
							onClick={handleSkipOptionalRecommendations}
						>
							No thanks
						</button>
					</div>
				</div>
			)}
			{screen === SCREEN_OPTIONAL_RECOMMENDATIONS && currentOptionalQuestion && (
				<OptionalRecommendations
					questions={OPTIONAL_RECOMMENDATION_QUESTIONS}
					currentQuestionIndex={optionalQuestionIndex}
					seenMovies={seenMoviesForOptional}
					currentQuestionMovieOrder={
						optionalQuestionMovieOrder[currentOptionalQuestion.key] ?? []
					}
					selectedMovieId={currentOptionalSelection}
					canContinue={canContinueOptionalQuestion}
					isSaving={isSavingOptionalAnswer}
					error={optionalError}
					onSelectMovie={handleOptionalSelectMovie}
					onBack={handleOptionalBack}
					onSkip={() => {
						void handleOptionalSkipQuestion();
					}}
					onContinue={() => {
						void handleOptionalContinueQuestion();
					}}
					onFinishWithoutSeen={() => {
						void handleFinishOptionalWithoutSeen();
					}}
				/>
			)}
			{screen === SCREEN_DONE && (
				<div className="vote-success">
					<h1>Thank you!</h1>
					<p>Your ballot has been submitted.</p>
					{ballotSnapshot && ballotSnapshotComparisonText && (
						<div className="ballot-snapshot-card">
							<h2>Your Ballot Snapshot</h2>
							<ul>
								<li>You saw {ballotSnapshot.seenCount} new movies in 2025.</li>
								<li>{ballotSnapshotComparisonText}</li>
								<li>Your number one favorite was {ballotSnapshot.topFavoriteTitle}.</li>
								{ballotSnapshotLeastFavoriteTitle && (
									<li>Your least favorite was {ballotSnapshotLeastFavoriteTitle}.</li>
								)}
							</ul>
						</div>
					)}
					<button onClick={() => navigate("/")} className="btn btn-primary">
						Return to Home
					</button>
				</div>
			)}
		</div>
	);
};

export default Vote;
