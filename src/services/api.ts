// API client for voting system

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    const response = await fetch(`${API_BASE_URL}/ballots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ballotData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to submit ballot' }));
      throw new Error(error.error || 'Failed to submit ballot');
    }

    const result = await response.json();
    return { success: true, id: result.id };
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

