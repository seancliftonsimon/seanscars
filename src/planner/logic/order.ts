import { ORDER_GAP } from './records';

/*
 * Drag-reorder helpers for ordered lists (`order` values with gaps of
 * ORDER_GAP), so a move usually rewrites a single record.
 */

/**
 * New `order` for an item moved to `toIndex` in `list` (the current sorted
 * list, including the moved item at `fromIndex`).
 *
 * Returns the midpoint between the item's new neighbours; at the start it is
 * next.order - ORDER_GAP, at the end prev.order + ORDER_GAP (any number is
 * allowed).
 *
 * Returns null in two different situations:
 * - fromIndex === toIndex (or an index is out of range): nothing moves, write nothing.
 * - the new neighbours are less than 2 apart, so no integer fits between
 *   them: the caller should `renumber(moveItem(list, from, to))` instead.
 */
export function orderForMove(
  list: { id: string; order: number }[],
  fromIndex: number,
  toIndex: number,
): number | null {
  if (fromIndex === toIndex) return null;
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return null;
  const rest = list.filter((_, i) => i !== fromIndex);
  const prev = rest[toIndex - 1];
  const next = rest[toIndex];
  if (!prev && !next) return null;
  if (!prev) return next.order - ORDER_GAP;
  if (!next) return prev.order + ORDER_GAP;
  if (next.order - prev.order < 2) return null;
  return Math.floor((prev.order + next.order) / 2);
}

/** Renumbers ids (in the given final order) to ORDER_GAP, 2*ORDER_GAP, ...; returns only those whose order changes. */
export function renumber(
  list: { id: string; order: number }[],
): { id: string; order: number }[] {
  const out: { id: string; order: number }[] = [];
  list.forEach((item, i) => {
    const order = (i + 1) * ORDER_GAP;
    if (item.order !== order) out.push({ id: item.id, order });
  });
  return out;
}

/** Applies arrayMove semantics: returns the list with item at fromIndex moved to toIndex. */
export function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...list];
  if (fromIndex < 0 || fromIndex >= copy.length) return copy;
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(Math.max(0, Math.min(toIndex, copy.length)), 0, item);
  return copy;
}
