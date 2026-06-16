import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, CurrentUser } from '../api/auth';
import {
  getFreshFirebaseIdToken,
  getFirebaseSessionFromUser,
  signInWithGoogleIdToken,
  signOutFromFirebase,
  subscribeToFirebaseAuthState,
} from './firebase';

type AuthSessionStatus = 'idle' | 'loading' | 'signedIn' | 'error';

type AuthSessionContextValue = {
  currentUser: CurrentUser | null;
  getFirebaseIdToken: () => Promise<string | null>;
  notifySocialChanged: () => void;
  firebaseIdToken: string | null;
  notifyTrackingChanged: () => void;
  refreshCurrentUser: () => Promise<void>;
  signInWithGoogle: (googleIdToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  socialRevision: number;
  status: AuthSessionStatus;
  trackingRevision: number;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [socialRevision, setSocialRevision] = useState(0);
  const [status, setStatus] = useState<AuthSessionStatus>('idle');
  const [trackingRevision, setTrackingRevision] = useState(0);
  const notifySocialChanged = useCallback(() => {
    setSocialRevision((revision) => revision + 1);
  }, []);
  const notifyTrackingChanged = useCallback(() => {
    setTrackingRevision((revision) => revision + 1);
  }, []);
  const getFirebaseIdToken = useCallback(async () => {
    try {
      const nextToken = await getFreshFirebaseIdToken();

      setFirebaseIdToken(nextToken);

      if (!nextToken) {
        setCurrentUser(null);
        setStatus('idle');
      }

      return nextToken;
    } catch {
      setFirebaseIdToken(null);
      setCurrentUser(null);
      setStatus('error');

      return null;
    }
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
    setSocialRevision(0);
    setTrackingRevision(0);
    setStatus('idle');
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      currentUser,
      firebaseIdToken,
      getFirebaseIdToken,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      socialRevision,
      status,
      trackingRevision,
    }),
    [
      currentUser,
      firebaseIdToken,
      getFirebaseIdToken,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      socialRevision,
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
