import { db } from "./firebase";
import {
	addDoc,
	collection,
	doc,
	getDocs,
	increment,
	orderBy,
	query,
	writeBatch,
} from "firebase/firestore";

export interface Movie {
	id: string;
	title: string;
}

export interface BallotMovie {
	id: string;
	seen: boolean;
	wantToSee?: boolean;
	rank?: number | null;
	underSeenRec?: boolean;
	favoriteScary?: boolean;
	funniest?: boolean;
	bestTimeAtMovies?: boolean;
	title?: string; // Optional, for reference
}

export interface Ballot {
	schemaVersion?: number;
	clientId: string;
	timestamp: string;
	ipHash?: string;
	voterName?: string;
	movies: BallotMovie[];
	flagged?: boolean;
}

export const BALLOT_SCHEMA_VERSION = 1;
const MOVIE_POPULARITY_COLLECTION = "moviePopularity";

export async function submitBallot(
	ballotData: Ballot
): Promise<{ success: boolean; id?: string }> {
	try {
		const docRef = await addDoc(collection(db, "ballots"), ballotData);
		return { success: true, id: docRef.id };
	} catch (error) {
		console.error("Ballot submission error:", error);
		throw error;
	}
}

export async function getPopularityOrderedMovieIds(
	movies: Array<Pick<Movie, "id">>
): Promise<string[]> {
	const defaultOrder = movies.map((movie) => movie.id);
	const originalIndexById = new Map(
		defaultOrder.map((movieId, index) => [movieId, index])
	);
	const seenCountById = new Map<string, number>();

	const popularityQuery = query(
		collection(db, MOVIE_POPULARITY_COLLECTION),
		orderBy("seenCount", "desc")
	);
	const popularitySnapshot = await getDocs(popularityQuery);

	popularitySnapshot.forEach((movieDoc) => {
		const movieId = movieDoc.id;

		if (!originalIndexById.has(movieId)) {
			return;
		}

		const rawSeenCount = movieDoc.data().seenCount;
		const seenCount =
			typeof rawSeenCount === "number" && Number.isFinite(rawSeenCount)
				? rawSeenCount
				: 0;

		seenCountById.set(movieId, seenCount);
	});

	return [...defaultOrder].sort((movieIdA, movieIdB) => {
		const seenCountDifference =
			(seenCountById.get(movieIdB) ?? 0) - (seenCountById.get(movieIdA) ?? 0);

		if (seenCountDifference !== 0) {
			return seenCountDifference;
		}

		return (originalIndexById.get(movieIdA) ?? 0) - (originalIndexById.get(movieIdB) ?? 0);
	});
}

export async function incrementSeenCounts(movieIds: string[]): Promise<void> {
	if (movieIds.length === 0) {
		return;
	}

	const uniqueMovieIds = [...new Set(movieIds)];
	const batch = writeBatch(db);

	uniqueMovieIds.forEach((movieId) => {
		const movieRef = doc(db, MOVIE_POPULARITY_COLLECTION, movieId);
		batch.set(movieRef, { seenCount: increment(1) }, { merge: true });
	});

	await batch.commit();
}

// Simple IP hash (client-side, best effort)
export function hashIP(): string {
	// In a real scenario, this would be done server-side
	// For now, return a placeholder that will be processed server-side
	return "client-side-hash";
}
