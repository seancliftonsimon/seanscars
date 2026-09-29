import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { createRecord, currentEmail, seasonCol, showConfigDoc } from '../../firestore';
import { useDoc } from '../../hooks/useDoc';
import { errorMessage } from '../../errors';
import { toTimerPayload } from '../../logic/timerPayload';
import { describeChanges, diffTimerConfigs, timerEditsSincePublish } from '../../logic/publishDiff';
import { formatDuration } from '../../logic/clockFormat';
import type { Person, Publish, Season, Segment, WithId } from '../../types';

interface Props {
  season: WithId<Season>;
  /** In running order. */
  segments: WithId<Segment>[];
  people: WithId<Person>[];
  /** Newest first. */
  publishes: WithId<Publish>[];
  onClose: () => void;
}

function testDocId(timerDocId: string): string {
  return `${timerDocId}-test`;
}

function formatWhen(ts: Timestamp | null | undefined): string {
  return ts ? ts.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
}

/**
 * Publish the run of show to the Backstage Timer: pick the live or test
 * document, review what changes (and any edits made on the timer since the
 * last publish), then overwrite the document and record the publish.
 */
export default function PublishDialog({ season, segments, people, publishes, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const testId = testDocId(season.timerDocId);
  // Default to wherever the last publish went, and to the test copy before
  // any publish, so writing to the live timer is always a deliberate choice.
  const [useTest, setUseTest] = useState(() => publishes[0]?.targetDocId !== season.timerDocId);
  const targetId = useTest ? testId : season.timerDocId;
  const target = useDoc(showConfigDoc(targetId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  // Timestamp is filled in at publish time; 0 keeps the preview stable.
  const preview = useMemo(() => toTimerPayload(season, segments, peopleById, 0), [season, segments, peopleById]);
  const diff = useMemo(() => diffTimerConfigs(target.data, preview), [target.data, preview]);
  const lastToTarget = publishes.find((p) => p.targetDocId === targetId) ?? null;
  const timerEdits = timerEditsSincePublish(lastToTarget, target.data);

  async function publish() {
    setBusy(true);
    setMessage(null);
    try {
      const nowMs = Date.now();
      const payload = toTimerPayload(season, segments, peopleById, nowMs);
      // No merge: segments removed in the planner disappear from the timer.
      await setDoc(doc(db, 'showConfigs', targetId), payload);
      await createRecord(seasonCol(season.id, 'publishes'), {
        at: serverTimestamp() as unknown as Timestamp,
        targetDocId: targetId,
        segmentCount: payload.segments.length,
        totalSec: diff.afterTotalSec,
        byEmail: currentEmail(),
        payloadUpdatedAtMs: nowMs,
        segments: payload.segments,
      });
      setDone(true);
      setMessage(`Published ${payload.segments.length} segments to ${targetId}.`);
    } catch (err) {
      setMessage(`Couldn't publish: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const changeLines = describeChanges(diff);
  const editLines = timerEdits ? describeChanges(timerEdits) : [];

  return (
    <dialog
      ref={ref}
      className="pl-root pl-dialog pl-publish"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2>Publish to timer</h2>

      <fieldset className="pl-publish-target" disabled={busy || done}>
        <legend>Target</legend>
        <label className="pl-check">
          <input type="radio" checked={useTest} onChange={() => setUseTest(true)} />
          <span>
            Test copy <code>{testId}</code>
          </span>
        </label>
        <label className="pl-check">
          <input type="radio" checked={!useTest} onChange={() => setUseTest(false)} />
          <span>
            Live timer <code>{season.timerDocId}</code>
          </span>
        </label>
      </fieldset>

      {target.loading ? (
        <p className="pl-muted">Reading the timer document…</p>
      ) : target.error ? (
        <p className="pl-error">Couldn't read {targetId}: {errorMessage(target.error)}</p>
      ) : (
        <>
          {timerEdits && (
            <div className="pl-publish-warning" role="alert">
              <strong>The timer has edits this publish will overwrite.</strong>
              {editLines.length > 0 ? (
                <ul>
                  {editLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>It was saved after your last publish, with no visible changes.</p>
              )}
            </div>
          )}

          <p>
            {target.data ? (
              <>
                {preview.segments.length} segments · total {formatDuration(diff.beforeTotalSec)} →{' '}
                <strong>{formatDuration(diff.afterTotalSec)}</strong>
              </>
            ) : (
              <>
                {targetId} doesn't exist yet; publishing creates it with {preview.segments.length} segments (
                {formatDuration(diff.afterTotalSec)}).
              </>
            )}
          </p>

          {target.data &&
            (diff.identical ? (
              <p className="pl-muted">No changes: the timer already matches the plan.</p>
            ) : (
              <ul className="pl-publish-changes">
                {changeLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ))}

          {!useTest && (
            <p className="pl-muted">
              The live timer adopts this on its next load. On show night, edits made on the timer belong to the timer, so
              don't publish over them.
            </p>
          )}
        </>
      )}

      <div className="pl-form-actions">
        {done ? (
          <button type="button" className="pl-btn pl-btn-primary" onClick={onClose} autoFocus>
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              className={useTest ? 'pl-btn pl-btn-primary' : 'pl-btn pl-btn-danger'}
              disabled={busy || target.loading || Boolean(target.error)}
              onClick={publish}
            >
              {busy ? 'Publishing…' : useTest ? 'Publish to test copy' : 'Publish to live timer'}
            </button>
            <button type="button" className="pl-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </>
        )}
        {message && <span className="pl-form-message">{message}</span>}
      </div>

      {lastToTarget && (
        <p className="pl-muted pl-publish-last">
          Last published to {targetId} {formatWhen(lastToTarget.at)}.
        </p>
      )}
    </dialog>
  );
}
