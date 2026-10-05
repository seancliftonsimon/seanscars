import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { rsvpsCol } from '../firestore';
import { useCollection } from '../hooks/useCollection';
import { useSeason } from '../hooks/useSeason';
import { useSeasonData } from '../hooks/useSeasonData';
import { PlannerContext, type PlannerContextValue } from '../hooks/plannerContext';
import { todayIso } from '../logic/dates';
import { derivePhase } from '../logic/phase';
import { sortRsvpsNewestFirst } from '../logic/rsvp';

/** Today, refreshed when the tab comes back after midnight. */
function useToday(): string {
  const [today, setToday] = useState(todayIso);
  useEffect(() => {
    const check = () => setToday(todayIso());
    window.addEventListener('focus', check);
    const id = window.setInterval(check, 60 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', check);
      window.clearInterval(id);
    };
  }, []);
  return today;
}

export default function PlannerDataProvider({ children }: { children: ReactNode }) {
  const { season } = useSeason();
  const seasonId = season?.id ?? null;
  const data = useSeasonData(seasonId);
  const rsvps = useCollection(rsvpsCol());
  const today = useToday();

  // Only RSVPs for the selected season (or with no season hint), so a reply
  // can't be filed under an archived or future season by mistake.
  const inbox = useMemo(
    () =>
      sortRsvpsNewestFirst(
        rsvps.data.filter(
          (r) => !r.processed && (r.seasonHint === undefined || r.seasonHint === '' || String(r.seasonHint) === seasonId),
        ),
      ),
    [rsvps.data, seasonId],
  );

  const phase = useMemo(
    () =>
      season && !data.loading
        ? derivePhase(
            { season, invitations: data.invitations, segmentCount: data.segments.length, awardCount: data.awards.length },
            today,
          )
        : null,
    [season, data.loading, data.invitations, data.segments.length, data.awards.length, today],
  );

  const value = useMemo<PlannerContextValue>(
    () => ({ season, data, inbox, inboxLoading: rsvps.loading, phase, today }),
    [season, data, inbox, rsvps.loading, phase, today],
  );
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
