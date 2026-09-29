/*
 * Deterministic document ids for imported records, so re-running an
 * importer writes the same documents instead of adding duplicates.
 */

/** Lowercase, ASCII-only, dash-separated; at most 80 characters. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug || 'item';
}

/** e.g. `importDocId('film', 'the example movie')` → `imp-film-the-example-movie`. */
export function importDocId(prefix: string, importKey: string): string {
  return `imp-${prefix}-${slugify(importKey)}`;
}

/** Items of `list` whose computed id repeats an earlier one's. */
export function duplicateIds<T>(list: T[], idOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const id = idOf(item);
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
}
