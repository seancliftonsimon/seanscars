import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useCollection } from '../../hooks/useCollection';
import { useDoc } from '../../hooks/useDoc';
import { seasonCol, showConfigDoc } from '../../firestore';
import {
  describeResult,
  ensureSeason,
  resolvePeople,
  writeItems,
  type WriteItem,
} from '../../importWriter';
import { importDocId } from '../../logic/importIds';
import {
  formatMSS,
  mapAttendees,
  mapAwards2026,
  mapFilms,
  mapIdeas,
  mapMaybeInvites,
  mapPostmortem,
  mapQuestions,
  mapTimerSegments,
  mapVenues,
  normalizeName,
  REQUIRED_HEADERS,
  seasonTotalSec,
} from '../../logic/importers';
import { defaultSeason } from '../../logic/season';
import { errorMessage } from '../../errors';
import CsvCard, { type CsvImporter, type PreviewItem } from './CsvCard';

/*
 * One card per importer. The 2026 cards always write to the 2026 archive;
 * the season-file cards write to the season picked at the top.
 */

const ARCHIVE_ID = '2026';

const ARCHIVE_SEASON = {
  ...defaultSeason(2026),
  showDate: '2026-03-07',
  capacity: 56,
  archived: true,
};

function ensureArchive() {
  return ensureSeason(ARCHIVE_ID, ARCHIVE_SEASON);
}

function withKey<T extends { importKey: string }>(item: T, prefix: string, data: object): WriteItem {
  return { id: importDocId(prefix, item.importKey), data: { ...data, importKey: item.importKey } };
}

const yesNo = (value: boolean) => (value ? 'yes' : '');

/* ---------- 2026 season + segments (from the timer's Firestore doc) ---------- */

function ArchiveSeasonCard() {
  const { seasons } = useSeason();
  const exists = seasons.some((s) => s.id === ARCHIVE_ID);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    try {
      const created = await ensureArchive();
      setMessage(created ? 'Created season 2026.' : 'Season 2026 already exists.');
    } catch (err) {
      setMessage(`Couldn't create: ${errorMessage(err)}`);
    }
  }

  return (
    <div className="pl-panel pl-import-card">
      <h2>2026 season</h2>
      <p className="pl-muted">
        Show date 2026-03-07, start 19:00, cap 180 min, buffer 10 min, capacity 56, archived. Every 2026 importer creates it if
        it's missing.
      </p>
      <div className="pl-form-actions">
        <button type="button" className="pl-btn" disabled={exists} onClick={create}>
          {exists ? 'Season 2026 exists' : 'Create season 2026'}
        </button>
        {message && <span className="pl-form-message">{message}</span>}
      </div>
    </div>
  );
}

function TimerSegmentsCard() {
  const timerDocId = ARCHIVE_SEASON.timerDocId;
  const { data: config, loading, error } = useDoc(showConfigDoc(timerDocId));
  const items = useMemo(() => (config ? mapTimerSegments(config) : []), [config]);
  const good = items.filter((i) => i.problems.length === 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      await ensureArchive();
      const names = good.flatMap((i) => i.ownerNames);
      const people = await resolvePeople(names.map((name) => ({ name })));
      const writes = good.map((i) =>
        withKey(i, 'seg', {
          ...i.segment,
          ownerPersonIds: i.ownerNames.map((n) => people.ids.get(normalizeName(n))).filter(Boolean),
        }),
      );
      const result = await writeItems(['seasons', ARCHIVE_ID, 'segments'], writes, { mode: 'upsert' });
      setMessage(`Segments: ${describeResult(result)}. People: ${describeResult(people.result)}.`);
    } catch (err) {
      setMessage(`Import failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pl-panel pl-import-card">
      <h2>2026 segments</h2>
      <p className="pl-muted">
        Read from the timer document <code>showConfigs/{timerDocId}</code>. Presenters become people (except Sharemony and
        Sean Simon).
      </p>
      {loading ? (
        <p className="pl-muted">Loading timer document…</p>
      ) : error ? (
        <p className="pl-error">Couldn't read the timer document: {errorMessage(error)}</p>
      ) : !config ? (
        <p className="pl-error">The timer document doesn't exist in Firestore.</p>
      ) : (
        <>
          <p>
            <strong>{items.length}</strong> segments, total <strong>{formatMSS(seasonTotalSec(good.map((i) => i.segment)))}</strong>
          </p>
          <div className="pl-table-scroll">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Length</th>
                  <th>People</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={i.importKey} className={i.problems.length ? 'has-problem' : undefined}>
                    <td>{n + 1}</td>
                    <td>{i.segment.title}</td>
                    <td>{i.segment.type}</td>
                    <td>{formatMSS(i.segment.plannedSec)}</td>
                    <td>{i.ownerNames.join(', ') || <span className="pl-muted">Sean / house</span>}</td>
                    <td className="pl-error">{i.problems.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-form-actions">
            <button type="button" className="pl-btn pl-btn-primary" disabled={busy || good.length === 0} onClick={run}>
              {busy ? 'Importing…' : `Import ${good.length} segments`}
            </button>
            {message && <span className="pl-form-message">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- 2026 CSV importers ---------- */

function useArchiveImporters() {
  const { data: segments } = useCollection(seasonCol(ARCHIVE_ID, 'segments'));
  const segmentRefs = useMemo(() => segments.map((s) => ({ id: s.id, title: s.title })), [segments]);

  const attendees: CsvImporter<ReturnType<typeof mapAttendees>[number]> = {
    title: '2026 attendees',
    fileHint: '2026-attendees.csv',
    headers: REQUIRED_HEADERS.attendees,
    columns: ['Name', 'Plus-ones', 'Brunch', 'Notes'],
    map: mapAttendees,
    cells: (i) => [i.person.name, i.invitation.plusOnes, yesNo(i.invitation.brunch), i.invitation.notes ?? ''],
    run: async (items) => {
      await ensureArchive();
      const people = await resolvePeople(items.map((i) => ({ name: i.person.name })));
      const writes = items.map((i) => ({
        id: people.ids.get(i.importKey) ?? importDocId('person', i.importKey),
        data: { ...i.invitation, importKey: i.importKey },
      }));
      const result = await writeItems(['seasons', ARCHIVE_ID, 'invitations'], writes, {
        mode: 'upsert',
        keepOnUpdate: ['rsvpIds'],
      });
      return `Invitations: ${describeResult(result)}. People: ${describeResult(people.result)}.`;
    },
  };

  const maybeInvites: CsvImporter<ReturnType<typeof mapMaybeInvites>[number]> = {
    title: '2026 maybe-invites',
    fileHint: '2026-maybe-invites.csv',
    headers: REQUIRED_HEADERS.maybeInvites,
    columns: ['Name', 'Notes'],
    map: mapMaybeInvites,
    cells: (i) => [i.person.name, i.person.notes ?? ''],
    run: async (items) => {
      const people = await resolvePeople(items.map((i) => ({ name: i.person.name, notes: i.person.notes })));
      return `People: ${describeResult(people.result)}.`;
    },
  };

  const awards: CsvImporter<ReturnType<typeof mapAwards2026>[number]> = {
    title: '2026 awards',
    fileHint: '2026-awards.csv',
    headers: REQUIRED_HEADERS.awards2026,
    columns: ['Award', 'Stage', 'Segment', 'Video'],
    map: (rows) => mapAwards2026(rows, segmentRefs),
    cells: (i) => [
      i.award.name,
      i.award.stage,
      segmentRefs.find((s) => s.id === i.award.segmentId)?.title ?? '',
      i.piece.measuredSec ? formatMSS(i.piece.measuredSec) : '',
    ],
    blocked: segmentRefs.length === 0 ? 'Import the 2026 segments first; awards link to them.' : undefined,
    run: async (items) => {
      await ensureArchive();
      const awardWrites = items.map((i) => withKey(i, 'award', i.award));
      const pieceWrites = items.map((i) =>
        withKey(i, 'piece', { ...i.piece, awardId: importDocId('award', i.importKey) }),
      );
      const a = await writeItems(['seasons', ARCHIVE_ID, 'awards'], awardWrites, { mode: 'upsert' });
      const p = await writeItems(['seasons', ARCHIVE_ID, 'pieces'], pieceWrites, { mode: 'upsert' });
      return `Awards: ${describeResult(a)}. Pieces: ${describeResult(p)}.`;
    },
  };

  return [attendees, maybeInvites, awards] as unknown as CsvImporter<PreviewItem>[];
}

/* ---------- season-file importers (target season) ---------- */

function seasonImporters(seasonId: string | null) {
  const blocked = seasonId ? undefined : 'Pick a target season above.';
  const write = (name: string, writes: WriteItem[]) =>
    writeItems(['seasons', seasonId as string, name], writes, { mode: 'upsert' }).then(describeResult);

  const films: CsvImporter<ReturnType<typeof mapFilms>[number]> = {
    title: 'Films',
    fileHint: '2027-films.csv',
    headers: REQUIRED_HEADERS.films,
    columns: ['Title', 'Seen', 'Reaction', 'Ideas'],
    map: mapFilms,
    cells: (i) => [i.film.title, yesNo(i.film.seen), i.film.reaction ?? '', i.film.ideas ?? ''],
    blocked,
    run: async (items) => `Films: ${await write('films', items.map((i) => withKey(i, 'film', i.film)))}.`,
  };

  const ideas: CsvImporter<ReturnType<typeof mapIdeas>[number]> = {
    title: 'Ideas',
    fileHint: '2027-ideas.csv',
    headers: REQUIRED_HEADERS.ideas,
    columns: ['Tag', 'Idea'],
    map: mapIdeas,
    cells: (i) => [i.idea.tag, i.idea.text],
    blocked,
    run: async (items) => `Ideas: ${await write('ideas', items.map((i) => withKey(i, 'idea', i.idea)))}.`,
  };

  const venues: CsvImporter<ReturnType<typeof mapVenues>[number]> = {
    title: 'Venues',
    fileHint: '2027-venues.csv',
    headers: REQUIRED_HEADERS.venues,
    columns: ['Venue', 'Status', 'Capacity', 'Quote'],
    map: mapVenues,
    cells: (i) => [
      i.venue.name,
      i.venue.status,
      i.venue.capacity ?? '',
      i.venue.quoteUsd !== undefined ? `$${i.venue.quoteUsd}` : '',
    ],
    blocked,
    run: async (items) => `Venues: ${await write('venues', items.map((i) => withKey(i, 'venue', i.venue)))}.`,
  };

  const questions: CsvImporter<ReturnType<typeof mapQuestions>[number]> = {
    title: 'Open questions',
    fileHint: '2027-open-questions.csv',
    headers: REQUIRED_HEADERS.questions,
    columns: ['Question', 'Due'],
    map: mapQuestions,
    cells: (i) => [i.question.question, i.question.dueDate ?? ''],
    blocked,
    run: async (items) =>
      `Questions: ${await write('questions', items.map((i) => withKey(i, 'question', i.question)))}.`,
  };

  const checklist: CsvImporter<ReturnType<typeof mapPostmortem>[number]> = {
    title: 'Postmortem actions → checklist',
    fileHint: '2026-postmortem-actions.csv',
    headers: REQUIRED_HEADERS.postmortem,
    columns: ['Area', 'Item'],
    map: mapPostmortem,
    cells: (i) => [i.item.area ?? '', i.item.text],
    blocked,
    run: async (items) =>
      `Checklist: ${await write('checklist', items.map((i) => withKey(i, 'check', i.item)))}.`,
  };

  return [films, ideas, venues, questions, checklist] as unknown as CsvImporter<PreviewItem>[];
}

export default function ImportScreen() {
  const { seasons } = useSeason();
  const openSeasons = seasons.filter((s) => !s.archived);
  const [picked, setPicked] = useState<string | null>(null);
  const targetId = picked ?? openSeasons[0]?.id ?? null;

  const archive = useArchiveImporters();
  const seasonFiles = seasonImporters(targetId);

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>Import</h1>
      </header>
      <p className="pl-page-answer">
        One-time setup: bring in the 2026 archive and season spreadsheets. Each card previews before it writes; re-running updates
        matching rows instead of duplicating them. Day to day, you won’t need this page.
      </p>

      <h2 className="pl-section-title">2026 archive</h2>
      <ArchiveSeasonCard />
      <TimerSegmentsCard />
      {archive.map((importer) => (
        <CsvCard key={importer.title} importer={importer} />
      ))}

      <h2 className="pl-section-title">Season files</h2>
      <div className="pl-panel">
        {openSeasons.length === 0 ? (
          <p className="pl-empty">
            No open season to import into. <Link to="/plan/season">Create or start one in Season settings.</Link>
          </p>
        ) : (
          <label className="pl-field pl-field-narrow">
            <span>Target season</span>
            <select value={targetId ?? ''} onChange={(e) => setPicked(e.target.value)}>
              {openSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.year}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {seasonFiles.map((importer) => (
        <CsvCard key={importer.title} importer={importer} />
      ))}
    </section>
  );
}
