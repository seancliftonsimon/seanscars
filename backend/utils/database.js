import admin from "firebase-admin";
import { getDb } from "./firebase.js";
import {
	calculateBordaScores,
	calculateUnderSeenAwards,
	calculateFunCategories,
} from "./scoring.js";

const BALLOTS_COLLECTION = "ballots";
const MOVIES_COLLECTION = "movies";

export async function submitBallot(ballotData) {
	const db = getDb();

	// Validate required fields
	if (!ballotData.clientId || !ballotData.timestamp || !ballotData.movies) {
		throw new Error("Invalid ballot data");
	}

	// Add ballot to Firestore
	const docRef = await db.collection(BALLOTS_COLLECTION).add({
		...ballotData,
		submittedAt: admin.firestore.FieldValue.serverTimestamp(),
	});

	return { id: docRef.id };
}

export async function getAllBallots() {
	const db = getDb();
	const snapshot = await db
		.collection(BALLOTS_COLLECTION)
		.orderBy("timestamp", "desc")
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	}));
}

export async function getBestPictureResults() {
	const ballots = await getAllBallots();
	// Load movie titles from ballots or use IDs
	const results = calculateBordaScores(ballots);
	return results;
}

export async function getOverview() {
	const ballots = await getAllBallots();

	const uniqueClientIds = new Set(ballots.map((b) => b.clientId));
	const flaggedCount = ballots.filter((b) => b.flagged).length;
	const mostRecent = ballots.length > 0 ? ballots[0].timestamp : null;

	return {
		totalBallots: ballots.length,
		uniqueClientIds: uniqueClientIds.size,
		possibleDuplicates: flaggedCount,
		mostRecentSubmission: mostRecent,
	};
}

export async function getUnderSeenResults() {
	const ballots = await getAllBallots();
	return calculateUnderSeenAwards(ballots);
}

export async function getFunCategories() {
	const ballots = await getAllBallots();
	return calculateFunCategories(ballots);
}
