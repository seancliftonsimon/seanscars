import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCopy, ClipboardPaste, FileText, Music, Plus, Trash2, Wand2 } from 'lucide-react';
import { deleteRecord, seasonSubDoc } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useUndoableUpdate } from '../../hooks/useUndoable';
import { useToast } from '../../components/ui/toastContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { EmptyState, Skeleton } from '../../components/ui/Basics';
import { InlineText } from '../../components/ui/InlineText';
import { ProgressBar } from '../../components/ui/Progress';
import {
  lastWord,
  lineSyllables,
  meterFit,
  newId,
  parseLyrics,
  replaceOriginals,
  resolvedMine,
  rhymeFits,
  rhymeScheme,
  songAsTable,
  songProgress,
} from '../../logic/lyrics';
import type { Song, SongLine, SongSection, WithId } from '../../types';
import RhymeDrawer from './RhymeDrawer';
import { useSongDraft } from './useSongDraft';
import './songs.css';

const SAVE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Couldn’t save' } as const;

/** Moves focus between the "yours" inputs: Enter or ↓ = next line, ↑ = previous. */
function moveFocus(from: HTMLElement, delta: 1 | -1) {
  const all = [...document.querySelectorAll<HTMLInputElement>('[data-ly-input]')];
  const i = all.indexOf(from as HTMLInputElement);
  const next = all[i + delta];
  if (next) {
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  }
}

function PasteBox({ hasLines, onSplit, onCancel }: { hasLines: boolean; onSplit: (text: string) => void; onCancel?: () => void }) {
  const [text, setText] = useState('');
  return (
    <div className="pl-card pl-paste-box">
      <label className="pl-field">
        <span>Paste the original lyrics</span>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'[Verse 1]\nFirst line\nSecond line\n\n[Chorus]\n…'}
        />
      </label>
      <p className="pl-small pl-muted">
        Blank lines and headers like [Chorus] or Verse 2: start a new section. A section that repeats an earlier one is marked as a
        repeat, so you write it once.{hasLines ? ' Your lines are kept, in order.' : ''}
      </p>
      <div className="pl-row">
        <button type="button" className="pl-btn pl-btn-primary" disabled={!text.trim()} onClick={() => onSplit(text)}>
          <Wand2 size={16} aria-hidden /> {hasLines ? 'Replace the original' : 'Split into lines'}
        </button>
        {onCancel && (
          <button type="button" className="pl-btn pl-btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

interface LineProps {
  line: SongLine;
  letter: string | null;
  rhymeFit: 'kept' | 'broken' | 'none';
  placeholder: string;
  singers: string[];
  onChange: (patch: Partial<SongLine>) => void;
  onRhymes: (word: string) => void;
  onRemove: () => void;
}

function LineRow({ line, letter, rhymeFit, placeholder, singers, onChange, onRhymes, onRemove }: LineProps) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const origSyl = lineSyllables(line.original);
  const mineText = line.mine;
  const fit = meterFit(line.original, mineText || placeholder);
  const mineSyl = lineSyllables(mineText || placeholder);
  const showTags = tagsOpen || Boolean(line.singer || line.cue);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
      e.preventDefault();
      moveFocus(e.currentTarget, 1);
    } else if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault();
      moveFocus(e.currentTarget, -1);
    }
  }

  return (
    <div className="pl-ly-row">
      <div className="pl-ly-orig">
        <span className="pl-ly-text">
          <InlineText value={line.original} label="Original line" onSave={(original) => onChange({ original })} placeholder="(no original line)" />
        </span>
        <span className="pl-ly-meta">
          <span className="pl-ly-syl" title={`${origSyl} syllables`}>{origSyl}</span>
          <button
            type="button"
            className={`pl-ly-letter${letter ? '' : ' is-none'}`}
            onClick={() => onRhymes(lastWord(line.original))}
            title={letter ? `Rhyme ${letter}: rhymes for “${lastWord(line.original)}”` : `Rhymes for “${lastWord(line.original)}”`}
            aria-label={`Rhymes for ${lastWord(line.original) || 'this line'}`}
          >
            {letter ?? '·'}
          </button>
        </span>
      </div>
      <div className="pl-ly-mine">
        <input
          data-ly-input
          value={mineText}
          placeholder={placeholder || 'Your line'}
          onChange={(e) => onChange({ mine: e.target.value })}
          onKeyDown={onKey}
          onFocus={() => setTagsOpen(true)}
          aria-label={`Your line for: ${line.original}`}
          className={placeholder && !mineText ? 'is-repeat' : undefined}
        />
        <span className="pl-ly-meta">
          {fit !== 'empty' && (
            <span className={`pl-ly-syl is-${fit}`} title={fit === 'match' ? 'Same syllables as the original' : fit === 'close' ? 'One syllable off' : `Off by ${Math.abs(mineSyl - origSyl)} syllables`}>
              {mineSyl}
              {fit === 'off' ? ' ⚠' : fit === 'match' ? ' ✓' : ' ~'}
            </span>
          )}
          {rhymeFit !== 'none' && (
            <span className={`pl-ly-rhymefit is-${rhymeFit}`} title={rhymeFit === 'kept' ? 'Keeps the rhyme' : 'The original rhymes here; yours doesn’t'}>
              {rhymeFit === 'kept' ? 'rhymes' : 'no rhyme'}
            </span>
          )}
          <button type="button" className="pl-ly-letter is-mine" onClick={() => onRhymes(lastWord(mineText) || lastWord(line.original))} aria-label="Rhymes for your line" title="Rhymes for your line">
            ♪
          </button>
        </span>
      </div>
      {showTags && (
        <div className="pl-ly-tags">
          <input
            list="pl-singers"
            className="pl-ly-tag"
            value={line.singer ?? ''}
            onChange={(e) => onChange({ singer: e.target.value || undefined })}
            placeholder="Singer"
            aria-label="Singer"
          />
          <input className="pl-ly-tag is-cue" value={line.cue ?? ''} onChange={(e) => onChange({ cue: e.target.value || undefined })} placeholder="Cue (doubled lead, choir only…)" aria-label="Cue" />
          <button type="button" className="pl-icon-btn" onClick={onRemove} aria-label="Remove line" title="Remove line">
            <Trash2 size={14} aria-hidden />
          </button>
          <datalist id="pl-singers">
            {singers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  song,
  section,
  index,
  sections,
  onChange,
  onRemove,
  onRhymes,
  singers,
}: {
  song: Pick<Song, 'sections'>;
  section: SongSection;
  index: number;
  sections: SongSection[];
  onChange: (next: SongSection) => void;
  onRemove: () => void;
  onRhymes: (word: string) => void;
  singers: string[];
}) {
  const letters = rhymeScheme(section.lines.map((l) => l.original));
  const repeatSource = section.repeatOf ? sections.find((s) => s.id === section.repeatOf) : undefined;
  const filled = resolvedMine(song, section);
  const fits = rhymeFits(section.lines.map((l, i) => ({ original: l.original, mine: filled[i] })));
  const setLine = (i: number, patch: Partial<SongLine>) =>
    onChange({ ...section, lines: section.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <section className="pl-card pl-ly-section" aria-label={section.label}>
      <header className="pl-ly-section-head">
        <h2>
          <InlineText value={section.label} label="Section name" allowEmpty={false} onSave={(label) => onChange({ ...section, label })} />
        </h2>
        <select
          className="pl-select-auto pl-small"
          value={section.repeatOf ?? ''}
          onChange={(e) => onChange({ ...section, repeatOf: e.target.value || undefined })}
          aria-label={`Is ${section.label} a repeat?`}
        >
          <option value="">Written fresh</option>
          {sections.slice(0, index).filter((s) => s.id !== section.id && !s.repeatOf).map((s, i) => (
            <option key={s.id} value={s.id}>
              Repeats {s.label} ({i + 1})
            </option>
          ))}
        </select>
        <button type="button" className="pl-icon-btn" onClick={onRemove} aria-label={`Remove ${section.label}`} title="Remove section">
          <Trash2 size={15} aria-hidden />
        </button>
      </header>
      {repeatSource && <p className="pl-small pl-muted">Same as {repeatSource.label}. Type over a line only where this time changes.</p>}
      <div className="pl-ly-cols" aria-hidden>
        <span>Original</span>
        <span>Yours</span>
      </div>
      {section.lines.map((line, i) => (
        <LineRow
          key={line.id}
          line={line}
          letter={letters[i]}
          rhymeFit={fits[i]}
          placeholder={line.mine ? '' : filled[i]}
          singers={singers}
          onChange={(patch) => setLine(i, patch)}
          onRhymes={onRhymes}
          onRemove={() => onChange({ ...section, lines: section.lines.filter((_, j) => j !== i) })}
        />
      ))}
      <button
        type="button"
        className="pl-btn pl-btn-sm pl-btn-quiet"
        onClick={() => onChange({ ...section, lines: [...section.lines, { id: newId(), original: '', mine: '' }] })}
      >
        <Plus size={14} aria-hidden /> Add line
      </button>
    </section>
  );
}

function Editor({ song }: { song: WithId<Song> }) {
  const { season, data } = usePlanner();
  const update = useUndoableUpdate();
  const toast = useToast();
  const navigate = useNavigate();
  const { sections, change, state, error } = useSongDraft(season!.id, song);
  const [pasting, setPasting] = useState(false);
  const [rhymeWord, setRhymeWord] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sid = season!.id;
  const ref = seasonSubDoc(sid, 'songs', song.id);
  const live = useMemo(() => ({ ...song, sections }), [song, sections]);
  const progress = songProgress(live);
  const singers = useMemo(
    () => [...new Set(['Sean', 'Both', 'Choir', ...sections.flatMap((s) => s.lines.map((l) => l.singer).filter((x): x is string => Boolean(x)))])],
    [sections],
  );
  const songPieces = data.pieces.filter((p) => p.kind === 'song');

  function split(text: string) {
    const fresh = parseLyrics(text);
    change(sections.some((s) => s.lines.length) ? replaceOriginals(sections, fresh) : fresh);
    setPasting(false);
  }

  async function copyTable() {
    const { html, text } = songAsTable(live);
    try {
      if ('ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast({ message: 'Copied. Paste into a Google Doc for an Original | My lyrics table.' });
    } catch {
      toast({ message: 'Couldn’t copy; your browser blocked the clipboard.', tone: 'danger' });
    }
  }

  return (
    <div className={`pl-page pl-song${rhymeWord !== null ? ' has-drawer' : ''}`}>
      <header className="pl-page-header">
        <div className="pl-page-header-text">
          <p className="pl-eyebrow">
            <Link to="/plan/make?view=songs">
              <ArrowLeft size={12} aria-hidden /> Songs
            </Link>
          </p>
          <h1>
            <InlineText value={song.title} label="Song title" allowEmpty={false} onSave={(title) => void update(ref, song, { title }, 'Title saved')} />
          </h1>
          <p className="pl-page-answer">
            <InlineText value={song.artist ?? ''} label="Artist" placeholder="Add the artist" onSave={(artist) => void update(ref, song, { artist: artist || undefined }, 'Artist saved')} />
            {' · '}
            <select
              className="pl-select-auto pl-inline-select"
              value={song.pieceId ?? ''}
              aria-label="Piece"
              onChange={(e) => void update(ref, song, { pieceId: e.target.value || undefined }, 'Moved')}
            >
              <option value="">Not in a piece</option>
              {songPieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </p>
        </div>
        <div className="pl-page-actions">
          <button type="button" className="pl-btn" onClick={() => setPasting((p) => !p)}>
            <ClipboardPaste size={16} aria-hidden /> Paste lyrics
          </button>
          <Link to={`/plan/make/song/${song.id}/sheet`} className="pl-btn">
            <FileText size={16} aria-hidden /> Singer sheet
          </Link>
          <button type="button" className="pl-btn" onClick={() => void copyTable()} disabled={progress.total === 0}>
            <ClipboardCopy size={16} aria-hidden /> Copy for Docs
          </button>
          <button type="button" className="pl-icon-btn" onClick={() => setConfirmDelete(true)} aria-label="Delete song" title="Delete song">
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </header>

      {progress.total > 0 && (
        <div className="pl-song-stats">
          <ProgressBar value={progress.written} max={progress.total} tone={progress.written === progress.total ? 'good' : 'accent'} label="Lines written" />
          <p className="pl-small pl-muted">
            {progress.written} of {progress.total} lines written{progress.off ? ` · ${progress.off} off the meter` : ''} ·{' '}
            <span className={state === 'error' ? 'pl-danger-text' : undefined} role="status">
              {SAVE_LABEL[state]}
              {error ? `: ${error}` : ''}
            </span>
          </p>
        </div>
      )}

      {(pasting || sections.length === 0) && (
        <PasteBox hasLines={sections.some((s) => s.lines.length)} onSplit={split} onCancel={sections.length ? () => setPasting(false) : undefined} />
      )}

      <div className="pl-song-body">
        <div className="pl-song-sections">
          {sections.map((section, i) => (
            <SectionCard
              key={section.id}
              song={live}
              section={section}
              index={i}
              sections={sections}
              singers={singers}
              onChange={(next) => change(sections.map((s, j) => (j === i ? next : s)))}
              onRemove={() => change(sections.filter((_, j) => j !== i).map((s) => (s.repeatOf === section.id ? { ...s, repeatOf: undefined } : s)))}
              onRhymes={(w) => setRhymeWord(w)}
            />
          ))}
          {sections.length > 0 && (
            <button
              type="button"
              className="pl-btn pl-btn-sm"
              onClick={() => change([...sections, { id: newId(), label: `Section ${sections.length + 1}`, lines: [{ id: newId(), original: '', mine: '' }] }])}
            >
              <Plus size={14} aria-hidden /> Add section
            </button>
          )}
          {sections.length > 0 && (
            <p className="pl-small pl-faint">
              Numbers are syllables (✓ same as the original, ~ one off, ⚠ two or more). Letters mark lines that rhyme in the original.
              Both are estimates from spelling. Enter or ↓ moves to the next line.
            </p>
          )}
        </div>
        {rhymeWord !== null && (
          <RhymeDrawer
            word={rhymeWord}
            scratch={song.scratch ?? ''}
            onScratch={(scratch) => void update(ref, song, { scratch: scratch || undefined }, 'Scratchpad saved')}
            onClose={() => setRhymeWord(null)}
          />
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${song.title}”?`}
          message="This deletes the song and every line you wrote for it. It can’t be undone."
          confirmLabel="Delete song"
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteRecord(ref).then(() => navigate('/plan/make?view=songs'));
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/** `/plan/make/song/:songId` — original and yours, line by line. */
export default function SongEditor() {
  const { songId } = useParams();
  const { season, data } = usePlanner();
  if (!season || data.loading) return <div className="pl-page"><Skeleton rows={8} label="Loading song" /></div>;
  const song = data.songs.find((s) => s.id === songId);
  if (!song) {
    return (
      <EmptyState icon={Music} title="Song not found" action={<Link to="/plan/make?view=songs" className="pl-btn">Back to songs</Link>}>
        It may have been deleted.
      </EmptyState>
    );
  }
  return <Editor key={song.id} song={song} />;
}
