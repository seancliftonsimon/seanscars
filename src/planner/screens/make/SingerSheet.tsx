import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePlanner } from '../../hooks/plannerContext';
import { Skeleton } from '../../components/ui/Basics';
import { resolvedMine } from '../../logic/lyrics';
import '../show/print.css';
import './songs.css';

const PALETTE = 6;
function singerClass(name: string): string {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 997;
  return `is-p${h % PALETTE}`;
}

/** Your lyrics only, big, with parts and cues: for rehearsal on a phone or on paper. */
export default function SingerSheet() {
  const { songId } = useParams();
  const { data } = usePlanner();
  const [originals, setOriginals] = useState(false);
  const song = data.songs.find((s) => s.id === songId);
  if (data.loading) return <Skeleton rows={8} label="Loading" />;
  if (!song) return <p className="pl-muted">Song not found. <Link to="/plan/make?view=songs">Back to songs</Link></p>;

  return (
    <div className="pl-page">
      <div className="pl-print-toolbar">
        <Link to={`/plan/make/song/${song.id}`} className="pl-btn">← Editor</Link>
        <label className="pl-check">
          <input type="checkbox" checked={originals} onChange={(e) => setOriginals(e.target.checked)} />
          <span>Show the original under each line</span>
        </label>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => window.print()}>Print</button>
      </div>
      <article className="pl-print-sheet pl-sheet">
        <h1>{song.title}</h1>
        {song.artist && <p className="pl-sheet-artist">after {song.artist}</p>}
        {song.sections.map((s) => {
          const mine = resolvedMine(song, s);
          return (
            <section key={s.id}>
              <h2>{s.label}</h2>
              {s.lines.map((l, i) => (
                <p key={l.id} className="pl-sheet-line">
                  {l.singer && <span className={`pl-sheet-singer ${singerClass(l.singer)}`}>{l.singer}</span>}
                  <span>{mine[i] || <em className="pl-sheet-todo">({l.original})</em>}</span>
                  {l.cue && <span className="pl-sheet-cue">{l.cue}</span>}
                  {originals && mine[i] && <span className="pl-sheet-orig">{l.original}</span>}
                </p>
              ))}
            </section>
          );
        })}
      </article>
    </div>
  );
}
