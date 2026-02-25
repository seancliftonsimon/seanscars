import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Welcome from "./Welcome";
import MarkSeen from "./MarkSeen";
import ChooseFavorites from "./ChooseFavorites";
import RankFavorites from "./RankFavorites";
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

const Vote = () => {
	const navigate = useNavigate();
	const [screen, setScreen] = useState(0);
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
			setScreen(4); // Success screen
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit ballot");
		} finally {
			setSubmitting(false);
		}
	};

	const handleNext = () => {
		if (screen === 0) {
			if (voterName.trim().length > 0) {
				setScreen(1);
			}
		} else if (screen === 1) {
			if (seenMovies.size > 0) {
				setScreen(2);
			}
		} else if (screen === 2) {
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
				setScreen(3);
				return;
			}

			setFavoritesError(`Pick exactly ${REQUIRED_FAVORITES_COUNT} favorites to continue.`);
		} else if (screen === 3) {
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
			{screen === 0 && (
				<Welcome
					voterName={voterName}
					onNameChange={setVoterName}
					onStart={handleNext}
				/>
			)}
			{screen === 1 && (
				<MarkSeen
					movies={sessionOrderedMovies}
					seenMovies={seenMovies}
					onMarkSeen={handleMarkSeen}
					onNext={handleNext}
					onBack={handleBack}
					isLoadingOrder={isLoadingMarkSeenOrder}
				/>
			)}
			{screen === 2 && (
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
			{screen === 3 && (
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
			{screen === 4 && (
				<div className="vote-success">
					<h1>Thank You!</h1>
					<p>Your vote has been submitted successfully.</p>
					<button onClick={() => navigate("/")} className="btn btn-primary">
						Return to Home
					</button>
				</div>
			)}
		</div>
	);
};

export default Vote;
