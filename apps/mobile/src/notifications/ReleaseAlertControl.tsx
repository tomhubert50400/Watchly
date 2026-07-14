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
import { colors, radii } from '../design/tokens';
import { useToast } from './ToastContext';
import { getReleaseAlertControlPresentation, ReleaseAlertLoadStatus } from './releaseAlertControlState';

type ReleaseAlertControlProps = {
  contentType: ReleaseAlertContentType;
  tmdbId: number;
};

export function ReleaseAlertControl({ contentType, tmdbId }: ReleaseAlertControlProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const { showToast } = useToast();
  const requestScope = JSON.stringify([currentUser?.id ?? null, contentType, tmdbId]);
  const [loadStatus, setLoadStatus] = useState<ReleaseAlertLoadStatus>('loading');
  const [state, setState] = useState<ReleaseAlertState | null>(null);
  const [stateScope, setStateScope] = useState(requestScope);
  const requestRef = useRef({ scope: requestScope, version: 0 });

  if (requestRef.current.scope !== requestScope) {
    requestRef.current = { scope: requestScope, version: requestRef.current.version + 1 };
  }

  const visibleState = stateScope === requestScope ? state : null;

  const loadAlert = useCallback(async () => {
    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;

    if (!firebaseIdToken || !currentUser) {
      setState(null);
      setStateScope(scope);
      setLoadStatus('ready');
      return;
    }

    setLoadStatus('loading');

    try {
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to load release alerts.');

      const loadedState = await getReleaseAlert(token, contentType, tmdbId);
      if (!isCurrent()) return;
      setState(loadedState);
      setStateScope(scope);
      setLoadStatus('ready');
    } catch {
      if (!isCurrent()) return;
      setLoadStatus('error');
    }
  }, [contentType, currentUser, firebaseIdToken, getFirebaseIdToken, requestScope, tmdbId]);

  useEffect(() => {
    setState(null);
    setStateScope(requestScope);
    void loadAlert();
  }, [loadAlert, requestScope]);

  async function toggleAlert() {
    if (!firebaseIdToken || !currentUser) {
      showToast('Sign in to enable release alerts.');
      return;
    }

    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;
    const previousState = visibleState;
    const nextEnabled = !previousState?.enabled;

    setState({ enabled: nextEnabled, items: previousState?.items ?? [] });
    setStateScope(scope);

    try {
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to update release alerts.');

      const nextState = previousState?.enabled
        ? await disableReleaseAlert(token, contentType, tmdbId)
        : await enableReleaseAlert(token, contentType, tmdbId);
      if (!isCurrent()) return;

      setState(nextState);
      setStateScope(scope);
      notifyTrackingChanged();
    } catch (toggleError) {
      if (!isCurrent()) return;
      setState(previousState);
      setStateScope(scope);
      showToast(toggleError instanceof Error ? toggleError.message : 'Could not update release alerts.');
    }
  }

  const presentation = getReleaseAlertControlPresentation(loadStatus, visibleState);
  const { enabled } = presentation;

  return (
    <Pressable
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: presentation.disabled, selected: enabled }}
      disabled={presentation.disabled}
      onPress={(event) => {
        event.stopPropagation();
        if (presentation.action === 'retry') {
          void loadAlert();
        } else if (presentation.action === 'toggle') {
          void toggleAlert();
        }
      }}
      style={({ pressed }) => [
        styles.iconButton,
        enabled && styles.iconButtonEnabled,
        loadStatus === 'error' && styles.iconButtonError,
        pressed && styles.pressed,
      ]}
    >
      {loadStatus === 'error' ? (
        <TriangleAlert color={colors.danger} size={19} strokeWidth={2.2} />
      ) : enabled ? (
        <BellRing color={colors.textOnAccent} size={19} strokeWidth={2.2} />
      ) : (
        <BellOff color={colors.muted} size={19} strokeWidth={2.2} />
      )}
    </Pressable>
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
