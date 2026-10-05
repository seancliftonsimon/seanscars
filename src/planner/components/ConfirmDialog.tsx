import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  /** 'danger' (default) for destructive actions, 'primary' for deliberate ones. */
  tone?: 'danger' | 'primary';
  secondary?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation for destructive actions; Escape or backdrop cancels. */
export default function ConfirmDialog({ title, message, confirmLabel, busy, tone = 'danger', secondary, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="pl-root pl-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="pl-form-actions">
        <button type="button" className={`pl-btn ${tone === 'danger' ? 'pl-btn-danger' : 'pl-btn-primary'}`} disabled={busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </button>
        {secondary && (
          <button type="button" className="pl-btn" disabled={busy} onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
        <button type="button" className="pl-btn" onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
