import { describe, expect, it } from 'vitest';
import { csvToObjects, missingHeaders, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted commas and escaped quotes', () => {
    expect(parseCsv('"Example, Ada","say ""hi"""')).toEqual([['Example, Ada', 'say "hi"']]);
  });

  it('keeps newlines inside quotes', () => {
    expect(parseCsv('"a\nb","c\r\nd"\nx,y')).toEqual([
      ['a\nb', 'c\r\nd'],
      ['x', 'y'],
    ]);
  });

  it('handles CRLF and lone CR line breaks', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\rb')).toEqual([['a'], ['b']]);
  });

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿name,role\nAda Example,host')[0]).toEqual(['name', 'role']);
  });

  it('does not add a row for a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('')).toEqual([]);
  });

  it('keeps empty trailing cells', () => {
    expect(parseCsv('a,,')).toEqual([['a', '', '']]);
  });

  it('is lenient about unterminated quotes', () => {
    expect(parseCsv('a,"b,c\nd')).toEqual([['a', 'b,c\nd']]);
  });
});

describe('csvToObjects', () => {
  it('trims and lowercases headers and trims values', () => {
    const t = csvToObjects(' Name , Role \n Ada Example , host \n');
    expect(t.headers).toEqual(['name', 'role']);
    expect(t.rows).toEqual([{ name: 'Ada Example', role: 'host' }]);
  });

  it('skips blank lines', () => {
    const t = csvToObjects('name\n\nAda Example\n  ,  \n\nGrace Sample\n');
    expect(t.rows).toEqual([{ name: 'Ada Example' }, { name: 'Grace Sample' }]);
  });

  it('fills missing trailing cells and ignores extras', () => {
    const t = csvToObjects('name,role\nAda Example\nGrace Sample,host,extra');
    expect(t.rows).toEqual([
      { name: 'Ada Example', role: '' },
      { name: 'Grace Sample', role: 'host' },
    ]);
  });

  it('returns an empty table for empty input', () => {
    expect(csvToObjects('')).toEqual({ headers: [], rows: [] });
  });
});

describe('missingHeaders', () => {
  it('reports absent required headers case-insensitively', () => {
    expect(missingHeaders(['name', 'role'], ['Name', 'email', 'ROLE'])).toEqual(['email']);
  });

  it('returns nothing when all are present', () => {
    expect(missingHeaders(['a'], ['A'])).toEqual([]);
  });
});
