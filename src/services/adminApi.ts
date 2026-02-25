import { db } from "./firebase";
import {
	collection,
	doc,
	getDocs,
	orderBy,
	query,
	updateDoc,
} from "firebase/firestore";
import {
	calculateBordaScores,
	calculateWeightedScores,
	type MovieStats as BestPictureResult,
	type WeightedMovieStats,
} from "../utils/scoring";

// Re-export types for compatibility
export type {
	BestPictureResult,
	WeightedMovieStats,
};

export interface LeaderboardEntry {
	clientId: string;
	voterName: string;
	moviesSeen: number;
	timestamp: string;
}

export interface Ballot {
	id: string;
	clientId: string;
	timestamp: string;
	ipHash?: string;
	voterName?: string;
	movies: Array<{
		id: string;
		seen: boolean;
		rank?: number | null;
		title?: string;
	}>;
	bestPictureRanks?: string[];
	flagged?: boolean;
}

export interface Overview {
	includedBallots: number;
	excludedBallots: number;
	uniqueClientIds: number;
	mostRecentSubmission: string | null;
}

export function isIncludedInAnalysis(ballot: Pick<Ballot, "flagged">): boolean {
	return ballot.flagged !== true;
}

export async function updateBallotFlagged(
	ballotId: string,
	flagged: boolean
): Promise<void> {
	try {
		await updateDoc(doc(db, "ballots", ballotId), { flagged });
	} catch (error) {
		console.error("Error updating ballot flag:", error);
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "permission-denied"
		) {
			throw new Error(
				"Firestore denied ballot updates. Update Firestore Rules to allow admin access to ballots."
			);
		}
		throw error;
	}
}

async function getIncludedBallots(): Promise<Ballot[]> {
	const ballots = await getAllBallots();
	return ballots.filter(isIncludedInAnalysis);
}

export async function getAllBallots(): Promise<Ballot[]> {
	try {
		const q = query(collection(db, "ballots"), orderBy("timestamp", "desc"));
		const querySnapshot = await getDocs(q);

		return querySnapshot.docs.map(
			(doc) =>
				({
					id: doc.id,
					...doc.data(),
				} as Ballot)
		);
	} catch (error) {
		console.error("Error getting ballots:", error);
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "permission-denied"
		) {
			throw new Error(
				"Firestore denied ballot reads. Update Firestore Rules to allow admin access to ballots."
			);
		}
		throw error;
	}
}

export async function getBestPictureResults(): Promise<BestPictureResult[]> {
	try {
		const ballots = await getIncludedBallots();
		return calculateBordaScores(ballots);
	} catch (error) {
		console.error("Error calculating best picture results:", error);
		throw error;
	}
}

export async function getWeightedResults(): Promise<WeightedMovieStats[]> {
	try {
		const ballots = await getIncludedBallots();
		return calculateWeightedScores(ballots);
	} catch (error) {
		console.error("Error calculating weighted results:", error);
		throw error;
	}
}

export async function getOverview(): Promise<Overview> {
	try {
		const ballots = await getAllBallots();
		const includedBallots = ballots.filter(isIncludedInAnalysis);
		const excludedBallots = ballots.length - includedBallots.length;

		const uniqueClientIds = new Set(includedBallots.map((b) => b.clientId));
		const mostRecent =
			includedBallots.length > 0 ? includedBallots[0].timestamp : null;

		return {
			includedBallots: includedBallots.length,
			excludedBallots,
			uniqueClientIds: uniqueClientIds.size,
			mostRecentSubmission: mostRecent,
		};
	} catch (error) {
		console.error("Error getting overview:", error);
		throw error;
	}
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
	try {
		const ballots = await getIncludedBallots();

		const leaderboard: LeaderboardEntry[] = ballots.map((ballot) => {
			const moviesSeen = ballot.movies.filter((m) => m.seen).length;

			return {
				clientId: ballot.clientId,
				voterName: ballot.voterName || "Anonymous",
				moviesSeen,
				timestamp: ballot.timestamp,
			};
		});

		// Sort by movies seen (descending), then by timestamp (ascending for earliest)
		return leaderboard.sort((a, b) => {
			if (b.moviesSeen !== a.moviesSeen) {
				return b.moviesSeen - a.moviesSeen;
			}
			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});
	} catch (error) {
		console.error("Error getting leaderboard:", error);
		throw error;
	}
}
