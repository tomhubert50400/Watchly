import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { respondToWatchlistInvitation } from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { colors, radii, spacing, typography } from '../design/tokens';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import type { NotificationItem } from './notificationModel';

export function WatchlistInvitationRow({ item, onResolved }: {
  item: NotificationItem;
  onResolved: (result: { status: 'accepted' | 'declined'; watchlistId: string; title: string }) => void;
}) {
  const { getFirebaseIdToken } = useAuthSession();
  const active = useRef(true);
  const busy = useRef(false);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function respond(accept: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(accept ? 'accept' : 'decline');
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!active.current) return;
      if (!token) throw new Error('Sign in again to answer this invitation.');
      const result = await respondToWatchlistInvitation(token, item.id, accept);
      if (!active.current) return;
      notifyUserDataChanged('watchlists');
      notifyUserDataChanged('notifications');
      onResolved(result);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Could not answer this invitation.');
    } finally {
      busy.current = false;
      if (active.current) setPending(null);
    }
  }
  return <View style={styles.card}>
    <Text style={styles.title}>Watchlist invitation</Text>
    <Text style={styles.body}>{item.body}</Text>
    {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
    <View style={styles.actions}>
      <Button compact label="Decline" variant="secondary" disabled={pending !== null} loading={pending === 'decline'} onPress={() => void respond(false)} />
      <Button compact label="Accept" disabled={pending !== null} loading={pending === 'accept'} onPress={() => void respond(true)} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
