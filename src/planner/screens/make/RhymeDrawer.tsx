import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useToast } from '../../components/ui/toastContext';
import { rhymingNames } from '../../logic/lyrics';

interface Found {
  word: string;
  rhymes: string[];
  near: string[];
  failed: boolean;
}

const cache = new Map<string, { rhymes: string[]; near: string[] }>();

async function fetchWords(rel: 'rel_rhy' | 'rel_nry', word: string, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=40`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const list = (await res.json()) as { word: string }[];
  return list.map((x) => x.word);
}

/** Rhymes and near rhymes from Datamuse (online), with a small cache. */
function useRhymes(word: string): Found | null {
  const [found, setFound] = useState<Found | null>(null);
  const w = word.trim().toLowerCase();
  useEffect(() => {
    if (!w) return;
    const hit = cache.get(w);
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      if (hit) {
        setFound({ word: w, ...hit, failed: false });
        return;
      }
      try {
        const [rhymes, near] = await Promise.all([fetchWords('rel_rhy', w, ctrl.signal), fetchWords('rel_nry', w, ctrl.signal)]);
        const nearOnly = near.filter((x) => !rhymes.includes(x));
        cache.set(w, { rhymes, near: nearOnly });
        setFound({ word: w, rhymes, near: nearOnly, failed: false });
      } catch {
        if (!ctrl.signal.aborted) setFound({ word: w, rhymes: [], near: [], failed: true });
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [w]);
  return found && found.word === w ? found : null;
}

function Chips({ list, onCopy }: { list: string[]; onCopy: (w: string) => unknown }) {
  return (
    <div className="pl-rhyme-chips">
      {list.map((w) => (
        <button key={w} type="button" className="pl-rhyme-chip" onClick={() => void onCopy(w)} title="Copy">
          {w}
        </button>
      ))}
    </div>
  );
}

interface Props {
  word: string;
  scratch: string;
  onScratch: (text: string) => void;
  onClose: () => void;
}

/** Rhymes for a word: names from this season first, then dictionary rhymes, plus the song's scratchpad. */
export default function RhymeDrawer({ word: initial, scratch, onScratch, onClose }: Props) {
  const { data } = usePlanner();
  const toast = useToast();
  const [word, setWord] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setWord(initial);
  }
  const [note, setNote] = useState(scratch);
  const found = useRhymes(word);

  const seasonNames = useMemo(() => {
    const names = [
      ...data.films.map((f) => f.title),
      ...data.people.map((p) => p.name),
      ...data.awards.map((a) => a.name),
      ...data.awards.flatMap((a) => a.contenders.map((c) => c.label)),
    ];
    return rhymingNames(word, names, 16);
  }, [data, word]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `Copied “${text}”` });
    } catch {
      // Clipboard blocked: the chip text is selectable anyway.
    }
  }

  return (
    <aside className="pl-rhyme-drawer" aria-label="Rhymes">
      <header className="pl-row is-between">
        <h2>Rhymes</h2>
        <button type="button" className="pl-icon-btn" onClick={onClose} aria-label="Close rhymes">
          <X size={18} aria-hidden />
        </button>
      </header>
      <input value={word} onChange={(e) => setWord(e.target.value)} aria-label="Word to rhyme" placeholder="Word to rhyme" />
      {word.trim() && (
        <>
          <section>
            <h3>From this season</h3>
            {seasonNames.length ? <Chips onCopy={copy} list={seasonNames} /> : <p className="pl-small pl-muted">No films, people or awards rhyme with “{word}”.</p>}
          </section>
          <section>
            <h3>Rhymes</h3>
            {!found ? (
              <p className="pl-small pl-muted">Looking…</p>
            ) : found.failed ? (
              <p className="pl-small pl-muted">Couldn’t reach the rhyme dictionary. Check your connection.</p>
            ) : found.rhymes.length ? (
              <Chips onCopy={copy} list={found.rhymes} />
            ) : (
              <p className="pl-small pl-muted">No exact rhymes.</p>
            )}
          </section>
          {found && found.near.length > 0 && (
            <section>
              <h3>Near rhymes</h3>
              <Chips onCopy={copy} list={found.near} />
            </section>
          )}
        </>
      )}
      <section>
        <h3>Scratchpad</h3>
        <textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== scratch && onScratch(note)}
          placeholder="Brainstorm words for this song…"
          aria-label="Rhyme scratchpad"
        />
      </section>
      <p className="pl-small pl-faint">Tap a word to copy it. Rhymes from Datamuse.</p>
    </aside>
  );
}
