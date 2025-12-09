import { db } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  calculateBordaScores,
  calculateUnderSeenAwards,
  calculateFunCategories,
  type MovieStats as BestPictureResult,
  type UnderSeenResult,
  type FunCategories
} from '../utils/scoring';

// Re-export types for compatibility
export type { BestPictureResult, UnderSeenResult, FunCategories };

export interface Ballot {
  id: string;
  clientId: string;
  timestamp: string;
  ipHash?: string;
  movies: Array<{
    id: string;
    seen: boolean;
    wantToSee?: boolean;
    rank?: number | null;
    underSeenRec?: boolean;
    favoriteScary?: boolean;
    funniest?: boolean;
    bestTimeAtMovies?: boolean;
    title?: string;
  }>;
  flagged?: boolean;
}

export interface Overview {
  totalBallots: number;
  uniqueClientIds: number;
  possibleDuplicates: number;
  mostRecentSubmission: string | null;
}

// Client-side "password" check
const ADMIN_PASSWORD = 'HOST';

export async function adminLogin(password: string): Promise<string | null> {
  // Simulating authentication by just checking the hardcoded password
  console.log('Attempting login with:', password);
  if (password.trim().toUpperCase() === ADMIN_PASSWORD) {
    // Return a dummy token since we don't have a backend to issue JWTs
    return 'client-side-admin-token';
  }
  return null;
}

export async function getAllBallots(): Promise<Ballot[]> {
  try {
    const q = query(collection(db, 'ballots'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Ballot));
  } catch (error) {
    console.error('Error getting ballots:', error);
    throw error;
  }
}

export async function getBestPictureResults(): Promise<BestPictureResult[]> {
  try {
    const ballots = await getAllBallots();
    return calculateBordaScores(ballots);
  } catch (error) {
    console.error('Error calculating best picture results:', error);
    throw error;
  }
}

export async function getOverview(): Promise<Overview> {
  try {
    const ballots = await getAllBallots();

    const uniqueClientIds = new Set(ballots.map(b => b.clientId));
    // Simple logic for flagged: if ipHash matches another ballot from different client ID? 
    // Or just rely on what's in the DB if we had server-side logic before.
    // For now, let's just count explicitly flagged ones if existing, or simple check.
    const flaggedCount = ballots.filter(b => b.flagged).length;
    const mostRecent = ballots.length > 0 ? ballots[0].timestamp : null;

    return {
      totalBallots: ballots.length,
      uniqueClientIds: uniqueClientIds.size,
      possibleDuplicates: flaggedCount,
      mostRecentSubmission: mostRecent
    };
  } catch (error) {
    console.error('Error getting overview:', error);
    throw error;
  }
}

export async function getUnderSeenResults(): Promise<UnderSeenResult[]> {
  try {
    const ballots = await getAllBallots();
    return calculateUnderSeenAwards(ballots);
  } catch (error) {
    console.error('Error calculating under-seen results:', error);
    throw error;
  }
}

export async function getFunCategories(): Promise<FunCategories> {
  try {
    const ballots = await getAllBallots();
    return calculateFunCategories(ballots);
  } catch (error) {
    console.error('Error calculating fun categories:', error);
    throw error;
  }
}


