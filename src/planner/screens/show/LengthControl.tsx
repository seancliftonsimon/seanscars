import { useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatDuration } from '../../logic/clockFormat';
import { nudge, parseLength } from '../../logic/duration';

const NUDGE_SEC = 30;

/** m:ss with −/+ 30s nudges; click the number to type a length. */
export default function LengthControl({ sec, onChange, label }: { sec: number; onChange: (sec: number) => void; label: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const invalid = editing !== null && parseLength(editing) === null;

  function commit() {
    if (editing === null) return;
    const parsed = parseLength(editing);
    if (parsed !== null && parsed !== sec) onChange(parsed);
    if (parsed !== null) setEditing(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(null);
    }
  }

  return (
    <span className="pl-length" role="group" aria-label={label}>
      <button type="button" className="pl-nudge" onClick={() => onChange(nudge(sec, -NUDGE_SEC))} aria-label="30 seconds shorter">
        <Minus size={13} aria-hidden />
      </button>
      {editing === null ? (
        <button type="button" className="pl-length-value" onClick={() => setEditing(formatDuration(sec))} title="Type a length">
          {formatDuration(sec)}
        </button>
      ) : (
        <input
          className="pl-length-input"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          aria-invalid={invalid || undefined}
          aria-label="Length, m:ss"
          autoFocus
        />
      )}
      <button type="button" className="pl-nudge" onClick={() => onChange(nudge(sec, NUDGE_SEC))} aria-label="30 seconds longer">
        <Plus size={13} aria-hidden />
      </button>
    </span>
  );
}
