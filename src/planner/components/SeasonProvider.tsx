import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useCollection } from '../hooks/useCollection';
import { SeasonContext, SEASON_STORAGE_KEY, type SeasonContextValue } from '../hooks/seasonContext';
import { seasonsCol } from '../firestore';
import { pickSeasonId } from '../logic/season';

function readStoredSeasonId(): string | null {
  try {
    return window.localStorage.getItem(SEASON_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSeasonId(id: string) {
  try {
    window.localStorage.setItem(SEASON_STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode); selection just won't persist.
  }
}

/**
 * Loads all seasons and tracks the selected one. The choice is remembered
 * in localStorage; without one, the latest non-archived season is used.
 */
export default function SeasonProvider({ children }: { children: ReactNode }) {
  const { data, loading, error } = useCollection(seasonsCol());
  const [chosenId, setChosenId] = useState<string | null>(readStoredSeasonId);

  const seasons = useMemo(() => [...data].sort((a, b) => b.year - a.year), [data]);
  const seasonId = loading ? null : pickSeasonId(seasons, chosenId);
  const season = seasons.find((s) => s.id === seasonId) ?? null;

  const setSeasonId = useCallback((id: string) => {
    setChosenId(id);
    writeStoredSeasonId(id);
  }, []);

  const value = useMemo<SeasonContextValue>(
    () => ({ seasons, season, seasonId, setSeasonId, loading, error }),
    [seasons, season, seasonId, setSeasonId, loading, error],
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}
