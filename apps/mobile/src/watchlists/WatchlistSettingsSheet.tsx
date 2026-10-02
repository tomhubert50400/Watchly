import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { updateWatchlistSettings } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError, hapticSelection } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';

export function WatchlistSettingsSheet({ watchlistId, removeWatchedMovies, visible, onClose, onSaved }: {
  watchlistId: string;
  removeWatchedMovies: boolean;
  visible: boolean;
  onClose: () => void;
  onSaved: (value: boolean) => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(removeWatchedMovies);
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
    if (!busy.current) setEnabled(removeWatchedMovies);
  }, [removeWatchedMovies]);

  async function save(value: boolean) {
    const ownerId = currentUser?.id;
    if (!ownerId || busy.current) return;
    const previous = enabled;
    busy.current = true;
    setEnabled(value);
    setSaving(true);
    hapticSelection();
    try {
      const token = await getFirebaseIdToken();
      if (ownerRef.current !== ownerId || !alive.current) return;
      if (!token) throw new Error('Sign in again to update this watchlist.');
      const result = await updateWatchlistSettings(token, watchlistId, value);
      if (ownerRef.current !== ownerId) return;
      if (alive.current) {
        setEnabled(result.removeWatchedMovies);
        onSaved(result.removeWatchedMovies);
      }
      notifyUserDataChanged('watchlists');
    } catch (cause) {
      if (ownerRef.current !== ownerId) return;
      if (alive.current) setEnabled(previous);
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
          disabled={saving} value={enabled} onValueChange={(value) => void save(value)}
          trackColor={{ true: colors.accent }} thumbColor={colors.text} />
      </View>
      <Text style={styles.body}>When you mark a movie as watched or log a new viewing, remove it from this watchlist. Turn this off to keep it.</Text>
      <Text style={styles.body}>Applies to future viewings only. Series stay in the list.</Text>
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  label: { ...typography.body, color: colors.text, flexShrink: 1 },
  body: { ...typography.body, color: colors.textMuted, marginVertical: spacing.sm },
});
