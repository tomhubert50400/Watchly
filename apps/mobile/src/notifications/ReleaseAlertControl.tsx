import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BellOff, BellRing, TriangleAlert } from 'lucide-react-native';
import {
  disableReleaseAlert,
  enableReleaseAlert,
  getReleaseAlert,
  ReleaseAlertContentType,
  ReleaseAlertState,
} from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInSheet } from '../auth/SignInRequired';
import {
  getPrivateCacheKey,
  readPersistedCache,
  writePersistedCache,
} from '../cache/persistedCache';
import { colors, radii } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { useToast } from './ToastContext';
import { maybeEnableReleasePushFromAlert, ReleasePushSetupResult } from './nativePushNotifications';
import {
  getReleaseAlertControlPresentation,
  getReleaseAlertControlSession,
  ReleaseAlertLoadStatus,
} from './releaseAlertControlState';

type ReleaseAlertControlProps = {
  contentType: ReleaseAlertContentType;
  tmdbId: number;
};

export function ReleaseAlertControl({ contentType, tmdbId }: ReleaseAlertControlProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const { isSignedIn, requestScope } = getReleaseAlertControlSession({
    contentType,
    firebaseIdToken,
    tmdbId,
    userId: currentUser?.id ?? null,
  });
  const cacheKey = currentUser
    ? getPrivateCacheKey(currentUser.id, `release-alert:${contentType}:${tmdbId}`)
    : null;
  const [loadStatus, setLoadStatus] = useState<ReleaseAlertLoadStatus>('ready');
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [state, setState] = useState<ReleaseAlertState | null>(null);
  const [stateScope, setStateScope] = useState(requestScope);
  const batchChangedRef = useRef(false);
  const confirmedStateRef = useRef<ReleaseAlertState | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const requestRef = useRef({ scope: requestScope, version: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  if (requestRef.current.scope !== requestScope) {
    requestRef.current = { scope: requestScope, version: requestRef.current.version + 1 };
  }

  const visibleState = stateScope === requestScope ? state : null;

  const loadAlert = useCallback(async () => {
    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;

    if (!isSignedIn) {
      setState(null);
      setStateScope(scope);
      setLoadStatus('ready');
      return;
    }

    try {
      if (cacheKey) {
        const cached = await readPersistedCache<ReleaseAlertState>(cacheKey).catch(() => null);
        if (cached && isCurrent()) {
          setState(cached.data);
          stateRef.current = cached.data;
          setStateScope(scope);
          setLoadStatus('ready');
        }
      }
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to load release alerts.');

      const loadedState = await getReleaseAlert(token, contentType, tmdbId);
      if (!isCurrent()) return;
      setState(loadedState);
      stateRef.current = loadedState;
      setStateScope(scope);
      setLoadStatus('ready');
      if (cacheKey) void writePersistedCache(cacheKey, loadedState).catch(() => undefined);
    } catch {
      if (!isCurrent()) return;
      setLoadStatus('error');
    }
  }, [cacheKey, contentType, getFirebaseIdToken, isSignedIn, requestScope, tmdbId]);

  useEffect(() => {
    setState(null);
    setStateScope(requestScope);
    setIsSignInOpen(false);
    void loadAlert();
  }, [loadAlert, requestScope]);

  async function toggleAlert() {
    if (!isSignedIn) {
      setIsSignInOpen(true);
      return;
    }

    const scope = requestScope;
    requestRef.current = { scope, version: requestRef.current.version + 1 };
    const previousState = stateRef.current;
    const nextEnabled = !previousState?.enabled;

    const optimisticState = { enabled: nextEnabled, items: previousState?.items ?? [] };
    setState(optimisticState);
    stateRef.current = optimisticState;
    setStateScope(scope);
    setLoadStatus('ready');
    if (cacheKey) void writePersistedCache(cacheKey, optimisticState).catch(() => undefined);
    if (pendingMutationCountRef.current === 0) {
      confirmedStateRef.current = previousState;
      batchChangedRef.current = false;
    }
    pendingMutationCountRef.current += 1;

    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in again to update release alerts.');

        let pushSetup: ReleasePushSetupResult | null = null;
        if (nextEnabled && currentUser?.id) {
          pushSetup = await maybeEnableReleasePushFromAlert(token, currentUser.id).catch(() => ({
            message: 'System notifications could not be enabled. Your in-app alert still works.',
            status: 'unavailable' as const,
          }));
        }

        confirmedStateRef.current = nextEnabled
          ? await enableReleaseAlert(token, contentType, tmdbId)
          : await disableReleaseAlert(token, contentType, tmdbId);
        batchChangedRef.current = true;
        if (pushSetup?.message) showToast(pushSetup.message);
      } catch (toggleError) {
        hapticError();
        showToast(toggleError instanceof Error ? toggleError.message : 'Could not update release alerts.');
      } finally {
        pendingMutationCountRef.current -= 1;
        if (pendingMutationCountRef.current === 0) {
          const confirmedState = confirmedStateRef.current;
          if (requestRef.current.scope === scope) {
            setState(confirmedState);
            stateRef.current = confirmedState;
            setStateScope(scope);
            setLoadStatus('ready');
            if (cacheKey && confirmedState) {
              void writePersistedCache(cacheKey, confirmedState).catch(() => undefined);
            }
          }
          if (batchChangedRef.current) notifyUserDataChanged('releaseAlerts');
          batchChangedRef.current = false;
        }
      }
    };
    const queuedMutation = mutationQueueRef.current.then(commitMutation, commitMutation);
    mutationQueueRef.current = queuedMutation.catch(() => undefined);
    await queuedMutation;
  }

  const presentation = getReleaseAlertControlPresentation(loadStatus, visibleState);
  const { enabled } = presentation;
  const requiresSignIn = !isSignedIn;

  return (
    <>
      <Pressable
        accessibilityLabel={requiresSignIn ? 'Sign in to enable release alerts' : presentation.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: requiresSignIn ? false : presentation.disabled, selected: enabled }}
        disabled={requiresSignIn ? false : presentation.disabled}
        onPress={(event) => {
          event.stopPropagation();
          if (requiresSignIn) {
            setIsSignInOpen(true);
          } else if (presentation.action === 'retry') {
            void loadAlert();
          } else if (presentation.action === 'toggle') {
            void toggleAlert();
          }
        }}
        style={({ pressed }) => [
          styles.iconButton,
          enabled && styles.iconButtonEnabled,
          loadStatus === 'error' && !requiresSignIn && styles.iconButtonError,
          pressed && styles.pressed,
        ]}
      >
        {loadStatus === 'error' && !requiresSignIn ? (
          <TriangleAlert color={colors.danger} size={19} strokeWidth={2.2} />
        ) : enabled ? (
          <BellRing color={colors.textOnAccent} size={19} strokeWidth={2.2} />
        ) : (
          <BellOff color={colors.muted} size={19} strokeWidth={2.2} />
        )}
      </Pressable>
      <SignInSheet
        body="You need to be signed in to enable release alerts. Sign in here to continue."
        onClose={() => setIsSignInOpen(false)}
        title="Sign in to use release alerts"
        visible={isSignInOpen && requiresSignIn}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    height: 44,
    width: 44,
  },
  iconButtonEnabled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  iconButtonError: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  pressed: {
    opacity: 0.78,
  },
});
