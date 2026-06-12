import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, CurrentUser } from '../api/auth';
import {
  getFirebaseSessionFromUser,
  signInWithGoogleIdToken,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
} from './firebase';

type AuthSessionStatus = 'idle' | 'loading' | 'signedIn' | 'error';

type AuthSessionContextValue = {
  currentUser: CurrentUser | null;
  firebaseIdToken: string | null;
  notifyTrackingChanged: () => void;
  refreshCurrentUser: () => Promise<void>;
  signInWithGoogle: (googleIdToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  status: AuthSessionStatus;
  trackingRevision: number;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthSessionStatus>('idle');
  const [trackingRevision, setTrackingRevision] = useState(0);
  const notifyTrackingChanged = useCallback(() => {
    setTrackingRevision((revision) => revision + 1);
  }, []);

  const applyFirebaseSession = useCallback(async (firebaseIdToken: string) => {
    const user = await getCurrentUser(firebaseIdToken);

    setFirebaseIdToken(firebaseIdToken);
    setCurrentUser(user);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    let isMounted = true;

    setStatus('loading');

    const unsubscribe = subscribeToFirebaseAuthState((firebaseUser) => {
      void (async () => {
        if (!isMounted) {
          return;
        }

        if (!firebaseUser) {
          setFirebaseIdToken(null);
          setCurrentUser(null);
          setStatus('idle');
          return;
        }

        try {
          const firebaseSession = await getFirebaseSessionFromUser(firebaseUser);

          if (isMounted) {
            await applyFirebaseSession(firebaseSession.firebaseIdToken);
          }
        } catch {
          if (isMounted) {
            setFirebaseIdToken(null);
            setCurrentUser(null);
            setStatus('error');
          }
        }
      })();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [applyFirebaseSession]);

  const signInWithGoogle = useCallback(async (googleIdToken: string) => {
    setStatus('loading');
    const firebaseSession = await signInWithGoogleIdToken(googleIdToken);

    await applyFirebaseSession(firebaseSession.firebaseIdToken);
  }, [applyFirebaseSession]);
  const refreshCurrentUser = useCallback(async () => {
    if (!firebaseIdToken) {
      return;
    }

    const user = await getCurrentUser(firebaseIdToken);

    setCurrentUser(user);
  }, [firebaseIdToken]);
  const signOut = useCallback(async () => {
    setStatus('loading');
    await signOutFromFirebase();
    setFirebaseIdToken(null);
    setCurrentUser(null);
    setTrackingRevision(0);
    setStatus('idle');
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      currentUser,
      firebaseIdToken,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      status,
      trackingRevision,
    }),
    [
      currentUser,
      firebaseIdToken,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      status,
      trackingRevision,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}
