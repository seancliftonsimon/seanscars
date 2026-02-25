import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Welcome from "./Welcome";
import MarkSeen from "./MarkSeen";
import ChooseFavorites from "./ChooseFavorites";
import RankFavorites from "./RankFavorites";
import StepMessage from "./StepMessage";
import moviesData from "../../data/movies.json";
import { getOrCreateClientId } from "../../utils/voting";
import {
	BALLOT_SCHEMA_VERSION,
	getPopularityOrderedMovieIds,
	hashIP,
	incrementSeenCounts,
	submitBallot,
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
const REQUIRED_FAVORITES_COUNT = 5;
const MASTER_MOVIE_IDS = moviesData.map((movie) => movie.id);
const MASTER_MOVIE_ID_SET = new Set(MASTER_MOVIE_IDS);

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

const clearVoteSessionData = () => {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.removeItem(VOTER_NAME_STORAGE_KEY);
	sessionStorage.removeItem(SEEN_MOVIES_STORAGE_KEY);
	sessionStorage.removeItem(MARK_SEEN_ORDER_STORAGE_KEY);
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
const SCREEN_SUCCESS = 7;

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

	const seenMovieOptionsForFavorites = useMemo(
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

	const handleMarkSeen = (movieId: string) => {
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
				timestamp: new Date().toISOString(),
				ipHash,
				voterName: voterName.trim(),
				movies: ballotMovies,
				bestPictureRanks: bestPictureRanksForSubmit,
				flagged: false,
			};

			await submitBallot(ballot);

			try {
				await incrementSeenCounts(Array.from(seenMovies));
			} catch (seenCountError) {
				console.warn("Ballot submitted, but seenCount update failed:", seenCountError);
			}

			clearVoteSessionData();
			setScreen(SCREEN_SUCCESS);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit ballot");
		} finally {
			setSubmitting(false);
		}
	};

	const handleNext = () => {
		if (screen === SCREEN_WELCOME) {
			if (voterName.trim().length > 0) {
				setScreen(SCREEN_INTRO_MARK_SEEN);
			}
		} else if (screen === SCREEN_INTRO_MARK_SEEN) {
			setScreen(SCREEN_MARK_SEEN);
		} else if (screen === SCREEN_MARK_SEEN) {
			setFavoritesError(null);
			setScreen(SCREEN_INTRO_CHOOSE_FAVORITES);
		} else if (screen === SCREEN_INTRO_CHOOSE_FAVORITES) {
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
					sessionOrderedMovies
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
					onStart={handleNext}
				/>
			)}
			{screen === SCREEN_INTRO_MARK_SEEN && (
				<StepMessage
					title="First up"
					message="First, you'll pick all the movies you've seen in the last year."
					onNext={handleNext}
					onBack={handleBack}
					nextLabel="Let's do it"
				/>
			)}
			{screen === SCREEN_MARK_SEEN && (
				<MarkSeen
					movies={sessionOrderedMovies}
					seenMovies={seenMovies}
					onMarkSeen={handleMarkSeen}
					onNext={handleNext}
					onBack={handleBack}
					isLoadingOrder={isLoadingMarkSeenOrder}
				/>
			)}
			{screen === SCREEN_INTRO_CHOOSE_FAVORITES && (
				<StepMessage
					title="Nice work"
					message="Great, next, you'll pick your five favorite films out of the ones you've seen."
					onNext={handleNext}
					onBack={handleBack}
					nextLabel="Next"
				/>
			)}
			{screen === SCREEN_CHOOSE_FAVORITES && (
				<ChooseFavorites
					movies={seenMovieOptionsForFavorites}
					favoriteMovies={favoriteMovies}
					onToggleFavorite={handleToggleFavorite}
					onNext={handleNext}
					onBack={handleBack}
					error={favoritesError}
					requiredCount={REQUIRED_FAVORITES_COUNT}
				/>
			)}
			{screen === SCREEN_INTRO_RANK_FAVORITES && (
				<StepMessage
					title="Almost done"
					message="Great, now let's rank those five films so you can submit your ballot."
					onNext={handleNext}
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
					onNext={handleNext}
					onBack={handleBack}
					error={rankingError ?? error}
					requiredCount={REQUIRED_FAVORITES_COUNT}
					submitting={submitting}
				/>
			)}
			{screen === SCREEN_SUCCESS && (
				<div className="vote-success">
					<h1>All set</h1>
					<p>Great, your ranking has been submitted.</p>
					<button onClick={() => navigate("/")} className="btn btn-primary">
						Return to Home
					</button>
				</div>
			)}
		</div>
	);
};

export default Vote;
