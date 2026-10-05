import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Music, Plus } from 'lucide-react';
import { createRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useSafeWrite } from '../../hooks/useUndoable';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/Basics';
import { ProgressBar } from '../../components/ui/Progress';
import { songProgress } from '../../logic/lyrics';
import { nextOrder } from '../../logic/records';
import type { Song, WithId } from '../../types';

function SongRow({ song, siblings, index }: { song: WithId<Song>; siblings: WithId<Song>[]; index: number }) {
  const { season, data } = usePlanner();
  const write = useSafeWrite();
  const p = songProgress(song);
  const songPieces = data.pieces.filter((x) => x.kind === 'song');
  if (!season) return null;
  const ref = (id: string) => seasonSubDoc(season.id, 'songs', id);

  /** Swap order with the neighbour (medley order). */
  function move(delta: -1 | 1) {
    const other = siblings[index + delta];
    if (!other) return;
    void write(async () => {
      await updateRecord(ref(song.id), { order: other.order });
      await updateRecord(ref(other.id), { order: song.order });
    });
  }

  return (
    <div className="pl-list-row pl-song-row">
      <Music size={18} className="pl-faint" aria-hidden />
      <div className="pl-list-main">
        <Link to={`/plan/make/song/${song.id}`} className="pl-list-title">
          {song.title}
        </Link>
        <span className="pl-list-meta">
          {song.artist && <span>{song.artist}</span>}
          {p.total === 0 ? (
            <Chip tone="faint">No lyrics yet</Chip>
          ) : (
            <span>
              {p.written} of {p.total} lines written
            </span>
          )}
          {p.off > 0 && <Chip tone="warn">{p.off} off the meter</Chip>}
        </span>
        {p.total > 0 && <ProgressBar value={p.written} max={p.total} size="sm" tone={p.written === p.total ? 'good' : 'accent'} label={`${song.title} lines written`} />}
      </div>
      <div className="pl-list-actions">
        <select
          className="pl-select-auto pl-small"
          value={song.pieceId ?? ''}
          aria-label={`Piece for ${song.title}`}
          onChange={(e) => void write(() => updateRecord(ref(song.id), { pieceId: e.target.value || undefined }), 'Moved')}
        >
          <option value="">Not in a piece</option>
          {songPieces.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
        {siblings.length > 1 && (
          <>
            <button type="button" className="pl-icon-btn" onClick={() => move(-1)} disabled={index === 0} aria-label={`Move ${song.title} earlier`}>
              <ArrowUp size={15} aria-hidden />
            </button>
            <button type="button" className="pl-icon-btn" onClick={() => move(1)} disabled={index === siblings.length - 1} aria-label={`Move ${song.title} later`}>
              <ArrowDown size={15} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Every song being parodied, grouped by the piece (single song or medley) it belongs to. */
export default function Songbook() {
  const { season, data } = usePlanner();
  const navigate = useNavigate();
  const write = useSafeWrite();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  if (!season) return null;

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    let id = '';
    const ok = await write(async () => {
      id = await createRecord(seasonCol(season!.id, 'songs'), {
        title: t,
        ...(artist.trim() ? { artist: artist.trim() } : {}),
        order: nextOrder(data.songs),
        sections: [],
      });
    });
    if (ok) navigate(`/plan/make/song/${id}`);
  }

  const songPieces = data.pieces.filter((p) => p.kind === 'song');
  const groups = [
    ...songPieces.map((p) => ({ key: p.id, title: p.title, songs: data.songs.filter((s) => s.pieceId === p.id) })),
    {
      key: 'loose',
      title: 'Not in a piece yet',
      songs: data.songs.filter((s) => !s.pieceId || !songPieces.some((p) => p.id === s.pieceId)),
    },
  ].filter((g) => g.songs.length > 0);

  return (
    <div className="pl-stack">
      <form className="pl-toolbar" onSubmit={add}>
        <input className="pl-grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song to parody" aria-label="Song title" />
        <input className="pl-input-sm" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" aria-label="Artist" />
        <button type="submit" className="pl-btn pl-btn-primary" disabled={!title.trim()}>
          <Plus size={16} aria-hidden /> Add song
        </button>
      </form>

      {data.songs.length === 0 ? (
        <EmptyState icon={Music} title="No songs yet">
          Add a song you want to parody, paste its lyrics, and write yours line by line beside them. A medley is one song piece holding
          several songs.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="pl-section" aria-label={g.title}>
            <h2 className="pl-group-title">
              {g.title} <span className="pl-count">{g.songs.length}</span>
              {g.songs.length > 1 && g.key !== 'loose' && <span className="pl-faint"> · medley order</span>}
            </h2>
            <ul className="pl-list">
              {g.songs.map((s, i) => (
                <li key={s.id}>
                  <SongRow song={s} siblings={g.songs} index={i} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {songPieces.length === 0 && data.songs.length > 0 && (
        <p className="pl-small pl-muted">
          Tip: add a piece of kind Song (for example “Opening medley”) and put songs in it to keep a medley in order.
        </p>
      )}
    </div>
  );
}
