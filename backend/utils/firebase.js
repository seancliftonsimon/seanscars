import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let db = null;

export async function initializeFirebase() {
	if (db) {
		return db;
	}

	try {
		const serviceAccount = {
			projectId: process.env.FIREBASE_PROJECT_ID,
			clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
			privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
		};

		if (
			!serviceAccount.projectId ||
			!serviceAccount.clientEmail ||
			!serviceAccount.privateKey
		) {
			throw new Error("Missing Firebase credentials in environment variables");
		}

		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});

		db = admin.firestore();
		console.log("Firebase initialized successfully");
		return db;
	} catch (error) {
		console.error("Firebase initialization error:", error);
		throw error;
	}
}

export function getDb() {
	if (!db) {
		throw new Error(
			"Firebase not initialized. Call initializeFirebase() first."
		);
	}
	return db;
}
