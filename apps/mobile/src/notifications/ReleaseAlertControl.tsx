import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BellOff, BellRing } from 'lucide-react-native';
import {
  disableReleaseAlert,
  enableReleaseAlert,
  getReleaseAlert,
  ReleaseAlertContentType,
  ReleaseAlertState,
} from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii } from '../design/tokens';

type ReleaseAlertControlProps = {
  contentType: ReleaseAlertContentType;
  tmdbId: number;
};

export function ReleaseAlertControl({ contentType, tmdbId }: ReleaseAlertControlProps) {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<ReleaseAlertState | null>(null);
  const toggleVersionRef = useRef(0);

  const loadAlert = useCallback(async () => {
    if (!firebaseIdToken) {
      setState(null);
      return;
    }

    const loadVersion = toggleVersionRef.current;

    setIsLoading(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load release alerts.');
      }

      const loadedState = await getReleaseAlert(token, contentType, tmdbId);

      if (toggleVersionRef.current === loadVersion) {
        setState(loadedState);
      }
    } catch (loadError) {
      if (toggleVersionRef.current === loadVersion) {
        setState(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, getFirebaseIdToken, tmdbId]);

  useEffect(() => {
    void loadAlert();
  }, [loadAlert]);

  async function toggleAlert() {
    if (!firebaseIdToken) {
      return;
    }

    const previousState = state;
    const nextEnabled = !state?.enabled;
    const toggleVersion = toggleVersionRef.current + 1;

    toggleVersionRef.current = toggleVersion;
    setState({ enabled: nextEnabled, items: state?.items ?? [] });

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to update release alerts.');
      }

      const nextState = state?.enabled
        ? await disableReleaseAlert(token, contentType, tmdbId)
        : await enableReleaseAlert(token, contentType, tmdbId);

      if (toggleVersionRef.current === toggleVersion) {
        setState(nextState);
      }
    } catch (toggleError) {
      if (toggleVersionRef.current === toggleVersion) {
        setState(previousState);
      }
    }
  }

  const enabled = Boolean(state?.enabled);

  return (
    <Pressable
      accessibilityLabel={enabled ? 'Disable release alert' : 'Enable release alert'}
      accessibilityRole="button"
      accessibilityState={{ selected: enabled }}
      disabled={!firebaseIdToken}
      onPress={toggleAlert}
      style={({ pressed }) => [
        styles.iconButton,
        enabled && styles.iconButtonEnabled,
        pressed && styles.pressed,
      ]}
    >
      {enabled ? (
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
    height: 42,
    width: 42,
  },
  iconButtonEnabled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.78,
  },
});
