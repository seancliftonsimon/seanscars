import { useMemo } from 'react';
import { usePlanner } from './plannerContext';
import { computeSchedule } from '../logic/clock';
import { projectHeadcount } from '../logic/headcount';
import { sendProgress, waitingOnReply } from '../logic/invites';
import { computeNow } from '../logic/now';
import { changedSincePublish } from '../logic/publishDiff';
import { readiness } from '../logic/readiness';
import { toTimerPayload } from '../logic/timerPayload';
import { clockVerdict } from '../logic/verdict';
import { homeActions } from '../logic/home';

/** Everything the screens derive from the season's data, computed once per change. */
export function useDerived() {
  const { season, data, inbox, phase, today } = usePlanner();

  return useMemo(() => {
    if (!season || data.loading) return null;
    const schedule = computeSchedule(season, data.segments, data.pieces);
    const verdict = clockVerdict(schedule.totals, schedule.rows, data.segments);
    const projection = projectHeadcount(data.invitations, season.capacity);
    const send = sendProgress(data.invitations);
    const waiting = waitingOnReply(data.invitations, today);
    const now = computeNow(season, data, today);
    const livePublish = data.publishes.find((p) => p.targetDocId === season.timerDocId) ?? null;
    const payload = toTimerPayload(season, data.segments, data.peopleById, 0);
    const changedSinceLive = livePublish ? changedSincePublish(payload, livePublish) === true : false;
    /** null when the last publish has no snapshot to compare with. */
    const changedSinceLast = data.publishes[0] ? changedSincePublish(payload, data.publishes[0]) : null;
    const ready = readiness({
      season,
      totals: schedule.totals,
      segmentCount: data.segments.length,
      pieces: data.pieces,
      awards: data.awards,
      checklist: data.checklist,
      invitations: data.invitations,
      publishes: data.publishes,
      changedSinceLivePublish: changedSinceLive,
      today,
    });
    const actions = phase
      ? homeActions({
          phase: phase.id,
          now,
          projection,
          send,
          waiting,
          inboxCount: inbox.length,
          clock: verdict,
          segmentCount: data.segments.length,
          awardCount: data.awards.length,
          hasShowDate: Boolean(season.showDate),
          readinessOpen: ready.filter((r) => !r.done).length,
          seasonYear: season.year,
        })
      : [];
    return { schedule, verdict, projection, send, waiting, now, ready, actions, livePublish, changedSinceLive, changedSinceLast };
  }, [season, data, inbox.length, phase, today]);
}

export type Derived = NonNullable<ReturnType<typeof useDerived>>;
