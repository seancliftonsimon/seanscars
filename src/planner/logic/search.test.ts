import { describe, expect, it } from 'vitest';
import { search, type SearchItem } from './search';

const items: SearchItem[] = [
  { id: '1', kind: 'person', title: 'Avery Quill', href: '#', keywords: 'avery@example.com' },
  { id: '2', kind: 'award', title: 'Best Supporting Pet', href: '#' },
  { id: '3', kind: 'piece', title: 'Pet montage', href: '#' },
  { id: '4', kind: 'question', title: 'Do we serve dinner?', href: '#', keywords: 'Potluck' },
  { id: '5', kind: 'film', title: 'Café Society', href: '#' },
];

describe('search', () => {
  it('ranks prefix over word-start over substring', () => {
    expect(search(items, 'pet').map((i) => i.id)).toEqual(['3', '2']);
  });
  it('needs every word to match', () => {
    expect(search(items, 'best pet').map((i) => i.id)).toEqual(['2']);
    expect(search(items, 'best dog')).toEqual([]);
  });
  it('matches keywords and ignores accents', () => {
    expect(search(items, 'potluck')[0].id).toBe('4');
    expect(search(items, 'cafe')[0].id).toBe('5');
    expect(search(items, 'example.com')[0].id).toBe('1');
  });
  it('returns nothing for an empty query', () => {
    expect(search(items, '  ')).toEqual([]);
  });
});
