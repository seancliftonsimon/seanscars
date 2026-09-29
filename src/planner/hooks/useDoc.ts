import { useEffect, useState } from 'react';
import { onSnapshot, refEqual, type DocumentReference, type FirestoreError } from 'firebase/firestore';

export interface DocState<T> {
  /** null while loading, when the document doesn't exist, or on error. */
  data: T | null;
  loading: boolean;
  error: FirestoreError | null;
}

interface Snapshot<T> {
  ref: DocumentReference<T> | null;
  data: T | null;
  error: FirestoreError | null;
}

function sameRef<T>(a: DocumentReference<T> | null, b: DocumentReference<T> | null): boolean {
  if (a === null || b === null) return a === b;
  return a === b || refEqual(a, b);
}

/**
 * Subscribes to one document with onSnapshot. Pass `null` to skip.
 * Refs are compared with refEqual, so building one inline is fine.
 */
export function useDoc<T>(ref: DocumentReference<T> | null): DocState<T> {
  const [snap, setSnap] = useState<Snapshot<T>>({ ref: null, data: null, error: null });

  const [stableRef, setStableRef] = useState<DocumentReference<T> | null>(ref);
  if (!sameRef(stableRef, ref)) setStableRef(ref);

  useEffect(() => {
    if (!stableRef) return;
    return onSnapshot(
      stableRef,
      (result) => setSnap({ ref: stableRef, data: result.exists() ? result.data() : null, error: null }),
      (error) => setSnap({ ref: stableRef, data: null, error }),
    );
  }, [stableRef]);

  if (!stableRef) return { data: null, loading: false, error: null };
  const current = snap.ref !== null && sameRef(snap.ref, stableRef);
  return current ? { data: snap.data, loading: false, error: snap.error } : { data: null, loading: true, error: null };
}
