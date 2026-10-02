import { AlertTriangle, CheckCircle2, Info, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { seasonDoc } from '../../firestore';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { capacityVerdict, type HeadcountProjection, type ProjectionBasis } from '../../logic/headcount';
import type { PhaseId, Season, WithId } from '../../types';
import { CapacityBar } from '../ui/Progress';
import { InlineText } from '../ui/InlineText';

interface Props {
  season: WithId<Season>;
  projection: HeadcountProjection;
  basis: ProjectionBasis;
  phase: PhaseId;
  /** The booked venue, if any, for "Capacity 60 · The Marigold Room". */
  venueName?: string;
  /** Hide the detail line and capacity editor (home screen). */
  compact?: boolean;
}

const TONE_ICON = { ok: CheckCircle2, tight: Info, over: AlertTriangle, unknown: Users };

/**
 * Answer first ("You’re 6 over…"), then the numbers: confirmed, likely and
 * everyone listed, each counting plus-ones, against the capacity line.
 */
export default function HeadcountSummary({ season, projection: p, basis, phase, venueName, compact }: Props) {
  const update = useUndoableUpdate();
  const v = capacityVerdict(p, basis);
  const Icon = TONE_ICON[v.tone];
  const invitesOut = phase !== 'setup' && phase !== 'lists';

  const layers = [
    { key: 'confirmed', label: 'Coming', value: p.confirmed.total, tone: 'good' as const },
    ...(invitesOut ? [{ key: 'likely', label: 'Invited & maybes', value: p.likely.total, tone: 'accent' as const }] : []),
    { key: 'everyone', label: 'Everyone listed', value: p.everyone.total, tone: 'faint' as const },
  ];

  function saveCapacity(text: string) {
    const n = text === '' ? undefined : Math.max(0, Math.floor(Number(text)));
    if (n !== undefined && !Number.isFinite(n)) return;
    void update(seasonDoc(season.id), season, { capacity: n }, n === undefined ? 'Capacity cleared' : `Capacity set to ${n}`);
  }

  return (
    <div className="pl-headcount">
      <p className={`pl-verdict is-${v.tone}`}>
        <Icon size={18} aria-hidden />
        <span>{v.text}</span>
      </p>
      <CapacityBar
        layers={layers}
        capacity={p.capacity}
        label={`${layers.map((l) => `${l.label} ${l.value}`).join(', ')}${p.capacity !== null ? `, capacity ${p.capacity}` : ''}`}
      />
      <ul className="pl-legend">
        <li>
          <i className="is-good" /> Coming <b>{p.confirmed.total}</b>
          {p.confirmed.plusOnes > 0 && <span className="pl-faint">({p.confirmed.people} + {p.confirmed.plusOnes} plus-ones)</span>}
        </li>
        {invitesOut && (
          <li>
            <i className="is-accent" /> If invited &amp; maybes come <b>{p.likely.total}</b>
          </li>
        )}
        <li>
          <i className="is-faint" /> If everyone listed comes <b>{p.everyone.total}</b>
          <span className="pl-faint">({p.everyone.people} + {p.everyone.plusOnes} plus-ones)</span>
        </li>
      </ul>
      {!compact && (
        <p className="pl-small pl-muted pl-headcount-cap">
          Capacity{' '}
          <InlineText
            value={p.capacity === null ? '' : String(p.capacity)}
            onSave={saveCapacity}
            label="Capacity"
            placeholder="set capacity"
            className="pl-strong"
          />
          {venueName ? (
            <> · {venueName}</>
          ) : (
            <>
              {' '}· <Link to="/plan/prep?view=venues">no venue booked</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
