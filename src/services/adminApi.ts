// Admin API client

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  }>;
  flagged?: boolean;
}

export interface BestPictureResult {
  id: string;
  title: string;
  totalPoints: number;
  numOneVotes: number;
  seenCount: number;
  seenFraction: number;
  avgPointsPerViewer: number;
}

export interface Overview {
  totalBallots: number;
  uniqueClientIds: number;
  possibleDuplicates: number;
  mostRecentSubmission: string | null;
}

function getAuthToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
}

export async function adminLogin(password: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

export async function getAllBallots(): Promise<Ballot[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/ballots`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to fetch ballots');
    }

    return await response.json();
  } catch (error) {
    console.error('Get ballots error:', error);
    throw error;
  }
}

export async function getBestPictureResults(): Promise<BestPictureResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/results/best-picture`);

    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }

    return await response.json();
  } catch (error) {
    console.error('Get results error:', error);
    throw error;
  }
}

export async function getOverview(): Promise<Overview> {
  try {
    const response = await fetch(`${API_BASE_URL}/results/overview`);

    if (!response.ok) {
      throw new Error('Failed to fetch overview');
    }

    return await response.json();
  } catch (error) {
    console.error('Get overview error:', error);
    throw error;
  }
}

export interface UnderSeenResult {
  id: string;
  title: string;
  totalPoints: number;
  numOneVotes: number;
  seenCount: number;
  seenFraction: number;
  avgPointsPerViewer: number;
  recommendationVotes: number;
}

export async function getUnderSeenResults(): Promise<UnderSeenResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/results/under-seen`);

    if (!response.ok) {
      throw new Error('Failed to fetch under-seen results');
    }

    return await response.json();
  } catch (error) {
    console.error('Get under-seen results error:', error);
    throw error;
  }
}

export interface FunCategoryResult {
  winner: { id: string; title: string; votes: number } | null;
  allResults: Array<{ id: string; title: string; votes: number }>;
}

export interface FunCategories {
  favoriteScary: FunCategoryResult;
  funniest: FunCategoryResult;
  bestTimeAtMovies: FunCategoryResult;
}

export async function getFunCategories(): Promise<FunCategories> {
  try {
    const response = await fetch(`${API_BASE_URL}/results/fun-categories`);

    if (!response.ok) {
      throw new Error('Failed to fetch fun categories');
    }

    return await response.json();
  } catch (error) {
    console.error('Get fun categories error:', error);
    throw error;
  }
}

