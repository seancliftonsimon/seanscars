import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Eye, Film as FilmIcon, Lightbulb, Plus, Trash2, Trophy, Vote, Wand2 } from 'lucide-react';
import { createRecord, deleteRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite, useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import { errorMessage } from '../../errors';
import { Chip } from '../../components/ui/Chip';
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/Basics';
import { InlineText } from '../../components/ui/InlineText';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { IDEA_TAG_LABEL, IDEA_TAGS, REACTION_LABEL, REACTIONS } from '../../logic/labels';
import { nextOrder } from '../../logic/records';
import { defaultSteps } from '../../logic/steps';
import { useScrollTo } from '../prep/useScrollTo';
import type { Film, Idea, IdeaTag, PieceKind, WithId } from '../../types';
import '../prep/prep.css';
import './ideas.css';

type View = 'ideas' | 'films';

function IdeasView({ highlight }: { highlight: string | null }) {
  const { season, data } = usePlanner();
  const write = useSafeWrite();
  const toast = useToast();
  const update = useUndoableUpdate();
  const [tag, setTag] = useState<IdeaTag>('song');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  if (!season) return null;
  const sid = season.id;
  const created = (i: WithId<Idea>) => i.createdAt?.toMillis?.() ?? 0;
  const fresh = data.ideas.filter((i) => !i.promotedTo).sort((a, b) => created(b) - created(a));
  const promoted = data.ideas.filter((i) => i.promotedTo);

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    let id = '';
    const ok = await write(async () => {
      id = await createRecord(seasonCol(sid, 'ideas'), { text: t, tag, ...(link.trim() ? { link: link.trim() } : {}) });
    });
    if (ok) {
      setText('');
      setLink('');
      toast({ message: 'Idea saved', undo: () => deleteRecord(seasonSubDoc(sid, 'ideas', id)) });
    }
  }

  async function promote(idea: WithId<Idea>, to: 'award' | 'piece') {
    setBusy(idea.id);
    try {
      let id: string;
      if (to === 'award') {
        id = await createRecord(seasonCol(sid, 'awards'), {
          order: nextOrder(data.awards), name: idea.text.trim().slice(0, 80), stage: 'idea', returning: false, contenders: [], notes: `From idea: ${idea.text}`,
        });
      } else {
        const kind: PieceKind = idea.tag === 'song' ? 'song' : idea.tag === 'bit' ? 'slides-bit' : 'other';
        id = await createRecord(seasonCol(sid, 'pieces'), {
          title: idea.text.trim().slice(0, 80), kind, ownerPersonIds: [], order: nextOrder(data.pieces), steps: defaultSteps(kind),
          links: idea.link ? [{ label: 'Idea link', url: idea.link }] : [], notes: `From idea: ${idea.text}`,
        });
      }
      await updateRecord(seasonSubDoc(sid, 'ideas', idea.id), { promotedTo: { kind: to, id } });
      toast({
        message: to === 'award' ? 'Now an award (stage: idea)' : 'Now a piece in your queue',
        undo: async () => {
          await updateRecord(seasonSubDoc(sid, 'ideas', idea.id), { promotedTo: undefined });
          await deleteRecord(seasonSubDoc(sid, to === 'award' ? 'awards' : 'pieces', id));
        },
      });
    } catch (err) {
      toast({ message: `Couldn’t promote: ${errorMessage(err)}`, tone: 'danger' });
    }
    setBusy(null);
  }

  const promotedHref = (p: NonNullable<Idea['promotedTo']>) => (p.kind === 'award' ? `/plan/make?view=awards&award=${p.id}` : `/plan/make?piece=${p.id}`);

  return (
    <div className="pl-stack">
      <form className="pl-card pl-capture" onSubmit={add}>
        <span className="pl-seg-ctl" role="group" aria-label="Kind of idea">
          {IDEA_TAGS.map((t) => (
            <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)}>{IDEA_TAG_LABEL[t]}</button>
          ))}
        </span>
        <div className="pl-toolbar">
          <input className="pl-grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture an idea…" aria-label="Idea" />
          <input type="url" className="pl-input-sm" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (optional)" aria-label="Link" />
          <button type="submit" className="pl-btn pl-btn-primary" disabled={!text.trim()}><Plus size={16} aria-hidden /> Save</button>
        </div>
        <p className="pl-small pl-faint">Tip: press C anywhere to capture without leaving the page.</p>
      </form>
      {fresh.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Inbox zero" compact>New ideas land here until you turn them into an award or a piece.</EmptyState>
      ) : (
        <ul className="pl-list" aria-label="Ideas">
          {fresh.map((idea) => {
            const toAward = idea.tag === 'award';
            return (
              <li key={idea.id} id={`idea-${idea.id}`} className={highlight === idea.id ? 'is-highlight' : undefined}>
                <div className="pl-list-row">
                  <Chip tone="accent">{IDEA_TAG_LABEL[idea.tag]}</Chip>
                  <div className="pl-list-main">
                    <span className="pl-list-title">
                      <InlineText value={idea.text} label="Idea" allowEmpty={false} onSave={(t) => void update(seasonSubDoc(sid, 'ideas', idea.id), idea, { text: t }, 'Idea updated')} />
                    </span>
                    {idea.link && <a className="pl-small" href={idea.link} target="_blank" rel="noreferrer">{idea.link}</a>}
                  </div>
                  <div className="pl-list-actions">
                    <button type="button" className="pl-btn pl-btn-sm" disabled={busy === idea.id} onClick={() => void promote(idea, toAward ? 'award' : 'piece')}>
                      {toAward ? <Trophy size={14} aria-hidden /> : <Wand2 size={14} aria-hidden />} {toAward ? 'Make it an award' : 'Make it a piece'}
                    </button>
                    <button type="button" className="pl-btn pl-btn-sm pl-btn-quiet" disabled={busy === idea.id} onClick={() => void promote(idea, toAward ? 'piece' : 'award')}>
                      {toAward ? 'or a piece' : 'or an award'}
                    </button>
                    <button type="button" className="pl-icon-btn" aria-label="Delete idea" onClick={() => {
                      void write(() => deleteRecord(seasonSubDoc(sid, 'ideas', idea.id)), 'Idea deleted', () => createRecord(seasonSubDoc(sid, 'ideas', idea.id), { text: idea.text, tag: idea.tag, ...(idea.link ? { link: idea.link } : {}) }));
                    }}>
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {promoted.length > 0 && (
        <details className="pl-details" open={promoted.some((i) => i.id === highlight)}>
          <summary>Already used ({promoted.length})</summary>
          <ul className="pl-list">
            {promoted.map((idea) => (
              <li key={idea.id} id={`idea-${idea.id}`}>
                <div className="pl-list-row is-dim">
                  <Chip tone="faint">{IDEA_TAG_LABEL[idea.tag]}</Chip>
                  <span className="pl-list-main">{idea.text}</span>
                  <Link to={promotedHref(idea.promotedTo!)} className="pl-small">
                    {idea.promotedTo!.kind === 'award' ? 'Award' : 'Piece'} <ArrowRight size={12} aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type FilmFilter = 'all' | 'unseen' | 'liked' | 'ballot' | 'used';

function FilmsView({ highlight }: { highlight: string | null }) {
  const { season, data } = usePlanner();
  const update = useUndoableUpdate();
  const write = useSafeWrite();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilmFilter>('all');
  const usedIn = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const a of data.awards) {
      for (const c of a.contenders ?? []) {
        if (!c.filmId) continue;
        const list = map.get(c.filmId) ?? [];
        if (!list.some((x) => x.id === a.id)) list.push({ id: a.id, name: a.name });
        map.set(c.filmId, list);
      }
    }
    return map;
  }, [data.awards]);
  if (!season) return null;
  const sid = season.id;
  const tests: Record<FilmFilter, (f: WithId<Film>) => boolean> = {
    all: () => true,
    unseen: (f) => !f.seen,
    liked: (f) => f.reaction === 'loved' || f.reaction === 'liked',
    ballot: (f) => f.onBallot,
    used: (f) => usedIn.has(f.id),
  };
  const labels: Record<FilmFilter, string> = { all: 'All', unseen: 'Not seen yet', liked: 'Loved or liked', ballot: 'On the ballot', used: 'Used in awards' };
  const needle = q.trim().toLowerCase();
  const visible = data.films.filter((f) => tests[filter](f) && (!needle || f.title.toLowerCase().includes(needle)));
  const exact = data.films.some((f) => f.title.trim().toLowerCase() === needle);
  const patch = (f: WithId<Film>, fields: Partial<Film>, msg: string) => void update(seasonSubDoc(sid, 'films', f.id), f, fields, `${f.title}: ${msg}`);

  async function addFilm(e: FormEvent) {
    e.preventDefault();
    const title = q.trim();
    if (!title || exact) return;
    if (await write(() => createRecord(seasonCol(sid, 'films'), { title, seen: false, eligible: true, onBallot: false }), `Added ${title}`)) setQ('');
  }

  return (
    <div className="pl-stack">
      <form className="pl-toolbar" onSubmit={addFilm}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find or add a film…" aria-label="Find or add a film" />
        {needle && !exact && <button type="submit" className="pl-btn pl-btn-primary"><Plus size={16} aria-hidden /> Add “{q.trim()}”</button>}
      </form>
      <div className="pl-filters" role="group" aria-label="Show">
        {(Object.keys(labels) as FilmFilter[]).map((k) => (
          <button key={k} type="button" className="pl-filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {labels[k]} <span className="pl-count">{data.films.filter(tests[k]).length}</span>
          </button>
        ))}
      </div>
      {data.films.length === 0 ? (
        <EmptyState icon={FilmIcon} title="The film pool is empty">Add films as you watch them, or import a list from the Import page.</EmptyState>
      ) : visible.length === 0 ? (
        <p className="pl-muted">No films match.</p>
      ) : (
        <ul className="pl-list" aria-label="Films">
          {visible.map((f) => {
            const uses = usedIn.get(f.id) ?? [];
            return (
              <li key={f.id} id={`film-${f.id}`} className={highlight === f.id ? 'is-highlight' : undefined}>
                <div className="pl-list-row pl-film-row">
                  <div className="pl-list-main">
                    <span className="pl-list-title">
                      <InlineText value={f.title} label="Title" allowEmpty={false} onSave={(t) => patch(f, { title: t }, 'renamed')} />
                    </span>
                    <span className="pl-list-meta">
                      {uses.map((u) => <Link key={u.id} to={`/plan/make?view=awards&award=${u.id}`}><Trophy size={12} aria-hidden /> {u.name}</Link>)}
                      <InlineText value={f.ideas ?? ''} label="Ideas for this film" placeholder="Add an idea for it" onSave={(t) => patch(f, { ideas: t || undefined }, 'ideas saved')} />
                    </span>
                  </div>
                  <div className="pl-list-actions">
                    <button type="button" className="pl-toggle" aria-pressed={f.seen} onClick={() => patch(f, { seen: !f.seen }, f.seen ? 'not seen' : 'seen')}>
                      <Eye size={12} aria-hidden /> Seen
                    </button>
                    <span className="pl-seg-ctl" role="group" aria-label={`Reaction to ${f.title}`}>
                      {REACTIONS.map((r) => (
                        <button key={r} type="button" aria-pressed={f.reaction === r} onClick={() => patch(f, { reaction: f.reaction === r ? undefined : r, seen: true }, REACTION_LABEL[r])}>
                          {REACTION_LABEL[r]}
                        </button>
                      ))}
                    </span>
                    <button type="button" className="pl-toggle" aria-pressed={f.eligible} onClick={() => patch(f, { eligible: !f.eligible }, f.eligible ? 'not eligible' : 'eligible')}>
                      <Check size={12} aria-hidden /> Eligible
                    </button>
                    <button type="button" className="pl-toggle" aria-pressed={f.onBallot} onClick={() => patch(f, { onBallot: !f.onBallot }, f.onBallot ? 'off the ballot' : 'on the ballot')}>
                      <Vote size={12} aria-hidden /> Ballot
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Ideas inbox and the film pool. `?view=films`, `?idea=`, `?film=`. */
export default function IdeasScreen() {
  const { season, data } = usePlanner();
  const [params] = useSearchParams();
  const ideaId = params.get('idea');
  const filmId = params.get('film');
  const view: View = params.get('view') === 'films' || filmId ? 'films' : 'ideas';
  useScrollTo(ideaId ? `idea-${ideaId}` : filmId ? `film-${filmId}` : null, !data.loading);

  if (!season) {
    return <EmptyState icon={Lightbulb} title="No season yet" action={<Link to="/plan/season" className="pl-btn pl-btn-primary">Create a season</Link>}>Ideas and films belong to a season.</EmptyState>;
  }
  if (data.loading) return <div className="pl-page"><Skeleton rows={2} label="Loading" /><Skeleton rows={6} /></div>;
  const fresh = data.ideas.filter((i) => !i.promotedTo).length;
  const seen = data.films.filter((f) => f.seen).length;

  return (
    <div className="pl-page">
      <PageHeader
        title="Ideas"
        answer={view === 'ideas' ? (fresh ? `${fresh} ideas waiting to become something.` : 'Inbox zero.') : `${data.films.length} films in the pool, ${seen} seen, ${data.films.filter((f) => f.onBallot).length} on the ballot.`}
      />
      <ViewTabs<View>
        label="Ideas views"
        current={view}
        defaultView="ideas"
        views={[
          { id: 'ideas', label: 'Ideas inbox', count: fresh },
          { id: 'films', label: 'Film pool', count: data.films.length },
        ]}
      />
      {view === 'ideas' ? <IdeasView highlight={ideaId} /> : <FilmsView highlight={filmId} />}
    </div>
  );
}
