import { createContext } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import type { Season, WithId } from '../types';

export interface SeasonContextValue {
  /** All seasons, newest first. */
  seasons: WithId<Season>[];
  /** The selected season, or null when none exist yet. */
  season: WithId<Season> | null;
  seasonId: string | null;
  setSeasonId: (id: string) => void;
  loading: boolean;
  error: FirestoreError | null;
}

export const SeasonContext = createContext<SeasonContextValue | null>(null);

export const SEASON_STORAGE_KEY = 'pl-season-id';
