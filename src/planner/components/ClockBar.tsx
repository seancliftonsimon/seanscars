import { describeOverUnder, formatDuration, formatHMS } from '../logic/clockFormat';

export interface ClockBarTotals {
  totalSec: number;
  capSec: number;
  bufferTargetSec: number;
  availableSec: number;
  overUnderSec: number;
  state: 'ok' | 'tight' | 'over';
  byGroup: { sean: number; contributors: number; house: number };
}

export default function ClockBar({ totals }: { totals: ClockBarTotals }) {
  const { totalSec, capSec, availableSec, state, byGroup } = totals;
  const scale = Math.max(capSec, totalSec, 1);
  const pct = (sec: number) => `${(Math.max(sec, 0) / scale) * 100}%`;
  const summed = byGroup.sean + byGroup.contributors + byGroup.house;
  const hard = Math.max(totalSec - summed, 0);
  const text = describeOverUnder(totals);
  const label = `Show clock: ${formatHMS(totalSec)} of ${formatHMS(capSec)} cap. ${text}. Sean ${formatDuration(byGroup.sean)}, contributors ${formatDuration(byGroup.contributors)}, house ${formatDuration(byGroup.house)}.`;

  const segments: { key: string; sec: number; cls: string }[] = [
    { key: 'sean', sec: byGroup.sean, cls: 'pl-clockbar-seg-sean' },
    { key: 'contributors', sec: byGroup.contributors, cls: 'pl-clockbar-seg-contrib' },
    { key: 'house', sec: byGroup.house, cls: 'pl-clockbar-seg-house' },
    { key: 'hard', sec: hard, cls: 'pl-clockbar-seg-hard' },
  ];
  const overSec = Math.max(totalSec - capSec, 0);

  return (
    <div className={`pl-clockbar is-${state}`}>
      <div className="pl-clockbar-head">
        <span className="pl-clockbar-total">{formatHMS(totalSec)}</span>
        <span className="pl-clockbar-status">{text}</span>
      </div>
      <div className="pl-clockbar-track" role="img" aria-label={label}>
        {segments.map((s) =>
          s.sec > 0 ? (
            <span key={s.key} className={`pl-clockbar-seg ${s.cls}`} style={{ width: pct(s.sec) }} />
          ) : null,
        )}
        {overSec > 0 && (
          <span
            className="pl-clockbar-over"
            style={{ left: pct(capSec), width: pct(overSec) }}
          />
        )}
        <span className="pl-clockbar-mark pl-clockbar-buffer" style={{ left: pct(availableSec) }} />
        <span className="pl-clockbar-mark pl-clockbar-cap" style={{ left: pct(capSec) }} />
      </div>
      <ul className="pl-clockbar-legend" aria-hidden="true">
        <li><i className="pl-clockbar-seg-sean" /> Sean {formatDuration(byGroup.sean)}</li>
        <li><i className="pl-clockbar-seg-contrib" /> Contributors {formatDuration(byGroup.contributors)}</li>
        <li><i className="pl-clockbar-seg-house" /> House {formatDuration(byGroup.house)}</li>
        <li className="pl-clockbar-cap-note">Buffer starts {formatHMS(availableSec)} · Cap {formatHMS(capSec)}</li>
      </ul>
    </div>
  );
}
