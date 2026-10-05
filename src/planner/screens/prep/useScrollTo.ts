import { useEffect } from 'react';

/** Scrolls a deep-linked record into view once it has rendered. */
export function useScrollTo(elementId: string | null, ready: boolean) {
  useEffect(() => {
    if (!elementId || !ready) return;
    const el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('is-flash');
    const t = window.setTimeout(() => el.classList.remove('is-flash'), 1600);
    return () => window.clearTimeout(t);
  }, [elementId, ready]);
}
