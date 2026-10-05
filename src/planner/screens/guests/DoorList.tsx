import { Link } from 'react-router-dom';
import { usePlanner } from '../../hooks/plannerContext';
import { presentingIds } from '../../logic/headcount';
import { formatLongDay } from '../../logic/dates';
import { Skeleton } from '../../components/ui/Basics';
import '../show/print.css';
import './door.css';

/** Printable alphabetical check-in list of everyone coming. */
export default function DoorList() {
  const { season, data } = usePlanner();
  if (!season || data.loading) return <Skeleton rows={6} label="Loading door list" />;
  const presenting = presentingIds(data.pieces);
  const rows = data.invitations
    .filter((i) => i.status === 'confirmed' || i.status === 'maybe')
    .map((i) => ({ inv: i, person: data.peopleById.get(i.id) }))
    .filter((r) => r.person)
    .sort((a, b) => a.person!.name.localeCompare(b.person!.name));
  const coming = rows.filter((r) => r.inv.status === 'confirmed');
  const total = coming.reduce((n, r) => n + 1 + (r.inv.plusOnes || 0), 0);

  return (
    <div className="pl-page">
      <div className="pl-print-toolbar">
        <Link to="/plan/guests?view=final" className="pl-btn">← Final numbers</Link>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => window.print()}>Print</button>
      </div>
      <article className="pl-print-sheet pl-door">
        <header>
          <h1>{season.name} · Door list</h1>
          <p>{season.showDate ? formatLongDay(season.showDate) : ''} · {coming.length} guests, {total} with plus-ones{rows.length > coming.length ? ` · ${rows.length - coming.length} maybe (marked ?)` : ''}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th aria-label="Checked in">✓</th>
              <th>Name</th>
              <th>+1s</th>
              <th>Brunch</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ inv, person }) => (
              <tr key={inv.id} className={inv.status === 'maybe' ? 'is-maybe' : undefined}>
                <td><span className="pl-door-box" /></td>
                <td>
                  {person!.name}
                  {inv.status === 'maybe' && ' (?)'}
                  {presenting.has(inv.id) && ' · presenting'}
                </td>
                <td>{inv.plusOnes || ''}</td>
                <td>{inv.brunch ? 'Yes' : ''}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
