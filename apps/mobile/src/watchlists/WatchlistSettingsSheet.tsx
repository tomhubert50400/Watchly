import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { updateWatchlistSettings, WatchlistSettings } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError, hapticSelection } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';

export function WatchlistSettingsSheet({ watchlistId, removeWatchedMovies, showOnHome, visible, onClose, onSaved }: {
  watchlistId: string;
  removeWatchedMovies: boolean;
  showOnHome: boolean;
  visible: boolean;
  onClose: () => void;
  onSaved: (value: WatchlistSettings) => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const [settings, setSettings] = useState({ removeWatchedMovies, showOnHome });
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const ownerRef = useRef(currentUser?.id);
  ownerRef.current = currentUser?.id;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!busy.current) setSettings({ removeWatchedMovies, showOnHome });
  }, [removeWatchedMovies, showOnHome]);

  async function save(key: keyof WatchlistSettings, value: boolean) {
    const ownerId = currentUser?.id;
    if (!ownerId || busy.current) return;
    const previous = settings;
    busy.current = true;
    setSettings({ ...settings, [key]: value });
    setSaving(true);
    hapticSelection();
    try {
      const token = await getFirebaseIdToken();
      if (ownerRef.current !== ownerId || !alive.current) return;
      if (!token) throw new Error('Sign in again to update this watchlist.');
      const result = await updateWatchlistSettings(token, watchlistId, { [key]: value });
      if (ownerRef.current !== ownerId) return;
      if (alive.current) {
        setSettings(result);
        onSaved(result);
      }
      notifyUserDataChanged('watchlists');
    } catch (cause) {
      if (ownerRef.current !== ownerId) return;
      if (alive.current) setSettings(previous);
      hapticError();
      showToast(cause instanceof Error ? cause.message : 'Could not save watchlist settings.', 'error');
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return <BottomActionSheet visible={visible} onClose={onClose} title="Watchlist settings">
    <BottomActionSheetScrollView>
      <View style={styles.row}>
        <Text style={styles.label}>Remove movies after watching</Text>
        <Switch accessibilityLabel="Remove movies after watching" accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving} value={settings.removeWatchedMovies} onValueChange={(value) => void save('removeWatchedMovies', value)}
          trackColor={{ true: colors.accent }} thumbColor={colors.text} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Show in “From your watchlists”</Text>
        <Switch accessibilityLabel="Show in From your watchlists" accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving} value={settings.showOnHome} onValueChange={(value) => void save('showOnHome', value)}
          trackColor={{ true: colors.accent }} thumbColor={colors.text} />
      </View>
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  label: { ...typography.body, color: colors.text, flexShrink: 1 },
});
