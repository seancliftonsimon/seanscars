import type { Song, SongLine, SongSection } from '../types';

/*
 * Parody-writing helpers: syllable counts, rhyme letters, and turning a
 * pasted lyric sheet into sections and lines. English spelling is
 * irregular, so counts and rhymes are approximate on purpose: good enough
 * to flag a line that is clearly long or a rhyme that clearly broke.
 */

/* ---------- words ---------- */

/** Text in (parentheses) or [brackets] is an ad-lib or a label: not sung on the beat. */
export function singableText(line: string): string {
  return line.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
}

export function words(line: string): string[] {
  return singableText(line)
    .split(/[\s—–/-]+/)
    .map((w) => w.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, ''))
    .filter((w) => /[a-z0-9]/.test(w));
}

const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  every: 2, everything: 3, everyone: 3, everybody: 4, evening: 2, different: 3, family: 3, chocolate: 2,
  business: 2, beautiful: 3, people: 2, little: 2, fire: 1, hour: 1, hours: 1, our: 1, being: 2,
  really: 2, idea: 3, ideas: 3, poem: 2, quiet: 2, science: 2, video: 3, radio: 3, area: 3,
  the: 1, are: 1, were: 1, there: 1, where: 1, here: 1, more: 1, before: 2, maybe: 2, baby: 2,
  lady: 2, movie: 2, movies: 2, cookie: 2, sometimes: 2, somewhere: 2, someone: 2, whatever: 3,
  forever: 3, every1: 3, oscar: 2, oscars: 2, seanscars: 2, sharemony: 4, awards: 2, cinema: 3,
  creature: 2, natural: 3, favorite: 3, interesting: 3, actually: 4, usually: 4, naturally: 4,
  queen: 1, queens: 1, being1: 2, lion: 2, iron: 2, prayer: 1, layer: 2, player: 2,
};

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Approximate syllables in one word ("shinin'" → 2, "seventeen" → 3). */
export function wordSyllables(raw: string): number {
  let w = raw.toLowerCase().replace(/[‘’]/g, "'");
  if (/^\d+$/.test(w)) {
    // Read digits out one by one ("17" → "one seven"); close enough for a count.
    return w.split('').reduce((n, d) => n + wordSyllables(DIGIT_WORDS[Number(d)]), 0);
  }
  w = w.replace(/in'$/, 'ing').replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (SYLLABLE_EXCEPTIONS[w] !== undefined) return SYLLABLE_EXCEPTIONS[w];
  if (w.length <= 3) return 1;

  let n = 0;
  let s = w;
  // Silent endings: a final "e" (not "-le"), "-es"/"-ed" that don't add a syllable.
  if (/[^aeiouy]e$/.test(s) && !/[^aeiouy]le$/.test(s)) s = s.slice(0, -1);
  else if (/[^aeiouy]es$/.test(s) && !/(s|x|z|ch|sh|c|g)es$/.test(s)) s = s.slice(0, -2);
  else if (/[^aeiouy]ed$/.test(s) && !/[td]ed$/.test(s)) s = s.slice(0, -2);
  s = s.replace(/^y/, '');
  const groups = s.match(/[aeiouy]+/g) ?? [];
  n = groups.length;
  // Vowel pairs that are usually two syllables.
  n += (s.match(/ia|io(?!u)|iu|eo|ua|uo|ya|yo/g) ?? []).length;
  // "-le" after a consonant is its own syllable ("little" handled above, "able").
  return Math.max(1, n);
}

/** Approximate syllables in a sung line; ad-libs in (parentheses) don't count. */
export function lineSyllables(line: string): number {
  return words(line).reduce((n, w) => n + wordSyllables(w), 0);
}

/* ---------- rhyme ---------- */

/** The last sung word of a line, or '' for an empty line. */
export function lastWord(line: string): string {
  const ws = words(line);
  return ws[ws.length - 1] ?? '';
}

const OW_AS_IN_NOW = new Set(['now', 'how', 'cow', 'wow', 'vow', 'allow', 'brow', 'plow', 'chow', 'somehow', 'eyebrow', 'meow']);
const EY_AS_IN_THEY = new Set(['they', 'hey', 'grey', 'obey', 'prey', 'survey', 'convey']);

/** Common words whose spelling misleads the rules below. */
const RHYME_EXCEPTIONS: Record<string, string> = {
  are: 'ar', the: 'u', a: 'u', of: 'uv', love: 'uv', above: 'uv', glove: 'uv', dove: 'uv',
  come: 'um', some: 'um', done: 'un', none: 'un', one: 'un', won: 'un', gone: 'on', give: 'iv',
  live: 'iv', have: 'av', were: 'ur', there: 'Ar', where: 'Ar', their: 'Ar', "they're": 'Ar', bear: 'Ar',
  wear: 'Ar', swear: 'Ar', pear: 'Ar', heart: 'art', you: 'U', to: 'U', do: 'U', who: 'U', two: 'U',
  through: 'U', though: 'O', was: 'uz', said: 'ed', says: 'ez', again: 'en', eyes: 'Iz', buy: 'I', by: 'I',
};

const ENDINGS: [RegExp, string][] = [
  [/(tion|sion|cian)$/, 'shun'],
  [/(ight|ite|yte)$/, 'Ite'],
  [/ign$/, 'Ine'],
  [/(igh|eye|aye|uy)$/, 'I'],
  [/air$/, 'Ar'],
  [/eigh$/, 'A'],
  [/(ay|ai)$/, 'A'],
  [/(ee|ie|ei|ey)$/, 'E'],
  [/(ew|ue|oo)$/, 'U'],
  [/(ough|oe|ow)$/, 'O'],
];

/** A spelling-based sound key for a word's ending; equal keys ≈ rhyme. */
export function rhymeKey(raw: string): string {
  let w = raw.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/in'$/, 'ing').replace(/[^a-z]/g, '');
  if (!w) return '';
  if (RHYME_EXCEPTIONS[w]) return RHYME_EXCEPTIONS[w];
  if (OW_AS_IN_NOW.has(w)) return 'au';
  if (EY_AS_IN_THEY.has(w)) return 'A';
  // Plurals and third-person "s" rhyme with the bare word ("stars" ~ "cars").
  if (/[^su']s$/.test(w) && w.length > 3) w = w.slice(0, -1);
  // "-ing" words rhyme on the syllable before ("shining" ~ "lining").
  let tail = '';
  if (/[aeiouy][^aeiouy]+ing$/.test(w)) {
    tail = 'ing';
    w = w.slice(0, -3);
  }
  w = w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/ea/g, 'ee').replace(/([^aeiou])y(?=[^aeiou])/g, '$1i');

  let matched = false;
  for (const [re, rep] of ENDINGS) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      matched = true;
      break;
    }
  }
  if (!matched) {
    const magic = /([aeiouy])([^aeiouy]{1,2})e$/.exec(w);
    if (magic) {
      // Magic e: vowel + consonant + e is a long vowel ("fame" → "Am").
      const v = magic[1] === 'y' ? 'I' : magic[1].toUpperCase();
      w = w.slice(0, magic.index) + v + magic[2];
    } else if (/^[^aeiouy]*e$/.test(w)) {
      w = w.slice(0, -1) + 'E'; // "me", "be", "she"
    } else if (/[^aeiou]y$/.test(w)) {
      // One-syllable "fly" says I; longer "happy" says E.
      w = w.slice(0, -1) + (wordSyllables(raw) <= 1 ? 'I' : 'E');
    } else if (/^[^aeiouy]*o$/.test(w)) {
      w = w.slice(0, -1) + 'O'; // "go", "no", "so"
    }
  }
  // From the last vowel sound to the end.
  const m = /[aeiouyAEIOU]+[^aeiouyAEIOU]*$/.exec(w);
  return (m ? m[0] : w) + tail;
}

export function rhymes(a: string, b: string): boolean {
  const ka = rhymeKey(a);
  return ka !== '' && ka === rhymeKey(b) && a.toLowerCase() !== b.toLowerCase();
}

/**
 * Rhyme letters for a run of lines: lines whose endings rhyme share a
 * letter (A, B, …); a line with no partner gets null; blank lines get null.
 */
export function rhymeScheme(lines: string[]): (string | null)[] {
  const keys = lines.map((l) => rhymeKey(lastWord(l)));
  const counts = new Map<string, number>();
  keys.forEach((k) => k && counts.set(k, (counts.get(k) ?? 0) + 1));
  const letters = new Map<string, string>();
  return keys.map((k) => {
    if (!k || (counts.get(k) ?? 0) < 2) return null;
    if (!letters.has(k)) letters.set(k, String.fromCharCode(65 + (letters.size % 26)));
    return letters.get(k)!;
  });
}

export type MeterFit = 'match' | 'close' | 'off' | 'empty';

/** How the rewrite's syllables compare with the original's. */
export function meterFit(original: string, mine: string): MeterFit {
  if (!mine.trim()) return 'empty';
  const d = Math.abs(lineSyllables(mine) - lineSyllables(original));
  return d === 0 ? 'match' : d === 1 ? 'close' : 'off';
}

export type RhymeFit = 'kept' | 'broken' | 'none';

/**
 * Whether each rewritten line keeps the original's rhyme: for every pair of
 * lines that rhyme in the original and both have a rewrite, the rewrites
 * should rhyme too. 'none' = nothing to check for that line yet.
 */
export function rhymeFits(lines: Pick<SongLine, 'original' | 'mine'>[]): RhymeFit[] {
  const scheme = rhymeScheme(lines.map((l) => l.original));
  return lines.map((line, i) => {
    const letter = scheme[i];
    if (!letter || !line.mine.trim()) return 'none';
    const partners = lines.filter((other, j) => j !== i && scheme[j] === letter && other.mine.trim());
    if (partners.length === 0) return 'none';
    const mineKey = rhymeKey(lastWord(line.mine));
    return partners.some((p) => rhymeKey(lastWord(p.mine)) === mineKey) ? 'kept' : 'broken';
  });
}

/* ---------- pasting a lyric sheet ---------- */

const SECTION_WORDS = 'intro|verse|pre-?chorus|chorus|post-?chorus|bridge|hook|refrain|outro|interlude|breakdown|drop|instrumental';
const HEADER = new RegExp(`^\\s*[\\[(]?\\s*((?:${SECTION_WORDS})\\b[^\\])]*?)\\s*[\\])]?\\s*:?\\s*$`, 'i');

function cleanLabel(raw: string): { label: string; singer?: string } {
  const [head, ...rest] = raw.split(':');
  const label = head.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const singer = rest.join(':').trim();
  return singer ? { label, singer } : { label };
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Splits pasted lyrics into sections: a "[Chorus]" / "Verse 2:" style
 * header or a blank line starts a new one. Unlabelled sections are named
 * Verse 1, Verse 2…; a section whose lines repeat an earlier one is marked
 * as a repeat of it (so a chorus is rewritten once).
 */
export function parseLyrics(text: string, makeId: () => string = newId): SongSection[] {
  const sections: SongSection[] = [];
  let current: SongSection | null = null;
  let pendingLabel: { label: string; singer?: string } | null = null;

  const start = (label: { label: string; singer?: string } | null) => {
    current = { id: makeId(), label: label?.label ?? '', lines: [] };
    sections.push(current);
    return label?.singer;
  };
  let singer: string | undefined;

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const header = HEADER.exec(line);
    if (header) {
      pendingLabel = cleanLabel(header[1]);
      current = null;
      continue;
    }
    if (!line) {
      current = null;
      continue;
    }
    if (!current) {
      singer = start(pendingLabel);
      pendingLabel = null;
    }
    current!.lines.push({ id: makeId(), original: line, mine: '', ...(singer ? { singer } : {}) });
  }

  // Name the unlabelled ones and mark exact repeats.
  let verse = 0;
  const seen: SongSection[] = [];
  for (const s of sections) {
    const text = s.lines.map((l) => l.original.toLowerCase()).join('\n');
    const twin = seen.find((p) => p.lines.map((l) => l.original.toLowerCase()).join('\n') === text);
    if (twin) {
      s.repeatOf = twin.id;
      if (!s.label) s.label = twin.label;
    } else if (!s.label) {
      verse += 1;
      s.label = `Verse ${verse}`;
    }
    seen.push(s);
  }
  return sections.filter((s) => s.lines.length > 0);
}

/** New originals, keeping the rewrites already written, line for line in order. */
export function replaceOriginals(old: SongSection[], fresh: SongSection[]): SongSection[] {
  const mine = old.flatMap((s) => s.lines.map((l) => ({ mine: l.mine, singer: l.singer, cue: l.cue })));
  let i = 0;
  return fresh.map((s) => ({
    ...s,
    lines: s.lines.map((l) => {
      const kept = mine[i++];
      return kept ? { ...l, mine: kept.mine, ...(kept.singer ? { singer: kept.singer } : {}), ...(kept.cue ? { cue: kept.cue } : {}) } : l;
    }),
  }));
}

/* ---------- reading a song back ---------- */

/** The rewrite of a section, filling a repeat's blank lines from the section it repeats. */
export function resolvedMine(song: Pick<Song, 'sections'>, section: SongSection): string[] {
  const source = section.repeatOf ? song.sections.find((s) => s.id === section.repeatOf) : undefined;
  return section.lines.map((l, i) => l.mine.trim() || source?.lines[i]?.mine.trim() || '');
}

export interface SongProgress {
  written: number;
  total: number;
  /** Lines whose syllable count is off by two or more. */
  off: number;
}

export function songProgress(song: Pick<Song, 'sections'>): SongProgress {
  let written = 0;
  let total = 0;
  let off = 0;
  for (const s of song.sections) {
    const mine = resolvedMine(song, s);
    s.lines.forEach((l, i) => {
      total += 1;
      if (mine[i]) written += 1;
      if (mine[i] && meterFit(l.original, mine[i]) === 'off') off += 1;
    });
  }
  return { written, total, off };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Two columns, Original | My lyrics, as HTML (pastes as a Google Docs table) and as tab-separated text. */
export function songAsTable(song: Pick<Song, 'title' | 'artist' | 'sections'>): { html: string; text: string } {
  const rows: string[] = [];
  const text: string[] = [`Original\tMy lyrics`];
  for (const s of song.sections) {
    const mine = resolvedMine(song, s);
    rows.push(`<tr><td colspan="2"><b>${escapeHtml(s.label)}</b></td></tr>`);
    text.push(`[${s.label}]\t`);
    s.lines.forEach((l, i) => {
      const who = l.singer ? `[${l.singer}] ` : '';
      rows.push(`<tr><td>${escapeHtml(l.original)}</td><td>${escapeHtml(who + mine[i])}</td></tr>`);
      text.push(`${l.original}\t${who}${mine[i]}`);
    });
  }
  const title = escapeHtml(`${song.title}${song.artist ? ` (${song.artist})` : ''}`);
  return {
    html: `<p><b>${title}</b></p><table border="1"><tr><th>Original</th><th>My lyrics</th></tr>${rows.join('')}</table>`,
    text: text.join('\n'),
  };
}

/**
 * Names from the season (films, people, contenders) with a word that
 * rhymes with `word`, for the rhyme drawer.
 */
export function rhymingNames(word: string, names: string[], max = 12): string[] {
  const key = rhymeKey(word);
  if (!key) return [];
  const out: string[] = [];
  for (const name of new Set(names)) {
    if (name.trim().toLowerCase() === word.toLowerCase()) continue;
    if (words(name).some((w) => w !== word.toLowerCase() && rhymeKey(w) === key)) out.push(name);
    if (out.length >= max) break;
  }
  return out;
}
