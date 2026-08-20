import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser, CurrentUser } from '../api/auth';
import {
  exchangeExternalOAuth,
  ExternalAuthProvider,
  linkExternalOAuth as completeExternalOAuthLink,
} from '../api/externalAuth';
import { ApiError } from '../api/client';
import { clearPrivateCacheForUser } from '../cache/persistedCache';
import { revokeStoredPushDevice } from '../notifications/nativePushNotifications';
import { createAuthTransitionGuard, performGuaranteedSignOut } from './authTransition';
import {
  type FirebaseProviderSignInResult,
  getFreshFirebaseIdToken,
  getFirebaseSessionFromUser,
  linkWithAppleIdentityToken,
  linkWithGoogleIdToken,
  linkWithMicrosoftTokens,
  signInWithConfiguredDevAccount,
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
  signInWithMicrosoftTokens,
  signInWithWatchlyCustomToken,
  signOutFromFirebase,
  subscribeToFirebaseIdTokenState,
} from './firebase';
import { requestExternalOAuthTicket } from './externalOAuth';
import type { MicrosoftTokens } from './microsoftAuth';

type AuthSessionStatus = 'idle' | 'loading' | 'signedIn' | 'error';

export type TotpSignInChallenge = {
  displayName: string | null;
  verify: (oneTimePassword: string) => Promise<void>;
};

export type ProviderSignInResult =
  | { type: 'cancelled' }
  | { type: 'signedIn' }
  | { existingProviders: string[]; provider: ExternalAuthProvider; type: 'linkRequired' }
  | { challenge: TotpSignInChallenge; type: 'totpRequired' };

type AuthSessionContextValue = {
  authErrorMessage: string | null;
  currentUser: CurrentUser | null;
  getFirebaseIdToken: () => Promise<string | null>;
  notifySocialChanged: () => void;
  firebaseIdToken: string | null;
  notifyTrackingChanged: () => void;
  linkApple: (identityToken: string, rawNonce: string) => Promise<void>;
  linkExternal: (provider: ExternalAuthProvider) => Promise<boolean>;
  linkGoogle: (googleIdToken: string) => Promise<void>;
  linkMicrosoft: (tokens: MicrosoftTokens) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  signInWithApple: (identityToken: string, rawNonce: string) => Promise<ProviderSignInResult>;
  signInWithGoogle: (googleIdToken: string) => Promise<ProviderSignInResult>;
  signInWithExternal: (provider: ExternalAuthProvider) => Promise<ProviderSignInResult>;
  signInWithMicrosoft: (tokens: MicrosoftTokens) => Promise<ProviderSignInResult>;
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
  const pendingExternalLinkRef = useRef<{ provider: ExternalAuthProvider; ticket: string } | null>(null);
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
      const pendingLink = pendingExternalLinkRef.current;

      if (pendingLink) {
        user = await completeExternalOAuthLink(pendingLink.ticket, nextFirebaseIdToken);
        pendingExternalLinkRef.current = null;
      } else {
        user = await getCurrentUser(nextFirebaseIdToken);
      }
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

  const finishProviderSignIn = useCallback(async (
    signIn: () => Promise<FirebaseProviderSignInResult>,
  ): Promise<ProviderSignInResult> => {
    const transition = authTransitionsRef.current.begin();
    explicitSignOutRef.current = false;
    setStatus('loading');
    try {
      const result = await signIn();

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
  const signInWithApple = useCallback(
    (identityToken: string, rawNonce: string) =>
      finishProviderSignIn(() => signInWithAppleIdentityToken(identityToken, rawNonce)),
    [finishProviderSignIn],
  );
  const signInWithGoogle = useCallback(
    (googleIdToken: string) => finishProviderSignIn(() => signInWithGoogleIdToken(googleIdToken)),
    [finishProviderSignIn],
  );
  const linkProvider = useCallback(async (link: () => Promise<{ firebaseIdToken: string }>) => {
    const transition = authTransitionsRef.current.begin();
    setStatus('loading');

    try {
      const session = await link();

      if (!authTransitionsRef.current.isCurrent(transition)) return;

      await applyFirebaseSession(session.firebaseIdToken, transition);
    } catch (error) {
      if (authTransitionsRef.current.isCurrent(transition)) setStatus('signedIn');
      throw error;
    }
  }, [applyFirebaseSession]);
  const linkApple = useCallback(
    (identityToken: string, rawNonce: string) =>
      linkProvider(() => linkWithAppleIdentityToken(identityToken, rawNonce)),
    [linkProvider],
  );
  const linkMicrosoft = useCallback(
    (tokens: MicrosoftTokens) => linkProvider(() => linkWithMicrosoftTokens(tokens)),
    [linkProvider],
  );
  const linkGoogle = useCallback(
    (googleIdToken: string) => linkProvider(() => linkWithGoogleIdToken(googleIdToken)),
    [linkProvider],
  );
  const signInWithMicrosoft = useCallback(
    (tokens: MicrosoftTokens) => finishProviderSignIn(() => signInWithMicrosoftTokens(tokens)),
    [finishProviderSignIn],
  );
  const signInWithExternal = useCallback(async (
    provider: ExternalAuthProvider,
  ): Promise<ProviderSignInResult> => {
    const transition = authTransitionsRef.current.begin();
    explicitSignOutRef.current = false;
    setStatus('loading');

    try {
      const ticket = await requestExternalOAuthTicket(provider);
      if (!ticket) {
        if (authTransitionsRef.current.isCurrent(transition)) setStatus('idle');
        return { type: 'cancelled' };
      }

      let exchange: { firebaseCustomToken: string };

      try {
        exchange = await exchangeExternalOAuth(ticket);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'ACCOUNT_LINK_REQUIRED') {
          pendingExternalLinkRef.current = { provider, ticket };
          if (authTransitionsRef.current.isCurrent(transition)) setStatus('idle');

          return {
            existingProviders: getExistingProviders(error),
            provider,
            type: 'linkRequired',
          };
        }

        throw error;
      }

      const session = await signInWithWatchlyCustomToken(exchange.firebaseCustomToken);
      if (authTransitionsRef.current.isCurrent(transition)) {
        await applyFirebaseSession(session.firebaseIdToken, transition);
      }

      return { type: 'signedIn' };
    } catch (error) {
      if (authTransitionsRef.current.isCurrent(transition)) setStatus('error');
      throw error;
    }
  }, [applyFirebaseSession]);
  const linkExternal = useCallback(async (provider: ExternalAuthProvider) => {
    const transition = authTransitionsRef.current.begin();
    setStatus('loading');

    try {
      const firebaseToken = await getFreshFirebaseIdToken();
      if (!firebaseToken) throw new Error('Sign in before linking another provider.');

      const ticket = await requestExternalOAuthTicket(provider, firebaseToken);
      if (!ticket) {
        if (authTransitionsRef.current.isCurrent(transition)) setStatus('signedIn');
        return false;
      }

      const user = await completeExternalOAuthLink(ticket, firebaseToken);
      if (authTransitionsRef.current.isCurrent(transition)) {
        latestFirebaseIdTokenRef.current = firebaseToken;
        setFirebaseIdToken(firebaseToken);
        setCurrentUser(user);
        setStatus('signedIn');
      }

      return true;
    } catch (error) {
      if (authTransitionsRef.current.isCurrent(transition)) setStatus('signedIn');
      throw error;
    }
  }, []);
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
    pendingExternalLinkRef.current = null;
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
      linkApple,
      linkExternal,
      linkGoogle,
      linkMicrosoft,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithApple,
      signInWithExternal,
      signInWithGoogle,
      signInWithMicrosoft,
      signOut,
      status,
      trackingRevision,
    }),
    [
      authErrorMessage,
      currentUser,
      firebaseIdToken,
      getFirebaseIdToken,
      linkApple,
      linkExternal,
      linkGoogle,
      linkMicrosoft,
      notifySocialChanged,
      notifyTrackingChanged,
      refreshCurrentUser,
      signInWithApple,
      signInWithExternal,
      signInWithGoogle,
      signInWithMicrosoft,
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

function getExistingProviders(error: ApiError) {
  const providers = error.details?.existingProviders;

  return Array.isArray(providers)
    ? providers.filter((provider): provider is string => typeof provider === 'string')
    : [];
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) throw new Error('useAuthSession must be used inside AuthSessionProvider.');

  return context;
}

export function useSocialRevision() {
  return useContext(SocialRevisionContext);
}
