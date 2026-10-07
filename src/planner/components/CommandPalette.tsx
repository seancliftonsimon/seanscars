import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckSquare,
  Clapperboard,
  Film,
  HelpCircle,
  Lightbulb,
  MapPin,
  Music,
  Plus,
  Search,
  Trophy,
  User,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { createRecord, deleteRecord, peopleCol, personDoc, seasonCol, seasonSubDoc } from '../firestore';
import { usePlanner } from '../hooks/plannerContext';
import { useToast } from './ui/toastContext';
import { errorMessage } from '../errors';
import { INVITATION_STATUS_LABEL, PIECE_KIND_LABEL, VENUE_STATUS_LABEL, ownerNames } from '../logic/labels';
import { nextOrder } from '../logic/records';
import { search, type SearchItem } from '../logic/search';
import type { Award, IdeaTag } from '../types';
import type { PaletteMode } from './paletteContext';

/** What an award matches besides its name: contenders (label, person, film), short name and show id. */
function awardKeywords(a: Award): string {
  const contenders = (a.contenders ?? []).flatMap((c) => [c.label, c.personName, c.film, c.slug]);
  return [a.shortName, a.slug, ...contenders].filter(Boolean).join(' ');
}

const KIND_ICON: Record<string, LucideIcon> = {
  go: ArrowRight,
  person: User,
  award: Trophy,
  piece: Wand2,
  segment: Clapperboard,
  film: Film,
  venue: MapPin,
  question: HelpCircle,
  task: CheckSquare,
  idea: Lightbulb,
  song: Music,
  add: Plus,
};

const KIND_LABEL: Record<string, string> = {
  go: 'Go to',
  person: 'Guest',
  award: 'Award',
  piece: 'Piece',
  segment: 'Segment',
  film: 'Film',
  venue: 'Venue',
  question: 'Question',
  task: 'Task',
  idea: 'Idea',
  song: 'Song',
};

const GO: SearchItem[] = [
  ['Home', '/plan', 'today next phase'],
  ['Guests', '/plan/guests', 'people guest list headcount capacity'],
  ['Send invitations', '/plan/guests?view=send', 'invite'],
  ['File new RSVPs', '/plan/guests?view=replies', 'rsvp inbox replies'],
  ['Who hasn’t replied', '/plan/guests?view=waiting', 'chase nudge reminders'],
  ['Final numbers', '/plan/guests?view=final', 'headcount brunch lock'],
  ['Door list', '/plan/guests/door', 'check-in print'],
  ['Show: run of show', '/plan/show', 'clock timeline segments runtime'],
  ['Show-week checklist', '/plan/show/ready', 'readiness ready'],
  ['Publish to timer', '/plan/show/ready?publish=1', 'backstage timer live test'],
  ['Print run of show', '/plan/show/print', 'print'],
  ['Make: my queue', '/plan/make', 'pieces next steps'],
  ['Awards', '/plan/make?view=awards', 'nominees winner'],
  ['Guest presentations', '/plan/make?view=guests', 'contributors decks'],
  ['Songs', '/plan/make?view=songs', 'lyrics parody medley songbook'],
  ['All pieces', '/plan/make?view=pieces', 'videos songs'],
  ['Venue & to-dos', '/plan/prep', 'logistics'],
  ['Venues', '/plan/prep?view=venues', 'book compare'],
  ['Open questions', '/plan/prep?view=questions', 'decide'],
  ['Checklist', '/plan/prep?view=checklist', 'tasks'],
  ['Ideas', '/plan/ideas', 'inbox capture'],
  ['Films', '/plan/ideas?view=films', 'film pool ballot'],
  ['Season setup', '/plan/season', 'settings capacity date'],
  ['Import', '/plan/import', 'csv archive'],
  ['Add segment', '/plan/show?segment=new', 'new'],
  ['Add award', '/plan/make?view=awards&award=new', 'new'],
  ['Add piece', '/plan/make?view=pieces&piece=new', 'new'],
].map(([title, href, keywords]) => ({ id: `go:${href}`, kind: 'go', title, href, keywords }));

type AddKind = 'idea' | 'person' | 'task' | 'question';
const ADDS: { kind: AddKind; label: string }[] = [
  { kind: 'idea', label: 'Add idea' },
  { kind: 'person', label: 'Add to guest list' },
  { kind: 'task', label: 'Add checklist task' },
  { kind: 'question', label: 'Add open question' },
];

/** "song: lyrics about…" → tag song. */
function ideaTag(text: string): { tag: IdeaTag; text: string } {
  const m = /^(song|award|bit|theme)\s*:\s*(.+)$/i.exec(text);
  return m ? { tag: m[1].toLowerCase() as IdeaTag, text: m[2] } : { tag: 'other', text };
}

interface Row {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  run: () => void;
}

interface Props {
  mode: PaletteMode;
  onClose: () => void;
}

/** Cmd/Ctrl-K: find any record, jump anywhere, or capture something new. */
export default function CommandPalette({ mode, onClose }: Props) {
  const { season, data } = usePlanner();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const records = useMemo<SearchItem[]>(() => {
    const invBy = new Map(data.invitations.map((i) => [i.id, i]));
    const items: SearchItem[] = [];
    for (const p of data.people) {
      const inv = invBy.get(p.id);
      items.push({ id: p.id, kind: 'person', title: p.name, subtitle: inv ? INVITATION_STATUS_LABEL[inv.status] : 'Not on this year’s list', href: `/plan/guests?person=${p.id}`, keywords: `${p.email ?? ''} ${(p.aliases ?? []).join(' ')}` });
    }
    for (const a of data.awards) items.push({ id: a.id, kind: 'award', title: a.name, href: `/plan/make?view=awards&award=${a.id}`, keywords: awardKeywords(a) });
    for (const p of data.pieces) items.push({ id: p.id, kind: 'piece', title: p.title, subtitle: `${PIECE_KIND_LABEL[p.kind]} · ${ownerNames(p.ownerPersonIds, data.peopleById)}`, href: `/plan/make?piece=${p.id}` });
    for (const s of data.segments) items.push({ id: s.id, kind: 'segment', title: s.title, href: `/plan/show?segment=${s.id}` });
    for (const f of data.films) items.push({ id: f.id, kind: 'film', title: f.title, href: `/plan/ideas?view=films&film=${f.id}` });
    for (const v of data.venues) items.push({ id: v.id, kind: 'venue', title: v.name, subtitle: VENUE_STATUS_LABEL[v.status], href: `/plan/prep?venue=${v.id}` });
    for (const q of data.questions) items.push({ id: q.id, kind: 'question', title: q.question, subtitle: q.status === 'decided' ? `Decided: ${q.answer ?? ''}` : 'Open', href: `/plan/prep?question=${q.id}`, keywords: q.options });
    for (const c of data.checklist) items.push({ id: c.id, kind: 'task', title: c.text, subtitle: c.done ? 'Done' : c.area, href: `/plan/prep?task=${c.id}` });
    for (const s of data.songs) items.push({ id: s.id, kind: 'song', title: s.title, subtitle: s.artist, href: `/plan/make/song/${s.id}` });
    for (const i of data.ideas) items.push({ id: i.id, kind: 'idea', title: i.text, href: `/plan/ideas?idea=${i.id}` });
    return items;
  }, [data]);

  function go(href: string) {
    onClose();
    navigate(href);
  }

  async function add(kind: AddKind, raw: string) {
    if (!season) return;
    const text = raw.trim();
    onClose();
    try {
      if (kind === 'idea') {
        const t = ideaTag(text);
        const id = await createRecord(seasonCol(season.id, 'ideas'), { text: t.text, tag: t.tag });
        toast({ message: `Idea saved: “${t.text}”`, undo: () => deleteRecord(seasonSubDoc(season.id, 'ideas', id)) });
      } else if (kind === 'person') {
        const id = await createRecord(peopleCol(), { name: text });
        await createRecord(seasonSubDoc(season.id, 'invitations', id), { status: 'invite?', plusOnes: 0, brunch: false, rsvpIds: [] });
        toast({
          message: `${text} is on the guest list`,
          undo: async () => {
            await deleteRecord(seasonSubDoc(season.id, 'invitations', id));
            await deleteRecord(personDoc(id));
          },
        });
      } else if (kind === 'task') {
        const id = await createRecord(seasonCol(season.id, 'checklist'), { text, done: false, order: nextOrder(data.checklist) });
        toast({ message: `Task added: “${text}”`, undo: () => deleteRecord(seasonSubDoc(season.id, 'checklist', id)) });
      } else {
        const id = await createRecord(seasonCol(season.id, 'questions'), { question: text, status: 'open' });
        toast({ message: `Question added: “${text}”`, undo: () => deleteRecord(seasonSubDoc(season.id, 'questions', id)) });
      }
    } catch (err) {
      toast({ message: `Couldn’t add: ${errorMessage(err)}`, tone: 'danger' });
    }
  }

  const rows: Row[] = useMemo(() => {
    const q = query.trim();
    const found = q ? search([...GO, ...records], q, 10) : mode === 'search' ? GO.slice(0, 8) : [];
    const results: Row[] = found.map((item) => ({
      key: `${item.kind}:${item.id}`,
      icon: KIND_ICON[item.kind] ?? Search,
      title: item.title,
      hint: item.kind === 'go' ? 'Go to' : [KIND_LABEL[item.kind], item.subtitle].filter(Boolean).join(' · '),
      run: () => go(item.href),
    }));
    const adds: Row[] =
      q && season
        ? ADDS.map((a) => ({ key: `add:${a.kind}`, icon: Plus, title: `${a.label}: “${q}”`, hint: 'Enter to add', run: () => void add(a.kind, q) }))
        : [];
    return mode === 'capture' || results.length === 0 ? [...adds, ...results] : [...results, ...adds];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, records, mode, season]);

  const current = Math.min(active, Math.max(rows.length - 1, 0));

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % Math.max(rows.length, 1);
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      rows[current]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="pl-palette-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-palette" role="dialog" aria-modal="true" aria-label={mode === 'capture' ? 'Quick add' : 'Search and jump'}>
        <div className="pl-palette-input">
          {mode === 'capture' ? <Plus size={18} aria-hidden /> : <Search size={18} aria-hidden />}
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="pl-palette-list"
            aria-activedescendant={rows[current] ? `pl-pal-${current}` : undefined}
            placeholder={mode === 'capture' ? 'Capture an idea, a guest, a task or a question…' : 'Search people, awards, pieces, venues… or type to add'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="pl-palette-list" role="listbox" ref={listRef} className="pl-palette-list">
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <li
                key={row.key}
                id={`pl-pal-${i}`}
                role="option"
                aria-selected={i === current}
                className={i === current ? 'is-active' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={row.run}
              >
                <Icon size={16} aria-hidden />
                <span className="pl-palette-title">{row.title}</span>
                <span className="pl-palette-hint">{row.hint}</span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="pl-palette-empty" role="presentation">
              {mode === 'capture' ? 'Type what you want to capture. Tip: “song: …” tags an idea as a song.' : 'Nothing matches.'}
            </li>
          )}
        </ul>
        <footer className="pl-palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>G</kbd> then <kbd>H</kbd> <kbd>G</kbd> <kbd>S</kbd> <kbd>M</kbd> <kbd>V</kbd> <kbd>I</kbd> jumps</span>
          <span><kbd>C</kbd> capture</span>
        </footer>
      </div>
    </div>
  );
}
