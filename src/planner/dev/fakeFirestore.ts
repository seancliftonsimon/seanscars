/*
 * Dev-only, in-memory stand-in for `firebase/firestore`. Vite aliases the
 * real module to this file in `--mode fake` (`npm run dev:fake`), so the
 * planner runs on invented data and can never reach the production project.
 *
 * It implements only what the app imports. Data lives in memory and is
 * mirrored to sessionStorage so a reload keeps your edits; add `?reset` to
 * the URL (before the #) to start over, `?scenario=<name>` to pick a seed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { seedFor, type SeedDoc } from './seed';

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromMillis(ms: number) {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(d: Date) {
    return Timestamp.fromMillis(d.getTime());
  }
  static now() {
    return Timestamp.fromMillis(Date.now());
  }
  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
  toDate() {
    return new Date(this.toMillis());
  }
  isEqual(other: Timestamp) {
    return other instanceof Timestamp && other.toMillis() === this.toMillis();
  }
}

class Sentinel {
  readonly op: 'serverTimestamp' | 'delete' | 'increment';
  readonly n: number;
  constructor(op: Sentinel['op'], n = 0) {
    this.op = op;
    this.n = n;
  }
}

export const serverTimestamp = () => new Sentinel('serverTimestamp');
export const deleteField = () => new Sentinel('delete');
export const increment = (n: number) => new Sentinel('increment', n);

/* ---------- storage ---------- */

type Data = Record<string, unknown>;
const store = new Map<string, Data>();
const STORAGE_PREFIX = 'pl-fake-db:';

function clone<T>(v: T): T {
  if (v instanceof Timestamp || v instanceof Sentinel) return v;
  if (Array.isArray(v)) return v.map(clone) as T;
  if (v && typeof v === 'object') {
    const out: Data = {};
    for (const [k, x] of Object.entries(v as Data)) out[k] = clone(x);
    return out as T;
  }
  return v;
}

function encode(v: unknown): unknown {
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Data).map(([k, x]) => [k, encode(x)]));
  }
  return v;
}

function decode(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    const o = v as Data;
    if (typeof o.__ts === 'number' && Object.keys(o).length === 1) return Timestamp.fromMillis(o.__ts);
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, decode(x)]));
  }
  return v;
}

function params(): URLSearchParams {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

const scenario = params().get('scenario') ?? 'invites';
const storageKey = STORAGE_PREFIX + scenario;
const latencyMs = Number(params().get('latency') ?? 60);

function load() {
  let saved: string | null = null;
  try {
    if (params().has('reset')) window.sessionStorage.removeItem(storageKey);
    saved = window.sessionStorage.getItem(storageKey);
  } catch {
    saved = null;
  }
  if (saved) {
    const entries = decode(JSON.parse(saved)) as [string, Data][];
    for (const [k, v] of entries) store.set(k, v);
    return;
  }
  const docs: SeedDoc[] = seedFor(scenario, Timestamp.fromMillis);
  for (const d of docs) store.set(d.path, clone(d.data));
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(encode([...store.entries()])));
    } catch {
      // Storage full or unavailable: keep going in memory.
    }
  }, 50);
}

load();

/* ---------- refs ---------- */

type Converter = {
  toFirestore: (d: any, options?: any) => any;
  fromFirestore: (snap: any, options?: any) => any;
} | null;

const FIRESTORE = { type: 'firestore', fake: true };
export function getFirestore() {
  return FIRESTORE;
}

let autoId = 0;
function newId() {
  autoId += 1;
  return `fake${Date.now().toString(36)}${autoId.toString(36)}`;
}

export class DocumentReference {
  readonly type = 'document';
  readonly path: string;
  readonly converter: Converter;
  readonly firestore = FIRESTORE;
  constructor(path: string, converter: Converter = null) {
    this.path = path;
    this.converter = converter;
  }
  get id() {
    return this.path.split('/').pop() as string;
  }
  get parent() {
    return new CollectionReference(this.path.split('/').slice(0, -1).join('/'));
  }
  withConverter(converter: Converter) {
    return new DocumentReference(this.path, converter);
  }
}

interface Order {
  field: string;
  dir: 'asc' | 'desc';
}

export class Query {
  readonly type: string = 'query';
  readonly path: string;
  readonly converter: Converter;
  readonly orders: Order[];
  readonly firestore = FIRESTORE;
  constructor(path: string, converter: Converter = null, orders: Order[] = []) {
    this.path = path;
    this.converter = converter;
    this.orders = orders;
  }
  withConverter(converter: Converter): Query {
    return new Query(this.path, converter, this.orders);
  }
}

export class CollectionReference extends Query {
  readonly type = 'collection';
  get id() {
    return this.path.split('/').pop() as string;
  }
  withConverter(converter: Converter): CollectionReference {
    return new CollectionReference(this.path, converter);
  }
}

function joinPath(base: any, segments: string[]): string {
  const prefix = base && typeof base.path === 'string' ? [base.path] : [];
  return [...prefix, ...segments].join('/');
}

export function collection(base: any, ...segments: string[]) {
  return new CollectionReference(joinPath(base, segments));
}

export function doc(base: any, ...segments: string[]) {
  if (base instanceof CollectionReference && segments.length === 0) {
    return new DocumentReference(`${base.path}/${newId()}`, base.converter);
  }
  const conv = base instanceof CollectionReference ? base.converter : null;
  return new DocumentReference(joinPath(base, segments), conv);
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Order {
  return { field, dir };
}

export function query(base: Query, ...constraints: Order[]) {
  return new Query(base.path, base.converter, [...base.orders, ...constraints]);
}

export function refEqual(a: DocumentReference, b: DocumentReference) {
  return a.path === b.path && a.converter === b.converter;
}

export function queryEqual(a: Query, b: Query) {
  return (
    a.path === b.path &&
    a.converter === b.converter &&
    a.type === b.type &&
    JSON.stringify(a.orders) === JSON.stringify(b.orders)
  );
}

/* ---------- snapshots ---------- */

function rawSnap(path: string, data: Data | undefined) {
  const id = path.split('/').pop() as string;
  return {
    id,
    ref: new DocumentReference(path),
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
  };
}

function docSnap(path: string, converter: Converter) {
  const data = store.get(path);
  const raw = rawSnap(path, data);
  return {
    ...raw,
    data: (options?: unknown) =>
      data === undefined ? undefined : converter ? converter.fromFirestore(raw, options) : raw.data(),
  };
}

function isChildOf(docPath: string, colPath: string) {
  return docPath.startsWith(`${colPath}/`) && !docPath.slice(colPath.length + 1).includes('/');
}

function querySnap(q: Query) {
  let paths = [...store.keys()].filter((p) => isChildOf(p, q.path));
  for (const o of [...q.orders].reverse()) {
    paths = paths.sort((a, b) => {
      const x = store.get(a)?.[o.field] as any;
      const y = store.get(b)?.[o.field] as any;
      const xv = x instanceof Timestamp ? x.toMillis() : x;
      const yv = y instanceof Timestamp ? y.toMillis() : y;
      const c = xv < yv ? -1 : xv > yv ? 1 : 0;
      return o.dir === 'desc' ? -c : c;
    });
  }
  const docs = paths.map((p) => docSnap(p, q.converter));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: unknown) => void) => docs.forEach(fn) };
}

/* ---------- listeners ---------- */

type Listener = { target: DocumentReference | Query; next: (s: any) => void };
const listeners = new Set<Listener>();

function emit(l: Listener) {
  const t = l.target;
  l.next(t instanceof DocumentReference ? docSnap(t.path, t.converter) : querySnap(t));
}

let notifyQueued = false;
function notifyAll() {
  persist();
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    for (const l of listeners) emit(l);
  });
}

export function onSnapshot(target: DocumentReference | Query, next: (s: any) => void) {
  const l: Listener = { target, next };
  listeners.add(l);
  const timer = setTimeout(() => {
    if (listeners.has(l)) emit(l);
  }, latencyMs);
  return () => {
    clearTimeout(timer);
    listeners.delete(l);
  };
}

/* ---------- writes ---------- */

function resolve(value: unknown, prev: unknown): unknown {
  if (value instanceof Sentinel) {
    if (value.op === 'serverTimestamp') return Timestamp.now();
    if (value.op === 'increment') return (typeof prev === 'number' ? prev : 0) + value.n;
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, undefined));
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) {
    const out: Data = {};
    for (const [k, v] of Object.entries(value as Data)) {
      if (v instanceof Sentinel && v.op === 'delete') continue;
      out[k] = resolve(v, (prev as Data | undefined)?.[k]);
    }
    return out;
  }
  return value;
}

function apply(path: string, data: Data, merge: boolean) {
  const prev = merge ? (store.get(path) ?? {}) : {};
  const next: Data = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Sentinel && v.op === 'delete') delete next[k];
    else next[k] = resolve(v, prev[k]);
  }
  store.set(path, next);
}

function toData(ref: DocumentReference, data: any, merge = false): Data {
  return ref.converter ? ref.converter.toFirestore(data, merge ? { merge } : undefined) : data;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function setDoc(ref: DocumentReference, data: any, options?: { merge?: boolean }) {
  apply(ref.path, toData(ref, data, options?.merge), Boolean(options?.merge));
  notifyAll();
  await tick();
}

export async function updateDoc(ref: DocumentReference, data: any) {
  if (!store.has(ref.path)) {
    const err = new Error(`No document to update: ${ref.path}`) as Error & { code: string };
    err.code = 'not-found';
    throw err;
  }
  apply(ref.path, data, true);
  notifyAll();
  await tick();
}

export async function addDoc(col: CollectionReference, data: any) {
  const ref = new DocumentReference(`${col.path}/${newId()}`, col.converter);
  apply(ref.path, toData(ref, data), false);
  notifyAll();
  await tick();
  return ref;
}

export async function deleteDoc(ref: DocumentReference) {
  store.delete(ref.path);
  notifyAll();
  await tick();
}

export async function getDoc(ref: DocumentReference) {
  await tick();
  return docSnap(ref.path, ref.converter);
}

export async function getDocs(q: Query) {
  await tick();
  return querySnap(q);
}

export function writeBatch() {
  const ops: (() => void)[] = [];
  return {
    set(ref: DocumentReference, data: any, options?: { merge?: boolean }) {
      ops.push(() => apply(ref.path, toData(ref, data, options?.merge), Boolean(options?.merge)));
    },
    update(ref: DocumentReference, data: any) {
      ops.push(() => apply(ref.path, data, true));
    },
    delete(ref: DocumentReference) {
      ops.push(() => store.delete(ref.path));
    },
    async commit() {
      ops.forEach((op) => op());
      notifyAll();
      await tick();
    },
  };
}
