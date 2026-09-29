import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { currentEmail } from './firestore';
import { stripUndefined } from './logic/records';
import { importDocId } from './logic/importIds';
import { normalizeName } from './logic/importers';
import type { Person, WithId } from './types';

/*
 * Batched, idempotent writes for the Import page and "Start season from".
 * Every document id is chosen by the caller (deterministic), so a re-run
 * lands on the same documents.
 */

/** Firestore allows 500 writes per batch; stay well under. */
const BATCH_LIMIT = 400;

export interface WriteItem {
  id: string;
  data: Record<string, unknown>;
}

export interface WriteResult {
  created: number;
  updated: number;
  skipped: number;
}

export type WriteMode =
  /** New docs are created; existing docs get the new fields merged in. */
  | 'upsert'
  /** New docs are created; existing docs are left exactly as they are. */
  | 'create-only';

export interface WriteOptions {
  mode: WriteMode;
  /** Fields dropped when updating an existing doc (e.g. `rsvpIds`). */
  keepOnUpdate?: string[];
}

/** Ids of the documents already in a collection. */
async function existingIds(path: string[]): Promise<Set<string>> {
  const [first, ...rest] = path;
  const snap = await getDocs(collection(db, first, ...rest));
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * Writes `items` into the collection at `path` (e.g. ['seasons', '2026',
 * 'films']) in batches, stamping `createdAt` on new docs and `updatedAt` /
 * `updatedBy` on every doc written.
 */
export async function writeItems(path: string[], items: WriteItem[], options: WriteOptions): Promise<WriteResult> {
  const existing = await existingIds(path);
  const result: WriteResult = { created: 0, updated: 0, skipped: 0 };
  const [first, ...rest] = path;
  const by = currentEmail();

  let batch = writeBatch(db);
  let pending = 0;

  for (const item of items) {
    const ref = doc(db, first, ...rest, item.id);
    const data = stripUndefined(item.data);
    if (existing.has(item.id)) {
      if (options.mode === 'create-only') {
        result.skipped += 1;
        continue;
      }
      const patch: DocumentData = { ...data };
      for (const key of options.keepOnUpdate ?? []) delete patch[key];
      batch.set(ref, { ...patch, updatedAt: serverTimestamp(), updatedBy: by }, { merge: true });
      result.updated += 1;
    } else {
      batch.set(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: by });
      result.created += 1;
    }
    pending += 1;
    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
  return result;
}

/** Creates `seasons/{id}` with `fields` unless it already exists. Returns true if created. */
export async function ensureSeason(seasonId: string, fields: Record<string, unknown>): Promise<boolean> {
  const ref = doc(db, 'seasons', seasonId);
  if ((await getDoc(ref)).exists()) return false;
  const result = await writeItems(['seasons'], [{ id: seasonId, data: fields }], { mode: 'create-only' });
  return result.created === 1;
}

export interface PersonInput {
  name: string;
  notes?: string;
}

/**
 * Finds or creates a person for each name, matching existing people by
 * normalized name or alias. New people get deterministic ids; existing
 * people keep their fields, except that blank notes are filled in.
 * Returns normalized name → person id.
 */
export async function resolvePeople(people: PersonInput[]): Promise<{ ids: Map<string, string>; result: WriteResult }> {
  const snap = await getDocs(collection(db, 'people'));
  const byName = new Map<string, WithId<Person>>();
  for (const d of snap.docs) {
    const person = { ...(d.data() as Person), id: d.id };
    byName.set(normalizeName(person.name), person);
    for (const alias of person.aliases ?? []) {
      const key = normalizeName(alias);
      if (!byName.has(key)) byName.set(key, person);
    }
  }

  const ids = new Map<string, string>();
  const toWrite: WriteItem[] = [];
  for (const input of people) {
    const key = normalizeName(input.name);
    if (!key || ids.has(key)) continue;
    const match = byName.get(key);
    if (match) {
      ids.set(key, match.id);
      if (input.notes && !match.notes) toWrite.push({ id: match.id, data: { notes: input.notes } });
    } else {
      const id = importDocId('person', key);
      ids.set(key, id);
      toWrite.push({ id, data: { name: input.name.trim(), ...(input.notes ? { notes: input.notes } : {}) } });
    }
  }

  const result = await writeItems(['people'], toWrite, { mode: 'upsert' });
  return { ids, result };
}

export function describeResult(result: WriteResult): string {
  const parts = [`${result.created} created`, `${result.updated} updated`];
  if (result.skipped) parts.push(`${result.skipped} already there`);
  return parts.join(', ');
}

export function addResults(...results: WriteResult[]): WriteResult {
  return results.reduce(
    (sum, r) => ({ created: sum.created + r.created, updated: sum.updated + r.updated, skipped: sum.skipped + r.skipped }),
    { created: 0, updated: 0, skipped: 0 },
  );
}
