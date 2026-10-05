import { describe, expect, it } from 'vitest';
import {
  lastWord,
  lineSyllables,
  meterFit,
  parseLyrics,
  replaceOriginals,
  resolvedMine,
  rhymeFits,
  rhymeKey,
  rhymeScheme,
  rhymes,
  rhymingNames,
  songAsTable,
  songProgress,
  wordSyllables,
} from './lyrics';

// Public-domain lyrics only.
const TWINKLE = `[Verse 1]
Twinkle, twinkle, little star
How I wonder what you are
Up above the world so high
Like a diamond in the sky

[Chorus]
Twinkle, twinkle, little star
How I wonder what you are

Twinkle, twinkle, little star
How I wonder what you are`;

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

describe('syllables', () => {
  it('counts common words', () => {
    const cases: [string, number][] = [
      ['star', 1], ['twinkle', 2], ['little', 2], ['wonder', 2], ['diamond', 3], ['above', 2],
      ['shining', 2], ["shinin'", 2], ['wanted', 2], ['played', 1], ['boxes', 2], ['makes', 1],
      ['beautiful', 3], ['the', 1], ['movie', 2], ['oscars', 2], ['chocolate', 2], ['seventeen', 3],
    ];
    for (const [w, n] of cases) expect([w, wordSyllables(w)]).toEqual([w, n]);
  });
  it('counts a line, skipping ad-libs and labels', () => {
    expect(lineSyllables('Twinkle, twinkle, little star')).toBe(7);
    expect(lineSyllables('So much to see on the big screen (hah)')).toBe(8);
    expect(lineSyllables('[CASSIE] I feel such dread')).toBe(4);
  });
  it('rates the fit of a rewrite', () => {
    expect(meterFit('Twinkle, twinkle, little star', 'Sparkle, sparkle, movie star')).toBe('match');
    expect(meterFit('Twinkle, twinkle, little star', 'Sparkle, sparkle, big star')).toBe('close');
    expect(meterFit('Twinkle, twinkle, little star', 'Star')).toBe('off');
    expect(meterFit('Twinkle', '  ')).toBe('empty');
  });
});

describe('rhyme', () => {
  it('finds the last sung word', () => {
    expect(lastWord('We had Minecraft Steve, and Chicken Jockey (hah)')).toBe('jockey');
    expect(lastWord('')).toBe('');
  });
  it('matches common rhymes and rejects non-rhymes', () => {
    const yes = [
      ['star', 'are'], ['high', 'sky'], ['fame', 'name'], ['night', 'bite'], ['day', 'away'], ['see', 'key'],
      ['go', 'show'], ['stars', 'oscars'], ['shining', 'lining'], ['dream', 'team'], ['screen', 'seen'],
      ['movie', 'groovy'], ['now', 'how'], ['they', 'play'], ['blue', 'crew'], ['love', 'above'], ['there', 'care'],
      ['hair', 'where'],
    ];
    for (const [a, b] of yes) expect([a, b, rhymes(a, b)]).toEqual([a, b, true]);
    const no = [['star', 'high'], ['go', 'now'], ['fame', 'fan'], ['screen', 'scream'], ['star', 'star']];
    for (const [a, b] of no) expect([a, b, rhymes(a, b)]).toEqual([a, b, false]);
    expect(rhymeKey('')).toBe('');
  });
  it('letters a rhyme scheme, leaving unpaired lines unlettered', () => {
    expect(rhymeScheme(['Twinkle little star', 'what you are', 'world so high', 'in the sky', 'all alone', ''])).toEqual([
      'A', 'A', 'B', 'B', null, null,
    ]);
  });
  it('checks that a rewrite keeps the rhymes', () => {
    const fits = rhymeFits([
      { original: 'Twinkle little star', mine: 'Sparkle movie star' },
      { original: 'How I wonder what you are', mine: 'Driving up in fancy cars' },
      { original: 'Up above the world so high', mine: 'On the screen so very tall' },
      { original: 'Like a diamond in the sky', mine: 'Like a balloon that floats away' },
      { original: 'Last line', mine: '' },
    ]);
    expect(fits).toEqual(['kept', 'kept', 'broken', 'broken', 'none']);
  });
  it('finds rhyming names from the season', () => {
    expect(rhymingNames('key', ['Sydney Sweeney', 'The Substance', 'Marty Supreme', 'Key Largo', 'Bugonia'])).toEqual([
      'Sydney Sweeney',
      'Marty Supreme',
    ]);
    expect(rhymingNames('', ['x'])).toEqual([]);
  });
});

describe('pasting lyrics', () => {
  it('splits by headers and blank lines, labels verses, and marks repeats', () => {
    const s = parseLyrics(TWINKLE, ids());
    expect(s.map((x) => [x.label, x.lines.length, x.repeatOf ?? null])).toEqual([
      ['Verse 1', 4, null],
      ['Chorus', 2, null],
      ['Chorus', 2, s[1].id],
    ]);
    expect(s[0].lines[0]).toEqual({ id: 'id2', original: 'Twinkle, twinkle, little star', mine: '' });
  });
  it('names unlabelled sections and keeps a singer from the header', () => {
    const s = parseLyrics('one line\ntwo line\n\n[Verse 2: Zara Larsson]\nthree line\n\n(Bridge)\nfour line', ids());
    expect(s.map((x) => x.label)).toEqual(['Verse 1', 'Verse 2', 'Bridge']);
    expect(s[1].lines[0].singer).toBe('Zara Larsson');
  });
  it('keeps rewrites in order when the originals are re-pasted', () => {
    const old = parseLyrics('a\nb', ids());
    old[0].lines[0].mine = 'my a';
    old[0].lines[1].mine = 'my b';
    old[0].lines[1].singer = 'Both';
    const next = replaceOriginals(old, parseLyrics('A\nB\nC', ids()));
    expect(next[0].lines.map((l) => [l.original, l.mine, l.singer ?? null])).toEqual([
      ['A', 'my a', null], ['B', 'my b', 'Both'], ['C', '', null],
    ]);
  });
});

describe('reading a song back', () => {
  const sections = parseLyrics(TWINKLE, ids());
  sections[1].lines[0].mine = 'Sparkle, sparkle, movie star';
  sections[0].lines[0].mine = 'Star';
  const song = { title: 'Twinkle', artist: 'Traditional', sections };

  it('fills a repeated chorus from the first one', () => {
    expect(resolvedMine(song, sections[2])).toEqual(['Sparkle, sparkle, movie star', '']);
  });
  it('counts progress including repeats', () => {
    expect(songProgress(song)).toEqual({ written: 3, total: 8, off: 1 });
  });
  it('exports two columns for Google Docs', () => {
    const t = songAsTable(song);
    expect(t.html).toContain('<th>Original</th><th>My lyrics</th>');
    expect(t.html).toContain('<td>Twinkle, twinkle, little star</td><td>Sparkle, sparkle, movie star</td>');
    expect(t.text.split('\n')[0]).toBe('Original\tMy lyrics');
  });
});
