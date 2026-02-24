import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Welcome from "./Welcome";
import MarkSeen from "./MarkSeen";
import ChooseFavorites from "./ChooseFavorites";
import RankFavorites from "./RankFavorites";
import ExtraQuestions from "./ExtraQuestions";
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
	const [extraQuestions, setExtraQuestions] = useState<{
		underSeenRec?: string;
		favoriteScary?: string;
		funniest?: string;
		bestTimeAtMovies?: string;
	}>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
		const newFavorites = new Set(favoriteMovies);
		if (newFavorites.has(movieId)) {
			newFavorites.delete(movieId);
			// Remove from rankings
			const newRanked = new Map(rankedMovies);
			newRanked.delete(movieId);
			setRankedMovies(newRanked);
		} else {
			if (newFavorites.size < 5) {
				newFavorites.add(movieId);
			}
		}
		setFavoriteMovies(newFavorites);
	};

	const handleRankChange = (movieId: string, rank: number | null) => {
		const newRanked = new Map(rankedMovies);

		// Remove any existing rank for this movie
		newRanked.delete(movieId);

		// Remove the rank from any other movie that had it
		if (rank !== null) {
			for (const [id, currentRank] of newRanked.entries()) {
				if (currentRank === rank) {
					newRanked.delete(id);
					break;
				}
			}
			newRanked.set(movieId, rank);
		}

		setRankedMovies(newRanked);
	};

	const handleUpdateRankings = (newRanked: Map<string, number>) => {
		setRankedMovies(newRanked);
	};

	const handleSubmit = async () => {
		setSubmitting(true);
		setError(null);

		try {
			const clientId = getOrCreateClientId();
			const ipHash = hashIP();

			// Build ballot movies array
			const ballotMovies: BallotMovie[] = movies.map((movie) => ({
				id: movie.id,
				seen: seenMovies.has(movie.id),
				rank: rankedMovies.get(movie.id) || null,
				underSeenRec: extraQuestions.underSeenRec === movie.id,
				favoriteScary: extraQuestions.favoriteScary === movie.id,
				funniest: extraQuestions.funniest === movie.id,
				bestTimeAtMovies: extraQuestions.bestTimeAtMovies === movie.id,
			}));

			const ballot: Ballot = {
				schemaVersion: BALLOT_SCHEMA_VERSION,
				clientId,
				timestamp: new Date().toISOString(),
				ipHash,
				voterName: voterName.trim(),
				movies: ballotMovies,
				flagged: false,
			};

			await submitBallot(ballot);

			try {
				await incrementSeenCounts(Array.from(seenMovies));
			} catch (seenCountError) {
				console.warn("Ballot submitted, but seenCount update failed:", seenCountError);
			}

			clearVoteSessionData();
			setScreen(5); // Success screen
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
			if (favoriteMovies.size > 0 && favoriteMovies.size <= 5) {
				setScreen(3);
			}
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
					movies={sessionOrderedMovies.filter((movie) => seenMovies.has(movie.id))}
					favoriteMovies={favoriteMovies}
					onToggleFavorite={handleToggleFavorite}
					onNext={handleNext}
					onBack={handleBack}
				/>
			)}
			{screen === 3 && (
				<RankFavorites
					movies={sessionOrderedMovies.filter((movie) =>
						favoriteMovies.has(movie.id)
					)}
					rankedMovies={rankedMovies}
					onRankChange={handleRankChange}
					onUpdateRankings={handleUpdateRankings}
					onNext={() => setScreen(4)}
					onBack={handleBack}
				/>
			)}
			{screen === 4 && (
				<ExtraQuestions
					movies={sessionOrderedMovies.filter((movie) => seenMovies.has(movie.id))}
					extraQuestions={extraQuestions}
					onExtraQuestionChange={(question, movieId) => {
						setExtraQuestions((prev) => ({ ...prev, [question]: movieId }));
					}}
					onSubmit={handleSubmit}
					onBack={handleBack}
					submitting={submitting}
					error={error}
				/>
			)}
			{screen === 5 && (
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
