import { useState, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onSave: (next: string) => void;
  label: string;
  placeholder?: string;
  /** Allow saving an empty value (clears the field). */
  allowEmpty?: boolean;
  multiline?: boolean;
  className?: string;
}

/** Text that reads as text and turns into an input on click; Enter saves, Escape cancels. */
export function InlineText({ value, onSave, label, placeholder = 'Add…', allowEmpty = true, multiline, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === value.trim() || (!next && !allowEmpty)) return;
    onSave(next);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(null);
    }
  }

  if (draft !== null) {
    const props = {
      className: `pl-inline-input${className ? ` ${className}` : ''}`,
      value: draft,
      autoFocus: true,
      'aria-label': label,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey,
    };
    return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
  }
  return (
    <button
      type="button"
      className={`pl-inline-text${value ? '' : ' is-empty'}${className ? ` ${className}` : ''}`}
      onClick={() => setDraft(value)}
      aria-label={`${label}: ${value || 'empty'}. Edit`}
    >
      {value || placeholder}
    </button>
  );
}
