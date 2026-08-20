import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser, CurrentUser } from '../api/auth';
import { ApiError } from '../api/client';
import { clearPrivateCacheForUser } from '../cache/persistedCache';
import { revokeStoredPushDevice } from '../notifications/nativePushNotifications';
import { createAuthTransitionGuard, performGuaranteedSignOut } from './authTransition';
import {
  getFreshFirebaseIdToken,
  getFirebaseSessionFromUser,
  signInWithConfiguredDevAccount,
  signInWithGoogleIdToken,
  signOutFromFirebase,
  subscribeToFirebaseIdTokenState,
} from './firebase';

type AuthSessionStatus = 'idle' | 'loading' | 'signedIn' | 'error';

export type TotpSignInChallenge = {
  displayName: string | null;
  verify: (oneTimePassword: string) => Promise<void>;
};

export type GoogleSignInResult =
  | { type: 'signedIn' }
  | { challenge: TotpSignInChallenge; type: 'totpRequired' };

type AuthSessionContextValue = {
  authErrorMessage: string | null;
  currentUser: CurrentUser | null;
  getFirebaseIdToken: () => Promise<string | null>;
  notifySocialChanged: () => void;
  firebaseIdToken: string | null;
  notifyTrackingChanged: () => void;
  refreshCurrentUser: () => Promise<void>;
  signInWithGoogle: (googleIdToken: string) => Promise<GoogleSignInResult>;
  signOut: () => Promise<void>;
  status: AuthSessionStatus;
  trackingRevision: number;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
const SocialRevisionContext = createContext(0);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [socialRevision, setSocialRevision] = useState(0);
  const [status, setStatus] = useState<AuthSessionStatus>('loading');
  const [trackingRevision, setTrackingRevision] = useState(0);
  const explicitSignOutRef = useRef(false);
  const devSignInAttemptedRef = useRef(false);
  const latestFirebaseIdTokenRef = useRef<string | null>(null);
  const authTransitionsRef = useRef(createAuthTransitionGuard());

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
    const transition = authTransitionsRef.current.current();
    try {
      const nextToken = await getFreshFirebaseIdToken();

      if (!authTransitionsRef.current.isCurrent(transition)) return null;

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
      if (!authTransitionsRef.current.isCurrent(transition)) return null;

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

  const applyFirebaseSession = useCallback(async (nextFirebaseIdToken: string, transition: number) => {
    let user: CurrentUser;

    try {
      user = await getCurrentUser(nextFirebaseIdToken);
    } catch (error) {
      if (authTransitionsRef.current.isCurrent(transition)) {
        setAuthErrorMessage(getSessionAccessMessage(error));
      }
      throw error;
    }

    if (!authTransitionsRef.current.isCurrent(transition)) return false;

    setAuthErrorMessage(null);
    explicitSignOutRef.current = false;
    latestFirebaseIdTokenRef.current = nextFirebaseIdToken;
    setFirebaseIdToken(nextFirebaseIdToken);
    setCurrentUser(user);
    setStatus('signedIn');
    return true;
  }, []);

  useEffect(() => {
    let isMounted = true;

    setStatus('loading');

    const unsubscribe = subscribeToFirebaseIdTokenState((firebaseUser) => {
      const transition = authTransitionsRef.current.begin();
      void (async () => {
        if (!isMounted || !authTransitionsRef.current.isCurrent(transition)) return;

        if (!firebaseUser) {
          if (!explicitSignOutRef.current && !devSignInAttemptedRef.current) {
            devSignInAttemptedRef.current = true;

            try {
              const devSession = await signInWithConfiguredDevAccount();

              if (!isMounted || !authTransitionsRef.current.isCurrent(transition)) return;

              if (devSession) {
                await applyFirebaseSession(devSession.firebaseIdToken, transition);
                return;
              }
            } catch {
              // Fall through to the normal signed-out state when the local emulator is unavailable.
            }
          }

          if (!authTransitionsRef.current.isCurrent(transition)) return;

          if (latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) return;

          setFirebaseIdToken(null);
          setCurrentUser(null);
          setAuthErrorMessage(null);
          setStatus('idle');
          return;
        }

        try {
          const firebaseSession = await getFirebaseSessionFromUser(firebaseUser);

          if (!isMounted || !authTransitionsRef.current.isCurrent(transition)) return;

          await applyFirebaseSession(firebaseSession.firebaseIdToken, transition);
        } catch {
          if (!isMounted || !authTransitionsRef.current.isCurrent(transition)) return;

          if (latestFirebaseIdTokenRef.current && !explicitSignOutRef.current) return;

          setFirebaseIdToken(null);
          setCurrentUser(null);
          setStatus('error');
        }
      })();
    });

    return () => {
      isMounted = false;
      authTransitionsRef.current.invalidate();
      unsubscribe();
    };
  }, [applyFirebaseSession]);

  const signInWithGoogle = useCallback(async (googleIdToken: string) => {
    const transition = authTransitionsRef.current.begin();
    explicitSignOutRef.current = false;
    setStatus('loading');
    try {
      const result = await signInWithGoogleIdToken(googleIdToken);

      if (result.type === 'totpRequired') {
        if (authTransitionsRef.current.isCurrent(transition)) setStatus('idle');

        return {
          challenge: {
            displayName: result.challenge.displayName,
            verify: async (oneTimePassword: string) => {
              const verificationTransition = authTransitionsRef.current.begin();
              setStatus('loading');
              let firebaseSession;

              try {
                firebaseSession = await result.challenge.verify(oneTimePassword);
              } catch (error) {
                if (authTransitionsRef.current.isCurrent(verificationTransition)) setStatus('idle');
                throw error;
              }

              if (!authTransitionsRef.current.isCurrent(verificationTransition)) return;

              try {
                await applyFirebaseSession(firebaseSession.firebaseIdToken, verificationTransition);
              } catch (error) {
                if (authTransitionsRef.current.isCurrent(verificationTransition)) setStatus('error');
                throw error;
              }
            },
          },
          type: 'totpRequired' as const,
        };
      }

      if (authTransitionsRef.current.isCurrent(transition)) {
        await applyFirebaseSession(result.session.firebaseIdToken, transition);
      }

      return { type: 'signedIn' as const };
    } catch (error) {
      if (authTransitionsRef.current.isCurrent(transition)) setStatus('error');
      throw error;
    }
  }, [applyFirebaseSession]);
  const refreshCurrentUser = useCallback(async () => {
    if (!firebaseIdToken) return;

    const transition = authTransitionsRef.current.current();
    const user = await getCurrentUser(firebaseIdToken);

    if (!authTransitionsRef.current.isCurrent(transition)) return;

    setCurrentUser(user);
  }, [firebaseIdToken]);
  const signOut = useCallback(async () => {
    const transition = authTransitionsRef.current.begin();
    setStatus('loading');
    explicitSignOutRef.current = true;
    const signedOutUserId = currentUser?.id;
    const signedOutFirebaseIdToken = latestFirebaseIdTokenRef.current;
    latestFirebaseIdTokenRef.current = null;
    setFirebaseIdToken(null);
    setCurrentUser(null);
    setAuthErrorMessage(null);
    setSocialRevision(0);
    setTrackingRevision(0);

    try {
      await Promise.all([
        performGuaranteedSignOut(signedOutUserId, {
          clearPrivateCacheForUser,
          signOutFromFirebase,
        }),
        signedOutFirebaseIdToken
          ? revokeStoredPushDevice(signedOutFirebaseIdToken).catch(() => false)
          : Promise.resolve(false),
      ]);
      const isCurrentAfterFirebaseSignOut = authTransitionsRef.current.isCurrent(transition);
      if (!isCurrentAfterFirebaseSignOut || !authTransitionsRef.current.isCurrent(transition)) return;
    } finally {
      if (authTransitionsRef.current.isCurrent(transition)) setStatus('idle');
    }
  }, [currentUser?.id]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      authErrorMessage,
      currentUser,
      firebaseIdToken,
      getFirebaseIdToken,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      status,
      trackingRevision,
    }),
    [
      authErrorMessage,
      currentUser,
      firebaseIdToken,
      getFirebaseIdToken,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithGoogle,
      signOut,
      status,
      trackingRevision,
    ],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      <SocialRevisionContext.Provider value={socialRevision}>
        {children}
      </SocialRevisionContext.Provider>
    </AuthSessionContext.Provider>
  );
}

function getSessionAccessMessage(error: unknown) {
  return error instanceof ApiError && error.status === 403 ? error.message : null;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) throw new Error('useAuthSession must be used inside AuthSessionProvider.');

  return context;
}

export function useSocialRevision() {
  return useContext(SocialRevisionContext);
}
