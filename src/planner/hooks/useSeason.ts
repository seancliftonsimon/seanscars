import { useContext } from 'react';
import { SeasonContext, type SeasonContextValue } from './seasonContext';

/** The selected planner season. Must be used inside <SeasonProvider>. */
export function useSeason(): SeasonContextValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error('useSeason must be used inside <SeasonProvider>');
  return value;
}
