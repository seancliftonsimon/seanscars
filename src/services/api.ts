import { db } from './firebase';
import { collection, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import moviesData from '../data/movies.json';

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
  clientId: string;
  timestamp: string;
  ipHash?: string;
  movies: BallotMovie[];
  flagged?: boolean;
}

export async function submitBallot(ballotData: Ballot): Promise<{ success: boolean; id?: string }> {
  try {
    const docRef = await addDoc(collection(db, 'ballots'), ballotData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Ballot submission error:', error);
    throw error;
  }
}

// Simple IP hash (client-side, best effort)
export function hashIP(): string {
  // In a real scenario, this would be done server-side
  // For now, return a placeholder that will be processed server-side
  return 'client-side-hash';
}

export async function seedRandomBallots(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const movies = moviesData.map(m => {
      const isSeen = Math.random() > 0.7; // 30% chance to have seen a movie
      return {
        id: m.id,
        title: m.title, // Include title for reference
        seen: isSeen,
        wantToSee: !isSeen && Math.random() > 0.5,
        rank: isSeen && Math.random() > 0.5 ? Math.floor(Math.random() * 10) + 1 : undefined,
        underSeenRec: isSeen && Math.random() > 0.9,
        favoriteScary: isSeen && Math.random() > 0.95,
        funniest: isSeen && Math.random() > 0.95,
        bestTimeAtMovies: isSeen && Math.random() > 0.95
      };
    });

    // Ensure at least one ranking if possible
    const seenMovies = movies.filter(m => m.seen);
    if (seenMovies.length > 0) {
      // Randomly rank some of them 1-10
      const shuffled = [...seenMovies].sort(() => 0.5 - Math.random());
      shuffled.slice(0, Math.min(10, seenMovies.length)).forEach((m, index) => {
        m.rank = index + 1;
      });
    }

    const ballot: Ballot = {
      clientId: `test-client-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      ipHash: `test-ip-${Math.random()}`,
      movies: movies
    };

    await addDoc(collection(db, 'ballots'), ballot);
  }
}

export async function clearAllBallots(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'ballots'));
  const BATCH_SIZE = 500;

  let batch = writeBatch(db);
  let count = 0;

  for (const docSnapshot of snapshot.docs) {
    batch.delete(docSnapshot.ref);
    count++;

    if (count >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

