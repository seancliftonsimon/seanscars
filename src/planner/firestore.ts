import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type PartialWithFieldValue,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type WithFieldValue,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { omitId, prepareUpdate, stripUndefined } from './logic/records';
import type {
  Person,
  RecordMeta,
  Rsvp,
  Season,
  SeasonSubcollection,
  SeasonSubcollections,
  ShowConfig,
  WithId,
} from './types';

/* ---------- converters ---------- */

/**
 * Converter that adds the document id on read and strips `id` and
 * `undefined` values on write. Server timestamps that are still pending
 * read back as local estimates rather than null.
 */
export function makeConverter<T extends object>(): FirestoreDataConverter<WithId<T>, DocumentData> {
  return {
    toFirestore(data: WithFieldValue<WithId<T>> | PartialWithFieldValue<WithId<T>>): DocumentData {
      return stripUndefined(omitId(data as { id?: unknown })) as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): WithId<T> {
      const data = snapshot.data({ serverTimestamps: 'estimate', ...options });
      return { ...(data as T), id: snapshot.id };
    },
  };
}

// One converter instance per record type, so refs and queries built on
// different renders compare equal with refEqual / queryEqual.
const seasonConverter = makeConverter<Season>();
const personConverter = makeConverter<Person>();
const rsvpConverter = makeConverter<Rsvp>();
const showConfigConverter = makeConverter<ShowConfig>();

type SubConverters = {
  [K in SeasonSubcollection]: FirestoreDataConverter<WithId<SeasonSubcollections[K]>, DocumentData>;
};

const subConverters: SubConverters = {
  segments: makeConverter(),
  awards: makeConverter(),
  pieces: makeConverter(),
  invitations: makeConverter(),
  venues: makeConverter(),
  questions: makeConverter(),
  checklist: makeConverter(),
  films: makeConverter(),
  ideas: makeConverter(),
  publishes: makeConverter(),
};

/* ---------- path helpers ---------- */


export const seasonsCol = () => collection(db, 'seasons').withConverter(seasonConverter);
export const seasonDoc = (seasonId: string) => doc(db, 'seasons', seasonId).withConverter(seasonConverter);

/** e.g. `seasonCol('2027', 'segments')` → typed `seasons/2027/segments`. */
export function seasonCol<K extends SeasonSubcollection>(seasonId: string, name: K) {
  return collection(db, 'seasons', seasonId, name).withConverter(subConverters[name]);
}

/** e.g. `seasonSubDoc('2027', 'awards', awardId)`. */
export function seasonSubDoc<K extends SeasonSubcollection>(seasonId: string, name: K, id: string) {
  return doc(db, 'seasons', seasonId, name, id).withConverter(subConverters[name]);
}

export const peopleCol = () => collection(db, 'people').withConverter(personConverter);
export const personDoc = (personId: string) => doc(db, 'people', personId).withConverter(personConverter);

export const rsvpsCol = () => collection(db, 'rsvps').withConverter(rsvpConverter);
export const rsvpDoc = (rsvpId: string) => doc(db, 'rsvps', rsvpId).withConverter(rsvpConverter);

/** The timer's public sync document (e.g. `seanscars-2027-rundown`). */
export const showConfigDoc = (timerDocId: string) =>
  doc(db, 'showConfigs', timerDocId).withConverter(showConfigConverter);

/* ---------- CRUD ---------- */

/** Record fields a caller supplies: everything except the id and metadata. */
export type RecordInput<M> = Omit<M, 'id' | keyof RecordMeta>;

export function currentEmail(): string {
  return auth.currentUser?.email ?? 'planner';
}

/**
 * Creates a record with `createdAt`, `updatedAt` and `updatedBy`.
 * Pass a collection for an auto id, or a document ref for a chosen id
 * (seasons use the year; invitations use the person id). Returns the id.
 */
export async function createRecord<M extends object>(
  target: CollectionReference<M, DocumentData> | DocumentReference<M, DocumentData>,
  data: RecordInput<M>,
): Promise<string> {
  const payload = {
    ...stripUndefined(omitId(data as { id?: unknown })),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  };
  if (target.type === 'collection') {
    const ref = await addDoc(target.withConverter(null), payload);
    return ref.id;
  }
  await setDoc(target.withConverter(null), payload);
  return target.id;
}

/**
 * Updates fields on a record and stamps `updatedAt` / `updatedBy`.
 * A field set to `undefined` in the patch is deleted from the document.
 */
export async function updateRecord<M extends object>(
  ref: DocumentReference<M, DocumentData>,
  patch: Partial<RecordInput<M>>,
): Promise<void> {
  const prepared = prepareUpdate(omitId(patch as { id?: unknown }) as Record<string, unknown>, deleteField());
  await updateDoc(ref.withConverter(null), {
    ...prepared,
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

export async function deleteRecord<M extends object>(ref: DocumentReference<M, DocumentData>): Promise<void> {
  await deleteDoc(ref);
}
