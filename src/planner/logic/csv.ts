/*
 * Minimal CSV parsing for planner imports (no runtime dependencies).
 * Follows RFC 4180 conventions and is lenient about malformed input.
 */

/**
 * RFC 4180-style parse: quoted fields, "" escapes, commas and CR/LF/CRLF line
 * breaks inside quotes. Strips a leading BOM; a trailing newline adds no row.
 * Blank lines are kept as `['']` (csvToObjects skips them). An unterminated
 * quote consumes the rest of the input as that field.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let pending = false; // true when the current row has any content or delimiter

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      pending = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      pending = true;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      pending = false;
    } else {
      field += ch;
      pending = true;
    }
  }
  if (pending || inQuotes) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parses text and maps rows to objects keyed by header. Skips fully blank rows. */
export function csvToObjects(text: string): CsvTable {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { headers: [], rows: [] };
  const headers = parsed[0].map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (const cells of parsed.slice(1)) {
    if (cells.every((c) => c.trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** Required headers not present in `headers` (case-insensitive). */
export function missingHeaders(headers: string[], required: string[]): string[] {
  const have = new Set(headers.map((h) => h.trim().toLowerCase()));
  return required.filter((r) => !have.has(r.trim().toLowerCase()));
}
