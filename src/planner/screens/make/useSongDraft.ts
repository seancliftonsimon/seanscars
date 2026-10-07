import { useEffect, useRef, useState } from 'react';
import { seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import type { Song, SongSection, WithId } from '../../types';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Local copy of a song's sections that saves itself shortly after typing
 * stops. Changes from elsewhere (another device) are taken in only while
 * nothing local is waiting to be saved, so typing is never overwritten.
 */
export function useSongDraft(seasonId: string, song: WithId<Song>) {
  const [draft, setDraft] = useState<SongSection[]>(song.sections ?? []);
  const [rev, setRev] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const remote = JSON.stringify(song.sections ?? []);
  const [seenRemote, setSeenRemote] = useState(remote);
  const latest = useRef({ draft, rev, savedRev });

  // Take in a remote change when there's nothing of ours to save.
  if (remote !== seenRemote) {
    setSeenRemote(remote);
    if (rev === savedRev) setDraft(song.sections ?? []);
  }

  useEffect(() => {
    latest.current = { draft, rev, savedRev };
  }, [draft, rev, savedRev]);

  useEffect(() => {
    if (rev === savedRev) return;
    const at = rev;
    const t = window.setTimeout(async () => {
      setState('saving');
      try {
        await updateRecord(seasonSubDoc(seasonId, 'songs', song.id), { sections: draft });
        setSavedRev((prev) => Math.max(prev, at));
        setState('saved');
        setError(null);
      } catch (err) {
        setState('error');
        setError(errorMessage(err));
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [draft, rev, savedRev, seasonId, song.id]);

  // Leaving the page with unsaved typing: save it now.
  useEffect(
    () => () => {
      const { draft: d, rev: r, savedRev: s } = latest.current;
      if (r !== s) void updateRecord(seasonSubDoc(seasonId, 'songs', song.id), { sections: d });
    },
    [seasonId, song.id],
  );

  function change(next: SongSection[]) {
    setDraft(next);
    setRev((r) => r + 1);
    setState('unsaved');
  }

  return { sections: draft, change, state: rev !== savedRev && state === 'saved' ? 'unsaved' : state, error };
}
