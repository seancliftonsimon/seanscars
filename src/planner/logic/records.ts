/*
 * Pure helpers for preparing planner records before they are written to
 * Firestore. Firestore rejects `undefined` values, so optional fields that
 * are unset must be removed (on create) or deleted (on update).
 */

/** Gap between consecutive `order` values in ordered lists. */
export const ORDER_GAP = 1000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-copies plain objects and arrays, dropping `undefined` object values
 * and array items. Non-plain objects (Timestamps, FieldValue sentinels,
 * Dates) are passed through untouched.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => stripUndefined(item)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = stripUndefined(item);
    }
    return out as T;
  }
  return value;
}

/**
 * Prepares a partial update: top-level `undefined` values become `sentinel`
 * (callers pass Firestore's `deleteField()`), everything else is stripped
 * with `stripUndefined`. Keys absent from the patch are left alone.
 */
export function prepareUpdate(
  patch: Record<string, unknown>,
  sentinel: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    const item = patch[key];
    out[key] = item === undefined ? sentinel : stripUndefined(item);
  }
  return out;
}

/** Returns a copy of `record` without its `id` key. */
export function omitId<T extends { id?: unknown }>(record: T): Omit<T, 'id'> {
  const copy: Record<string, unknown> = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

/** The `order` value for a new item appended after `items`. */
export function nextOrder(items: ReadonlyArray<{ order: number }>): number {
  if (items.length === 0) return ORDER_GAP;
  const max = Math.max(...items.map((item) => (Number.isFinite(item.order) ? item.order : 0)));
  return (Math.floor(max / ORDER_GAP) + 1) * ORDER_GAP;
}
