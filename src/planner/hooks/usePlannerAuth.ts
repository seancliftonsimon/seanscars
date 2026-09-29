import { useCallback, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { FirestoreError, getDoc } from 'firebase/firestore';
import { auth } from '../../services/firebase';
import { plannerAccessDoc } from '../firestore';
import { isEmailAllowed } from '../logic/access';

export type PlannerAuthStatus = 'loading' | 'signed-out' | 'not-allowed' | 'allowed';

export interface PlannerAuth {
  status: PlannerAuthStatus;
  user: User | null;
  /** A sign-in or access-check problem worth showing (not "permission denied"). */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthState {
  status: PlannerAuthStatus;
  user: User | null;
  error: string | null;
}

/**
 * Google sign-in for the planner. "Allowed" means the signed-in user can
 * read `plannerConfig/access` (the security rules only let listed, verified
 * emails read it) and their email is in its `emails` array.
 */
export function usePlannerAuth(): PlannerAuth {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, error: null });

  useEffect(() => {
    let check = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const thisCheck = ++check;
      if (!user) {
        setState({ status: 'signed-out', user: null, error: null });
        return;
      }
      setState({ status: 'loading', user, error: null });
      getDoc(plannerAccessDoc())
        .then((snap) => {
          if (thisCheck !== check) return;
          const emails = snap.exists() ? snap.data().emails : [];
          const allowed = isEmailAllowed(user.email, user.emailVerified, emails);
          setState({ status: allowed ? 'allowed' : 'not-allowed', user, error: null });
        })
        .catch((err: unknown) => {
          if (thisCheck !== check) return;
          const denied = err instanceof FirestoreError && err.code === 'permission-denied';
          setState({
            status: 'not-allowed',
            user,
            error: denied ? null : `Couldn't check planner access: ${err instanceof Error ? err.message : String(err)}`,
          });
        });
    });
    return () => {
      check += 1;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setState((prev) => ({ ...prev, error: `Sign-in failed: ${err instanceof Error ? err.message : String(err)}` }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { ...state, signIn, signOut };
}
