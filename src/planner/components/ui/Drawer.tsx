import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Frame for the record drawers (`.pl-side-panel`): a dimmed backdrop that
 * closes it, Escape to close, and focus moved into the drawer and back.
 */
export function DrawerFrame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current?.querySelector<HTMLElement>('.pl-side-panel');
    if (panel && !panel.contains(document.activeElement)) {
      panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div ref={ref} className="pl-drawer">
      <div className="pl-drawer-backdrop" onClick={onClose} aria-hidden />
      {children}
    </div>
  );
}
