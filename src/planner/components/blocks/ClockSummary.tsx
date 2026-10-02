import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ScheduleTotals } from '../../logic/clock';
import { formatDuration, formatHMS } from '../../logic/clockFormat';
import type { ClockVerdict } from '../../logic/verdict';

const ICON = { ok: CheckCircle2, tight: Info, over: AlertTriangle };

/** The clock as an answer ("4:00 over") with a bar and the best trims. */
export default function ClockSummary({ totals, verdict, compact }: { totals: ScheduleTotals; verdict: ClockVerdict; compact?: boolean }) {
  const Icon = ICON[verdict.state];
  const scale = Math.max(totals.capSec, totals.totalSec, 1) * 1.02;
  const pct = (s: number) => `${(Math.max(0, s) / scale) * 100}%`;
  const { sean, contributors, house } = totals.byGroup;
  const gaps = Math.max(0, totals.totalSec - sean - contributors - house);
  const tone = verdict.state === 'ok' ? 'ok' : verdict.state === 'tight' ? 'tight' : 'over';
  return (
    <div className="pl-clocksum">
      <p className={`pl-verdict is-${tone}`}>
        <Icon size={18} aria-hidden />
        <span>
          <strong className="pl-num">{formatHMS(totals.totalSec)}</strong> — {verdict.headline}
        </span>
      </p>
      <div
        className="pl-clockmeter"
        role="img"
        aria-label={`Runtime ${formatHMS(totals.totalSec)} of ${formatHMS(totals.capSec)} cap. Sean ${formatDuration(sean)}, guests ${formatDuration(contributors)}, house ${formatDuration(house)}.`}
      >
        <span className="is-sean" style={{ width: pct(sean) }} />
        <span className="is-guests" style={{ width: pct(contributors) }} />
        <span className="is-house" style={{ width: pct(house) }} />
        {gaps > 0 && <span className="is-gap" style={{ width: pct(gaps) }} />}
        <i className="pl-clockmeter-buffer" style={{ left: pct(totals.availableSec) }} title="Buffer starts" />
        <i className="pl-clockmeter-cap" style={{ left: pct(totals.capSec) }} title="Cap" />
      </div>
      <ul className="pl-legend">
        <li><i className="pl-sw is-sean" /> Sean <b>{formatDuration(sean)}</b></li>
        <li><i className="pl-sw is-guests" /> Guests <b>{formatDuration(contributors)}</b></li>
        <li><i className="pl-sw is-house" /> House <b>{formatDuration(house)}</b></li>
        <li className="pl-faint">Cap {formatHMS(totals.capSec)} · buffer {formatDuration(totals.bufferTargetSec)}</li>
      </ul>
      {!compact && verdict.candidates.length > 0 && (
        <div className="pl-trim">
          <span className="pl-small pl-muted">Best places to trim:</span>
          {verdict.candidates.map((c) => (
            <Link key={c.segmentId} to={`/plan/show?segment=${c.segmentId}`} className="pl-trim-chip">
              {c.title} <span className="pl-num">{formatDuration(c.sec)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
