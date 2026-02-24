import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

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

// Simple IP hash (client-side, best effort)
export function hashIP(): string {
	// In a real scenario, this would be done server-side
	// For now, return a placeholder that will be processed server-side
	return "client-side-hash";
}
