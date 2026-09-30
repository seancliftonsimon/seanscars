import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonData } from '../../hooks/useSeasonData';
import { useCollection } from '../../hooks/useCollection';
import { rsvpsCol } from '../../firestore';
import { errorMessage } from '../../errors';
import { sortRsvpsNewestFirst } from '../../logic/rsvp';
import HeadcountCard from './HeadcountCard';
import GuestsTab from './GuestsTab';
import PersonPanel from './PersonPanel';
import RsvpInbox from './RsvpInbox';
import './people.css';

type Tab = 'guests' | 'inbox';

/** Guests and invitations, the headcount, and the RSVP inbox (`?tab=inbox`, `?person=…`). */
export default function PeopleScreen() {
  const { season } = useSeason();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const data = useSeasonData(season?.id ?? null);
  const rsvpState = useCollection(rsvpsCol());
  const [params, setParams] = useSearchParams();

  const tab: Tab = params.get('tab') === 'inbox' ? 'inbox' : 'guests';
  const personId = params.get('person');

  // Only RSVPs for the selected season (or with no season hint), so a reply
  // can't be filed under an archived or future season by mistake.
  const seasonId = season?.id ?? null;
  const inbox = useMemo(
    () =>
      sortRsvpsNewestFirst(
        rsvpState.data.filter(
          (r) => !r.processed && (r.seasonHint === undefined || r.seasonHint === '' || String(r.seasonHint) === seasonId),
        ),
      ),
    [rsvpState.data, seasonId],
  );

  function go(next: { tab?: Tab; person?: string | null }) {
    const p = new URLSearchParams();
    if ((next.tab ?? tab) === 'inbox') p.set('tab', 'inbox');
    if (next.person) p.set('person', next.person);
    setParams(p);
  }

  if (!season) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>People</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="pl-screen pl-screen-wide">
        <header className="pl-screen-header">
          <h1>People</h1>
          <div className="pl-header-actions">
            {tab === 'guests' && <label className="pl-search-field"><Search size={19} aria-hidden="true" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, aliases, or email…" aria-label="Search guests" /></label>}
            <button className="pl-btn pl-btn-primary" onClick={() => { go({ tab: 'guests' }); setAdding(true); }}><Plus size={19} aria-hidden="true" />Add person</button>
          </div>
        </header>

        {!data.loading && <HeadcountCard data={data} capacity={season.capacity} />}

        <div className="pl-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'guests'}
            className={tab === 'guests' ? 'pl-tab is-active' : 'pl-tab'}
            onClick={() => go({ tab: 'guests' })}
          >
            Guests <span className="pl-muted">{data.invitations.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'inbox'}
            className={tab === 'inbox' ? 'pl-tab is-active' : 'pl-tab'}
            onClick={() => go({ tab: 'inbox' })}
          >
            RSVP inbox {inbox.length > 0 && <span className="pl-badge">{inbox.length}</span>}
          </button>
        </div>

        {data.loading ? (
          <p className="pl-muted">Loading…</p>
        ) : data.error ? (
          <p className="pl-error">Couldn't load: {errorMessage(data.error)}</p>
        ) : tab === 'guests' ? (
          <GuestsTab key={season.id} seasonId={season.id} data={data} search={search} adding={adding} onCloseAdd={() => setAdding(false)} onOpenPerson={(id) => go({ person: id })} />
        ) : rsvpState.error ? (
          <p className="pl-error">Couldn't load RSVPs: {errorMessage(rsvpState.error)}</p>
        ) : (
          <RsvpInbox seasonId={season.id} data={data} rsvps={inbox} onOpenPerson={(id) => go({ person: id })} />
        )}
      </section>

      {personId && data.peopleById.has(personId) && (
        <PersonPanel key={personId} personId={personId} data={data} onClose={() => go({ person: null })} />
      )}
    </>
  );
}
