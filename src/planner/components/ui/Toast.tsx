import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ToastContext, type ToastInput } from './toastContext';

interface Toast extends ToastInput {
  id: number;
}

const LIFETIME_MS = 7000;

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

/** Bottom toasts. The newest toast with an Undo also answers Ctrl/Cmd+Z. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );

  const runUndo = useCallback(
    (t: Toast) => {
      dismiss(t.id);
      void Promise.resolve(t.undo?.()).catch(() => push({ message: 'Couldn’t undo that.', tone: 'danger' }));
    },
    [dismiss, push],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.shiftKey || typing(e.target)) return;
      const last = [...toasts].reverse().find((t) => t.undo);
      if (!last) return;
      e.preventDefault();
      runUndo(last);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, runUndo]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pl-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pl-toast${t.tone === 'danger' ? ' is-danger' : ''}`}>
            <span>{t.message}</span>
            {t.undo && (
              <button type="button" className="pl-toast-undo" onClick={() => runUndo(t)}>
                Undo
              </button>
            )}
            <button type="button" className="pl-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
