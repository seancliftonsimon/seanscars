import { useMemo } from 'react';
import { headcount } from '../../logic/headcount';
import type { SeasonData } from '../../hooks/useSeasonData';
import './people.css';

interface Props {
  data: SeasonData;
  capacity: number | undefined;
}

/** Confirmed headcount against capacity, with the other status counts. */
export default function HeadcountCard({ data, capacity }: Props) {
  const h = useMemo(() => headcount(data.invitations, capacity), [data.invitations, capacity]);
  const over = h.capacity !== null && h.total > h.capacity;
  const pct = h.capacity ? Math.min(100, (h.total / h.capacity) * 100) : 0;

  return (
    <section className="pl-panel pl-people-headcount" aria-label="Headcount">
      <div className="pl-people-headcount-big">
        <span className={`pl-people-headcount-total${over ? ' is-over' : ''}`}>{h.total}</span>
        <span className="pl-people-headcount-of">
          {h.capacity !== null ? `of ${h.capacity}` : 'confirmed'}
        </span>
      </div>
      <div className="pl-muted">
        {h.confirmedPeople} people + {h.confirmedPlusOnes} plus-ones
        {h.capacity !== null && h.remaining !== null && (
          <>
            {' '}
            · {h.remaining >= 0 ? `${h.remaining} left` : `${-h.remaining} over`}
          </>
        )}
      </div>
      {h.capacity !== null && (
        <div
          className="pl-people-headcount-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={h.capacity}
          aria-valuenow={h.total}
        >
          <div className={`pl-people-headcount-fill${over ? ' is-over' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="pl-people-headcount-counts">
        <li>
          <b>{h.maybe}</b> maybe
        </li>
        <li>
          <b>{h.inviteQ}</b> invite?
        </li>
        <li>
          <b>{h.unanswered}</b> unanswered
        </li>
        <li>
          <b>{h.declined}</b> declined
        </li>
        <li>
          <b>{h.brunch}</b> brunch
        </li>
      </ul>
    </section>
  );
}
