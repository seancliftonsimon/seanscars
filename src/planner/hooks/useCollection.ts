import { useEffect, useState } from 'react';
import { onSnapshot, queryEqual, type FirestoreError, type Query } from 'firebase/firestore';

export interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
}

interface Snapshot<T> {
  query: Query<T> | null;
  data: T[];
  error: FirestoreError | null;
}

function sameQuery<T>(a: Query<T> | null, b: Query<T> | null): boolean {
  if (a === null || b === null) return a === b;
  return a === b || queryEqual(a, b);
}

/**
 * Subscribes to a Firestore query with onSnapshot. Pass `null` to skip.
 * Queries are compared with queryEqual, so building one inline is fine.
 */
export function useCollection<T>(query: Query<T> | null): CollectionState<T> {
  const [snap, setSnap] = useState<Snapshot<T>>({ query: null, data: [], error: null });

  // Keep a stable identity for equal queries so the effect doesn't resubscribe every render.
  const [stableQuery, setStableQuery] = useState<Query<T> | null>(query);
  if (!sameQuery(stableQuery, query)) setStableQuery(query);

  useEffect(() => {
    if (!stableQuery) return;
    return onSnapshot(
      stableQuery,
      (result) => setSnap({ query: stableQuery, data: result.docs.map((d) => d.data()), error: null }),
      (error) => setSnap({ query: stableQuery, data: [], error }),
    );
  }, [stableQuery]);

  if (!stableQuery) return { data: [], loading: false, error: null };
  const current = snap.query !== null && sameQuery(snap.query, stableQuery);
  return current ? { data: snap.data, loading: false, error: snap.error } : { data: [], loading: true, error: null };
}
