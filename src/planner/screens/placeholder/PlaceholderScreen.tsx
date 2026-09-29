import { Link } from 'react-router-dom';
import type { PlannerSection } from '../../routes';
import type { SeasonSubcollection } from '../../types';
import { useSeason } from '../../hooks/useSeason';
import { useCollection } from '../../hooks/useCollection';
import { seasonCol } from '../../firestore';

const COUNT_LABELS: Partial<Record<SeasonSubcollection, [string, string]>> = {
  segments: ['segment', 'segments'],
  awards: ['award', 'awards'],
  pieces: ['piece', 'pieces'],
  films: ['film', 'films'],
  ideas: ['idea', 'ideas'],
  invitations: ['invitation', 'invitations'],
  venues: ['venue', 'venues'],
  questions: ['open question', 'open questions'],
  checklist: ['checklist item', 'checklist items'],
};

/** "23 segments": a read-only count that confirms imports landed. */
function Count({ seasonId, name }: { seasonId: string; name: SeasonSubcollection }) {
  const { data, loading, error } = useCollection(seasonCol(seasonId, name));
  const [one, many] = COUNT_LABELS[name] ?? [name, name];
  if (loading) return <li className="pl-muted">Counting {many}…</li>;
  if (error) return <li className="pl-error">Couldn't count {many}: {error.code}</li>;
  return (
    <li>
      <strong>{data.length}</strong> {data.length === 1 ? one : many}
    </li>
  );
}

export default function PlaceholderScreen({ section }: { section: PlannerSection }) {
  const { season, loading } = useSeason();

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>{section.label}</h1>
        {season && <span className="pl-muted">{season.name}</span>}
      </header>
      <p className="pl-empty">{section.description}</p>
      {season && section.counts && (
        <ul className="pl-counts">
          {section.counts.map((name) => (
            <Count key={`${season.id}-${name}`} seasonId={season.id} name={name} />
          ))}
        </ul>
      )}
      {!loading && !season && (
        <p className="pl-muted">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      )}
    </section>
  );
}
