import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
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
  const { firebaseIdToken } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<ReleaseAlertState | null>(null);

  const loadAlert = useCallback(async () => {
    if (!firebaseIdToken) {
      setState(null);
      return;
    }

    setIsLoading(true);

    try {
      setState(await getReleaseAlert(firebaseIdToken, contentType, tmdbId));
    } catch (loadError) {
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, tmdbId]);

  useEffect(() => {
    void loadAlert();
  }, [loadAlert]);

  async function toggleAlert() {
    if (!firebaseIdToken || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const nextState = state?.enabled
        ? await disableReleaseAlert(firebaseIdToken, contentType, tmdbId)
        : await enableReleaseAlert(firebaseIdToken, contentType, tmdbId);

      setState(nextState);
    } catch (toggleError) {
      setState(state);
    } finally {
      setIsLoading(false);
    }
  }

  const enabled = Boolean(state?.enabled);

  return (
    <Pressable
      accessibilityLabel={enabled ? 'Disable release alert' : 'Enable release alert'}
      accessibilityRole="button"
      accessibilityState={{ selected: enabled }}
      disabled={!firebaseIdToken || isLoading}
      onPress={toggleAlert}
      style={({ pressed }) => [
        styles.iconButton,
        enabled && styles.iconButtonEnabled,
        (pressed || isLoading) && styles.pressed,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={enabled ? colors.textOnAccent : colors.muted} />
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
