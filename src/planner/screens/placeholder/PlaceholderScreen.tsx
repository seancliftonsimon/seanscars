import { Link } from 'react-router-dom';
import type { PlannerSection } from '../../routes';
import { useSeason } from '../../hooks/useSeason';

export default function PlaceholderScreen({ section }: { section: PlannerSection }) {
  const { season, loading } = useSeason();

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>{section.label}</h1>
        {season && <span className="pl-muted">{season.name}</span>}
      </header>
      <p className="pl-empty">{section.description}</p>
      {!loading && !season && (
        <p className="pl-muted">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      )}
    </section>
  );
}
