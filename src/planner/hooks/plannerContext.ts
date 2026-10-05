import { createContext, useContext } from 'react';
import type { Rsvp, Season, WithId } from '../types';
import type { SeasonData } from './useSeasonData';
import type { DerivedPhase } from '../logic/phase';

export interface PlannerContextValue {
  season: WithId<Season> | null;
  data: SeasonData;
  /** Unprocessed RSVPs for this season (or with no season hint), newest first. */
  inbox: WithId<Rsvp>[];
  inboxLoading: boolean;
  phase: DerivedPhase | null;
  today: string;
}

export const PlannerContext = createContext<PlannerContextValue | null>(null);

/** Season, its data, the RSVP inbox and the phase. Inside <PlannerDataProvider>. */
export function usePlanner(): PlannerContextValue {
  const v = useContext(PlannerContext);
  if (!v) throw new Error('usePlanner must be used inside <PlannerDataProvider>');
  return v;
}
