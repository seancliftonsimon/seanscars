import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useCollection } from '../../hooks/useCollection';
import { peopleCol, seasonCol } from '../../firestore';
import { errorMessage } from '../../errors';
import { computeSchedule, formatClockTime } from '../../logic/clock';
import { describeOverUnder, formatDuration, formatHMS } from '../../logic/clockFormat';
import type { Segment, Venue, WithId } from '../../types';
import './print.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 'YYYY-MM-DD' -> 'Saturday, March 7, 2026', with no timezone shifting. */
function formatShowDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo, d)).getUTCDay()];
  return `${weekday}, ${MONTHS[mo] ?? ''} ${d}, ${y}`;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function pickVenue(venues: WithId<Venue>[], venueOptionId?: string): WithId<Venue> | null {
  const booked = venues.filter((v) => v.status === 'booked');
  return booked.find((v) => v.id === venueOptionId) ?? booked[0] ?? null;
}

export default function PrintScreen() {
  const { season } = useSeason();
  const seasonId = season?.id ?? null;
  const segmentsState = useCollection(seasonId ? seasonCol(seasonId, 'segments') : null);
  const piecesState = useCollection(seasonId ? seasonCol(seasonId, 'pieces') : null);
  const venuesState = useCollection(seasonId ? seasonCol(seasonId, 'venues') : null);
  const publishesState = useCollection(seasonId ? seasonCol(seasonId, 'publishes') : null);
  const { data: people } = useCollection(peopleCol());

  // Stamp "Printed" at open time, and refresh right before the print dialog.
  const [printedAt, setPrintedAt] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setPrintedAt(Date.now());
    window.addEventListener('beforeprint', refresh);
    return () => window.removeEventListener('beforeprint', refresh);
  }, []);

  const segments = useMemo(
    () => [...segmentsState.data].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    [segmentsState.data],
  );
  const schedule = useMemo(
    () => (season ? computeSchedule(season, segments, piecesState.data) : null),
    [season, segments, piecesState.data],
  );
  const segmentsById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);
  const namesById = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  const latestPublishMs = useMemo(() => {
    let latest: number | null = null;
    for (const p of publishesState.data) {
      const ms = p.at?.toMillis();
      if (ms !== undefined && (latest === null || ms > latest)) latest = ms;
    }
    return latest;
  }, [publishesState.data]);
  const changedSince = useMemo(
    () =>
      latestPublishMs !== null &&
      segments.some((s) => (s.updatedAt?.toMillis() ?? 0) > latestPublishMs),
    [segments, latestPublishMs],
  );

  if (!season) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Print run of show</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  const loading =
    segmentsState.loading || piecesState.loading || venuesState.loading || publishesState.loading;
  const loadError = segmentsState.error ?? piecesState.error ?? venuesState.error ?? publishesState.error;

  function presenterFor(segment: Segment): string {
    if (segment.ownerPersonIds.length > 0) {
      return segment.ownerPersonIds.map((id) => namesById.get(id) ?? 'Unknown').join(' & ');
    }
    return segment.presenterLabel || 'Sean';
  }

  const venue = pickVenue(venuesState.data, season.venueOptionId);
  const totals = schedule?.totals;
  const groups = totals
    ? `Sean ${formatDuration(totals.byGroup.sean)} · Contributors ${formatDuration(totals.byGroup.contributors)} · House ${formatDuration(totals.byGroup.house)}`
    : '';

  return (
    <section className="pl-screen pl-screen-wide">
      <div className="pl-print-toolbar">
        <Link to="/plan/show" className="pl-btn">
          ← Back to Show
        </Link>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {loading ? (
        <p className="pl-muted">Loading run of show…</p>
      ) : loadError ? (
        <p className="pl-error">Couldn't load: {errorMessage(loadError)}</p>
      ) : segments.length === 0 || !schedule || !totals ? (
        <p className="pl-empty">
          No segments yet. <Link to="/plan/show">Add some on the Show screen.</Link>
        </p>
      ) : (
        <article className="pl-print-sheet">
          <header className="pl-print-header">
            <h1>{season.name}</h1>
            <p className="pl-print-meta">
              {season.showDate && <span>{formatShowDate(season.showDate)}</span>}
              {venue && <span>{venue.name}</span>}
              {season.doorsTime && <span>Doors {formatClockTime(season.doorsTime)}</span>}
              <span>Start {formatClockTime(season.showStartTime)}</span>
            </p>
            <p className="pl-print-meta pl-print-small">
              <span>Printed {formatDateTime(printedAt)}</span>
              {latestPublishMs !== null && (
                <span>
                  {changedSince ? 'Changed since timer version' : 'Matches timer version'}{' '}
                  {formatDateTime(latestPublishMs)}
                </span>
              )}
            </p>
          </header>

          <table className="pl-print-table">
            <thead>
              <tr>
                <th className="pl-print-time">Start</th>
                <th className="pl-print-num">#</th>
                <th>Segment</th>
                <th>Presenter</th>
                <th className="pl-print-len">Length</th>
                <th>Source</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row, i) => {
                const seg = segmentsById.get(row.segmentId);
                if (!seg) return null;
                const notes = [
                  row.hardTimeGapSec > 0 && seg.hardTime
                    ? `waits ${formatDuration(row.hardTimeGapSec)} for ${seg.hardTime}`
                    : '',
                  seg.notes ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Fragment key={seg.id}>
                    {row.switchCue && (
                      <tr className="pl-print-switch">
                        <td colSpan={7}>SWITCH → {seg.playbackSource}</td>
                      </tr>
                    )}
                    <tr className={seg.type === 'intermission' ? 'pl-print-intermission' : undefined}>
                      <td className="pl-print-time">{formatClockTime(row.startTime)}</td>
                      <td className="pl-print-num">{i + 1}</td>
                      <td>{seg.title}</td>
                      <td>{presenterFor(seg)}</td>
                      <td className="pl-print-len">{formatDuration(row.durationSec)}</td>
                      <td>{seg.playbackSource}</td>
                      <td>{notes}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <footer className="pl-print-footer">
            <p>
              <strong>Total {formatHMS(totals.totalSec)}</strong> · Cap {formatHMS(totals.capSec)} · Buffer{' '}
              {formatHMS(totals.bufferTargetSec)} · {describeOverUnder(totals)}
            </p>
            <p>{groups}</p>
          </footer>
        </article>
      )}
    </section>
  );
}
