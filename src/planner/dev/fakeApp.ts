/*
 * Dev-only stand-ins for `firebase/app` and `firebase/auth` (see
 * fakeFirestore.ts). Initializing shows a small "Fake data" badge so a
 * screenshot can never be mistaken for the real planner.
 */

export function initializeApp(_config?: unknown) {
  void _config;
  try {
    const badge = document.createElement('div');
    const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'invites';
    badge.textContent = `Fake data · ${scenario}`;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText =
      'position:fixed;left:50%;top:2px;transform:translateX(-50%);z-index:9999;padding:2px 8px;border-radius:999px;' +
      'font:600 11px/18px Inter,sans-serif;background:#7c3aed;color:#fff;opacity:.85;pointer-events:none';
    badge.dataset.fakeBadge = 'true';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
    if (document.body) document.body.appendChild(badge);
  } catch {
    // No DOM (tests).
  }
  return { name: 'fake' };
}

export function getAuth(_app?: unknown) {
  void _app;
  return { currentUser: null };
}
