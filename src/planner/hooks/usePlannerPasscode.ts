import { useCallback, useState } from 'react';

// SHA-256 of the planner passcode. A client-side check only: it hides the
// planner UI, it does not protect the data (see firestore.rules).
const PASSCODE_SHA256 = '0b6dfcd5427a43a60b0a38360499be09d494c8d8d67d70fc23080186e17161ba';
const STORAGE_KEY = 'sharemony-planner-unlocked';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === PASSCODE_SHA256;
  } catch {
    return false;
  }
}

export function usePlannerPasscode() {
  const [unlocked, setUnlocked] = useState<boolean>(readUnlocked);

  const unlock = useCallback(async (code: string): Promise<boolean> => {
    const ok = (await sha256Hex(code.trim())) === PASSCODE_SHA256;
    if (ok) {
      try {
        window.localStorage.setItem(STORAGE_KEY, PASSCODE_SHA256);
      } catch {
        // Private mode: stay unlocked for this visit only.
      }
      setUnlocked(true);
    }
    return ok;
  }, []);

  const lock = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUnlocked(false);
  }, []);

  return { unlocked, unlock, lock };
}
