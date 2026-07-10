import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser, CurrentUser } from '../api/auth';
import {
  getFreshFirebaseIdToken,
  getFirebaseSessionFromUser,
  signInWithConfiguredDevAccount,
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
  const explicitSignOutRef = useRef(false);
  const devSignInAttemptedRef = useRef(false);
  const latestFirebaseIdTokenRef = useRef<string | null>(null);

  useEffect(() => {
    latestFirebaseIdTokenRef.current = firebaseIdToken;
  }, [firebaseIdToken]);

  const notifySocialChanged = useCallback(() => {
    setSocialRevision((revision) => revision + 1);
  }, []);
  const notifyTrackingChanged = useCallback(() => {
    setTrackingRevision((revision) => revision + 1);
  }, []);
  const getFirebaseIdToken = useCallback(async () => {
    try {
      const nextToken = await getFreshFirebaseIdToken();

      if (!nextToken && latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) {
        return latestFirebaseIdTokenRef.current;
      }

      latestFirebaseIdTokenRef.current = nextToken;
      setFirebaseIdToken(nextToken);

      if (!nextToken) {
        setCurrentUser(null);
        setStatus('idle');
      }

      return nextToken;
    } catch {
      if (latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) {
        return latestFirebaseIdTokenRef.current;
      }

      latestFirebaseIdTokenRef.current = null;
      setFirebaseIdToken(null);
      setCurrentUser(null);
      setStatus('error');

      return null;
    }
  }, []);

  const applyFirebaseSession = useCallback(async (firebaseIdToken: string) => {
    const user = await getCurrentUser(firebaseIdToken);

    explicitSignOutRef.current = false;
    latestFirebaseIdTokenRef.current = firebaseIdToken;
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
          if (!explicitSignOutRef.current && !devSignInAttemptedRef.current) {
            devSignInAttemptedRef.current = true;

            try {
              const devSession = await signInWithConfiguredDevAccount();

              if (devSession) {
                await applyFirebaseSession(devSession.firebaseIdToken);
                return;
              }
            } catch {
              // Fall through to the normal signed-out state when the local emulator is unavailable.
            }
          }

          if (latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) {
            return;
          }

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
            if (latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) {
              return;
            }

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
    explicitSignOutRef.current = true;
    await signOutFromFirebase();
    latestFirebaseIdTokenRef.current = null;
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
