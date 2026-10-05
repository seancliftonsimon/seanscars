/*
 * Ranking for the command palette: prefix matches beat word-start matches
 * beat substring matches; every query word has to match somewhere.
 */

export interface SearchItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Extra text that matches but isn't shown (aliases, emails, answers). */
  keywords?: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function scoreWord(word: string, title: string, rest: string): number {
  if (title.startsWith(word)) return 4;
  if (title.split(/[^a-z0-9]+/).some((w) => w.startsWith(word))) return 3;
  if (title.includes(word)) return 2;
  if (rest.includes(word)) return 1;
  return 0;
}

export function search(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = norm(item.title);
    const rest = norm(`${item.subtitle ?? ''} ${item.keywords ?? ''}`);
    let score = 0;
    for (const w of words) {
      const s = scoreWord(w, title, rest);
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score > 0) scored.push({ item, score: score - title.length / 1000 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
