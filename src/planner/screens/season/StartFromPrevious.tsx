import { useState } from 'react';
import { getDoc, getDocs } from 'firebase/firestore';
import { useSeason } from '../../hooks/useSeason';
import { useCollection } from '../../hooks/useCollection';
import { seasonCol, seasonDoc } from '../../firestore';
import { addResults, describeResult, ensureSeason, writeItems } from '../../importWriter';
import { planRollover, rolloverDocId } from '../../logic/rollover';
import { isValidSeasonYear, suggestNextYear } from '../../logic/season';
import { errorMessage } from '../../errors';

/**
 * "Start {year} from {previous}": copies returning awards, Sean's and house
 * segments, last year's confirmed guests and draft contributor pieces into
 * a new season. Only creates missing documents, so running it twice changes
 * nothing.
 */
export default function StartFromPrevious() {
  const { seasons, season, setSeasonId } = useSeason();
  const defaultYear =
    season && !season.archived && seasons.some((s) => s.year < season.year) ? season.year : suggestNextYear(seasons);
  const [yearText, setYearText] = useState('');
  const year = Number(yearText || defaultYear);
  const earlier = seasons.filter((s) => s.year < year);
  const [pickedPrev, setPickedPrev] = useState<string | null>(null);
  const prevId = pickedPrev && earlier.some((s) => s.id === pickedPrev) ? pickedPrev : (earlier[0]?.id ?? null);

  const targetId = isValidSeasonYear(year) ? String(year) : null;
  const { data: targetSegments, loading } = useCollection(targetId ? seasonCol(targetId, 'segments') : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const disabledReason = !targetId
    ? 'Enter a year between 2000 and 2099.'
    : !prevId
      ? 'No earlier season to start from.'
      : loading
        ? 'Checking…'
        : null;
  // Only creates missing documents, so re-running just fills gaps (e.g. after
  // importing last season's awards or guests).
  const rerunNote =
    !loading && targetSegments.length > 0
      ? `${year} already has segments; running again only adds what's missing.`
      : null;

  async function run() {
    if (!targetId || !prevId) return;
    setBusy(true);
    setMessage(null);
    try {
      const [prevSnap, segments, awards, invitations] = await Promise.all([
        getDoc(seasonDoc(prevId)),
        getDocs(seasonCol(prevId, 'segments')),
        getDocs(seasonCol(prevId, 'awards')),
        getDocs(seasonCol(prevId, 'invitations')),
      ]);
      const prev = prevSnap.data();
      if (!prev) throw new Error(`Season ${prevId} not found.`);
      const plan = planRollover(
        {
          season: prev,
          segments: segments.docs.map((d) => d.data()),
          awards: awards.docs.map((d) => d.data()),
          invitations: invitations.docs.map((d) => d.data()),
        },
        year,
      );
      const key = (kind: string, id: string) => `${prevId}/${kind}/${id}`;
      const path = (name: string) => ['seasons', targetId, name];
      const opts = { mode: 'create-only' } as const;

      await ensureSeason(targetId, plan.season);
      const a = await writeItems(
        path('awards'),
        plan.awards.map((x) => ({ id: rolloverDocId('award', x.sourceId), data: { ...x.award, importKey: key('award', x.sourceId) } })),
        opts,
      );
      const s = await writeItems(
        path('segments'),
        plan.segments.map((x) => ({
          id: rolloverDocId('segment', x.sourceId),
          data: { ...x.segment, importKey: key('segment', x.sourceId) },
        })),
        opts,
      );
      const i = await writeItems(
        path('invitations'),
        plan.invitations.map((x) => ({ id: x.personId, data: { ...x.invitation, importKey: key('invitation', x.personId) } })),
        opts,
      );
      const p = await writeItems(
        path('pieces'),
        plan.pieces.map((x) => ({ id: rolloverDocId('piece', x.sourceId), data: { ...x.piece, importKey: key('piece', x.sourceId) } })),
        opts,
      );
      setSeasonId(targetId);
      setMessage(
        `Started ${year} from ${prevId}. Awards ${a.created}, segments ${s.created}, invitations ${i.created}, ` +
          `contributor pieces ${p.created} (${describeResult(addResults(a, s, i, p))}).`,
      );
    } catch (err) {
      setMessage(`Couldn't start the season: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pl-panel">
      <h2>Start a season from the previous one</h2>
      <p className="pl-muted">
        Copies returning awards (as ideas), Sean's and house segments, everyone who came last year as “On the list”, and a
        draft contributor piece for each contributor segment.
      </p>
      <div className="pl-inline-form">
        <label className="pl-field pl-field-narrow">
          <span>Year</span>
          <input
            type="number"
            inputMode="numeric"
            min={2000}
            max={2099}
            placeholder={String(defaultYear)}
            value={yearText}
            onChange={(e) => setYearText(e.target.value)}
          />
        </label>
        <label className="pl-field pl-field-narrow">
          <span>From</span>
          <select value={prevId ?? ''} onChange={(e) => setPickedPrev(e.target.value)} disabled={earlier.length === 0}>
            {earlier.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="pl-btn pl-btn-primary" disabled={busy || Boolean(disabledReason)} onClick={run}>
          {busy ? 'Starting…' : `Start ${targetId ?? '…'} from ${prevId ?? '…'}`}
        </button>
        {!busy && (disabledReason ?? rerunNote) && <span className="pl-muted">{disabledReason ?? rerunNote}</span>}
      </div>
      {message && <p className="pl-form-message">{message}</p>}
    </div>
  );
}
