import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonData } from '../../hooks/useSeasonData';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { nextOrder } from '../../logic/records';
import { defaultSteps } from '../../logic/steps';
import type { Film, FilmReaction, Idea, IdeaTag, PieceKind, WithId } from '../../types';
import './films.css';

const REACTIONS: FilmReaction[] = ['loved', 'liked', 'meh', 'disliked'];
const TAGS: IdeaTag[] = ['song', 'award', 'bit', 'theme', 'other'];

function IdeasCell({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="pl-films-ideas"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label="Edit ideas"
      >
        {value || <span className="pl-muted">add…</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      className="pl-films-ideas-input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

export default function FilmsScreen() {
  const { season } = useSeason();
  const seasonId = season?.id ?? null;
  const data = useSeasonData(seasonId);
  const { films, ideas, awards, pieces } = data;

  const [filter, setFilter] = useState('');
  const [newFilm, setNewFilm] = useState('');
  const [filmMsg, setFilmMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ideaTag, setIdeaTag] = useState<IdeaTag>('song');
  const [ideaText, setIdeaText] = useState('');
  const [ideaLink, setIdeaLink] = useState('');
  const [busyIdea, setBusyIdea] = useState<string | null>(null);

  const usedIn = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const award of awards) {
      const seen = new Set<string>();
      for (const c of award.contenders ?? []) {
        if (!c.filmId || seen.has(c.filmId)) continue;
        seen.add(c.filmId);
        const list = map.get(c.filmId) ?? [];
        list.push({ id: award.id, name: award.name });
        map.set(c.filmId, list);
      }
    }
    return map;
  }, [awards]);

  const visibleFilms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? films.filter((f) => f.title.toLowerCase().includes(q)) : films;
  }, [films, filter]);

  const sortedIdeas = useMemo(() => {
    const created = (i: WithId<Idea>) => i.createdAt?.toMillis?.() ?? 0;
    return [...ideas].sort(
      (a, b) => Number(!!a.promotedTo) - Number(!!b.promotedTo) || created(a) - created(b) || a.id.localeCompare(b.id),
    );
  }, [ideas]);

  if (!season || !seasonId) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Films &amp; ideas</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const patchFilm = (film: WithId<Film>, patch: Partial<Omit<Film, 'createdAt' | 'updatedAt' | 'updatedBy'>>) =>
    run(() => updateRecord(seasonSubDoc(seasonId, 'films', film.id), patch));

  const addFilm = async (e: FormEvent) => {
    e.preventDefault();
    const title = newFilm.trim();
    if (!title) {
      setFilmMsg('Enter a title.');
      return;
    }
    if (films.some((f) => f.title.trim().toLowerCase() === title.toLowerCase())) {
      setFilmMsg(`"${title}" is already in the pool.`);
      return;
    }
    setFilmMsg(null);
    await run(async () => {
      await createRecord(seasonCol(seasonId, 'films'), { title, seen: false, eligible: true, onBallot: false });
      setNewFilm('');
    });
  };

  const removeFilm = (film: WithId<Film>) => {
    const uses = usedIn.get(film.id);
    if (uses?.length) {
      setError(`"${film.title}" is a contender in ${uses.map((u) => u.name).join(', ')}. Remove it there first.`);
      return;
    }
    if (!window.confirm(`Delete "${film.title}" from the film pool?`)) return;
    void run(() => deleteRecord(seasonSubDoc(seasonId, 'films', film.id)));
  };

  const addIdea = async (e: FormEvent) => {
    e.preventDefault();
    const text = ideaText.trim();
    if (!text) return;
    const link = ideaLink.trim();
    await run(async () => {
      await createRecord(seasonCol(seasonId, 'ideas'), { text, tag: ideaTag, ...(link ? { link } : {}) });
      setIdeaText('');
      setIdeaLink('');
    });
  };

  const promoteToAward = async (idea: WithId<Idea>) => {
    setBusyIdea(idea.id);
    await run(async () => {
      const id = await createRecord(seasonCol(seasonId, 'awards'), {
        order: nextOrder(awards),
        name: idea.text.trim().slice(0, 80),
        stage: 'idea',
        returning: false,
        contenders: [],
        notes: `From idea: ${idea.text}`,
      });
      await updateRecord(seasonSubDoc(seasonId, 'ideas', idea.id), { promotedTo: { kind: 'award', id } });
    });
    setBusyIdea(null);
  };

  const promoteToPiece = async (idea: WithId<Idea>) => {
    setBusyIdea(idea.id);
    const kind: PieceKind = idea.tag === 'song' ? 'song' : idea.tag === 'bit' ? 'slides-bit' : 'other';
    await run(async () => {
      const id = await createRecord(seasonCol(seasonId, 'pieces'), {
        title: idea.text.trim().slice(0, 80),
        kind,
        ownerPersonIds: [],
        order: nextOrder(pieces),
        steps: defaultSteps(kind),
        links: idea.link ? [{ label: 'Idea link', url: idea.link }] : [],
        notes: `From idea: ${idea.text}`,
      });
      await updateRecord(seasonSubDoc(seasonId, 'ideas', idea.id), { promotedTo: { kind: 'piece', id } });
    });
    setBusyIdea(null);
  };

  const removeIdea = (idea: WithId<Idea>) => {
    if (!window.confirm('Delete this idea?')) return;
    void run(() => deleteRecord(seasonSubDoc(seasonId, 'ideas', idea.id)));
  };

  const promotedHref = (p: NonNullable<Idea['promotedTo']>) =>
    p.kind === 'award' ? `/plan/awards?award=${p.id}` : `/plan/awards?tab=pieces&piece=${p.id}`;

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>Films &amp; ideas</h1>
      </header>

      {error && <p className="pl-error">Couldn't save: {error}</p>}
      {data.error && <p className="pl-error">Couldn't load: {errorMessage(data.error)}</p>}

      <div className="pl-panel">
        <h2>Film pool</h2>
        <form className="pl-films-add" onSubmit={(e) => void addFilm(e)}>
          <input
            type="text"
            value={newFilm}
            onChange={(e) => {
              setNewFilm(e.target.value);
              setFilmMsg(null);
            }}
            placeholder="Add a film"
            aria-label="Add a film"
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter films"
            aria-label="Filter films"
          />
        </form>
        {filmMsg && <p className="pl-error">{filmMsg}</p>}
        {data.loading ? (
          <p className="pl-muted">Loading films…</p>
        ) : films.length === 0 ? (
          <p className="pl-empty">No films yet. Add one above or import from the Import page.</p>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table pl-films-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Seen</th>
                  <th>Reaction</th>
                  <th>Eligible</th>
                  <th>On ballot</th>
                  <th>Ideas</th>
                  <th>Used in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleFilms.map((film) => {
                  const uses = usedIn.get(film.id) ?? [];
                  return (
                    <tr key={film.id}>
                      <td className="pl-films-title">{film.title}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={film.seen}
                          aria-label={`${film.title} seen`}
                          onChange={(e) => void patchFilm(film, { seen: e.target.checked })}
                        />
                      </td>
                      <td>
                        <select
                          value={film.reaction ?? ''}
                          aria-label={`${film.title} reaction`}
                          onChange={(e) =>
                            void patchFilm(film, { reaction: (e.target.value || undefined) as FilmReaction | undefined })
                          }
                        >
                          <option value="">—</option>
                          {REACTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={film.eligible}
                          aria-label={`${film.title} eligible`}
                          onChange={(e) => void patchFilm(film, { eligible: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={film.onBallot}
                          aria-label={`${film.title} on ballot`}
                          onChange={(e) => void patchFilm(film, { onBallot: e.target.checked })}
                        />
                      </td>
                      <td>
                        <IdeasCell
                          value={film.ideas ?? ''}
                          onSave={(next) => void patchFilm(film, { ideas: next || undefined })}
                        />
                      </td>
                      <td>
                        {uses.length === 0 ? (
                          <span className="pl-muted">0</span>
                        ) : (
                          <span className="pl-films-used">
                            {uses.map((u) => (
                              <Link key={u.id} className="pl-tag" to={`/plan/awards?award=${u.id}`} title={u.name}>
                                {u.name}
                              </Link>
                            ))}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pl-link-btn"
                          onClick={() => removeFilm(film)}
                          aria-label={`Delete ${film.title}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleFilms.length === 0 && (
                  <tr>
                    <td colSpan={8} className="pl-muted">
                      No films match "{filter}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pl-panel">
        <h2>Ideas inbox</h2>
        <form className="pl-films-add" onSubmit={(e) => void addIdea(e)}>
          <select value={ideaTag} onChange={(e) => setIdeaTag(e.target.value as IdeaTag)} aria-label="Idea tag">
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            placeholder="Add an idea"
            aria-label="Idea text"
          />
          <input
            type="url"
            value={ideaLink}
            onChange={(e) => setIdeaLink(e.target.value)}
            placeholder="Link (optional)"
            aria-label="Idea link"
          />
          <button type="submit" className="pl-btn" disabled={!ideaText.trim()}>
            Add
          </button>
        </form>
        {data.loading ? (
          <p className="pl-muted">Loading ideas…</p>
        ) : sortedIdeas.length === 0 ? (
          <p className="pl-empty">No ideas yet.</p>
        ) : (
          <ul className="pl-films-list">
            {sortedIdeas.map((idea) => (
              <li key={idea.id} className={`pl-films-idea${idea.promotedTo ? ' pl-films-idea-promoted' : ''}`}>
                <span className="pl-tag">{idea.tag}</span>
                <span className="pl-films-idea-text">
                  {idea.text}
                  {idea.link && (
                    <>
                      {' '}
                      <a href={idea.link} target="_blank" rel="noreferrer">
                        link
                      </a>
                    </>
                  )}
                </span>
                <span className="pl-films-idea-actions">
                  {idea.promotedTo ? (
                    <Link to={promotedHref(idea.promotedTo)}>→ {idea.promotedTo.kind}</Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="pl-btn pl-btn-quiet"
                        disabled={busyIdea === idea.id}
                        onClick={() => void promoteToAward(idea)}
                      >
                        Promote to award
                      </button>
                      <button
                        type="button"
                        className="pl-btn pl-btn-quiet"
                        disabled={busyIdea === idea.id}
                        onClick={() => void promoteToPiece(idea)}
                      >
                        Promote to piece
                      </button>
                    </>
                  )}
                  <button type="button" className="pl-link-btn" onClick={() => removeIdea(idea)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
