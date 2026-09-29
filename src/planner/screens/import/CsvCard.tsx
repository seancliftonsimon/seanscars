import { useState, type DragEvent, type ReactNode } from 'react';
import { csvToObjects, missingHeaders } from '../../logic/csv';
import { errorMessage } from '../../errors';

export interface PreviewItem {
  importKey: string;
  problems: string[];
}

export interface CsvImporter<T extends PreviewItem> {
  title: string;
  /** Suggested file name, shown as a hint. */
  fileHint: string;
  headers: string[];
  columns: string[];
  map: (rows: Record<string, string>[]) => T[];
  cells: (item: T) => ReactNode[];
  /** Writes the rows without problems; resolves to a status line. */
  run: (items: T[]) => Promise<string>;
  /** Why importing is blocked right now (e.g. no target season). */
  blocked?: string;
}

interface Loaded<T> {
  fileName: string;
  missing: string[];
  items: T[];
}

/** One importer: pick, drop or paste a CSV, preview it, then import. */
export default function CsvCard<T extends PreviewItem>({ importer }: { importer: CsvImporter<T> }) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load(text: string, fileName: string) {
    const table = csvToObjects(text);
    const missing = missingHeaders(table.headers, importer.headers);
    setLoaded({ fileName, missing, items: missing.length ? [] : importer.map(table.rows) });
    setMessage(null);
  }

  async function loadFile(file: File | undefined) {
    if (file) load(await file.text(), file.name);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  }

  const good = loaded?.items.filter((item) => item.problems.length === 0) ?? [];
  const bad = (loaded?.items.length ?? 0) - good.length;

  async function handleImport() {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await importer.run(good));
    } catch (err) {
      setMessage(`Import failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pl-panel pl-import-card">
      <h2>{importer.title}</h2>
      <p className="pl-muted">
        {importer.fileHint} · columns: {importer.headers.join(', ')}
      </p>

      <div
        className={dragging ? 'pl-dropzone is-dragging' : 'pl-dropzone'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <label className="pl-btn">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <span className="pl-muted">or drop it here, or</span>
        <button type="button" className="pl-link-btn" onClick={() => setPasting((p) => !p)}>
          paste it
        </button>
      </div>

      {pasting && (
        <div className="pl-paste">
          <textarea
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={importer.headers.join(',')}
            aria-label={`Paste ${importer.fileHint}`}
          />
          <button type="button" className="pl-btn" onClick={() => load(pasteText, 'pasted text')}>
            Preview
          </button>
        </div>
      )}

      {loaded && loaded.missing.length > 0 && (
        <p className="pl-error">
          {loaded.fileName} is missing columns: {loaded.missing.join(', ')}
        </p>
      )}

      {loaded && loaded.missing.length === 0 && (
        <>
          <p>
            <strong>{loaded.items.length}</strong> rows from {loaded.fileName}
            {bad > 0 && <span className="pl-error"> · {bad} with problems (skipped)</span>}
          </p>
          <div className="pl-table-scroll">
            <table className="pl-table">
              <thead>
                <tr>
                  {importer.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {loaded.items.map((item, n) => (
                  <tr key={`${n}-${item.importKey}`} className={item.problems.length ? 'has-problem' : undefined}>
                    {importer.cells(item).map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                    <td className="pl-error">{item.problems.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-form-actions">
            <button
              type="button"
              className="pl-btn pl-btn-primary"
              disabled={busy || good.length === 0 || Boolean(importer.blocked)}
              onClick={handleImport}
            >
              {busy ? 'Importing…' : `Import ${good.length} rows`}
            </button>
            {importer.blocked && <span className="pl-muted">{importer.blocked}</span>}
            {message && <span className="pl-form-message">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}
