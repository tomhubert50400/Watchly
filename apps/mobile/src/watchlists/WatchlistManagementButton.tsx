import { useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { deleteSharedWatchlist, leaveSharedWatchlist } from '../api/sharedWatchlists';
import { deleteWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { clearMemoryResourcesWithPrefix } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, removePersistedCache } from '../cache/persistedCache';
import { BottomActionSheet } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { colors, spacing, typography } from '../design/tokens';
import { LibraryListItem } from '../library/useLibraryData';
import { useWatchlistCache } from './WatchlistCacheContext';

export function WatchlistManagementButton({ list, onRemoved }: { list: LibraryListItem; onRemoved: (key: string) => void }) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { removePersonalWatchlist, removeSharedWatchlist } = useWatchlistCache();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerRef = useRef(currentUser?.id);
  const busyRef = useRef(false);
  ownerRef.current = currentUser?.id;
  const leaving = list.kind === 'shared' && !list.isOwner;
  const label = leaving ? 'Leave watchlist' : 'Delete watchlist';
  async function remove() {
    const ownerId = currentUser?.id;
    if (!ownerId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (ownerRef.current !== ownerId) return;
      if (!token) throw new Error('Sign in again to update this watchlist.');
      if (list.kind === 'personal') await deleteWatchlist(token, list.id);
      else if (leaving) await leaveSharedWatchlist(token, list.id);
      else await deleteSharedWatchlist(token, list.id);
      if (ownerRef.current !== ownerId) return;
      if (list.kind === 'personal') removePersonalWatchlist(list.id);
      else {
        removeSharedWatchlist(list.id);
        const detailKey = getPrivateCacheKey(ownerId, `shared-watchlist:${list.id}:v3`);
        clearMemoryResourcesWithPrefix(detailKey);
        await removePersistedCache(detailKey).catch(() => undefined);
        if (ownerRef.current !== ownerId) return;
      }
      setOpen(false);
      onRemoved(list.key);
    } catch (cause) {
      if (ownerRef.current === ownerId) setError(cause instanceof Error ? cause.message : 'Could not update this watchlist.');
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${list.name}`} onPress={() => { setError(null); setOpen(true); }} style={styles.trigger}><Ellipsis color={colors.textMuted} size={20} /></Pressable>
    <BottomActionSheet title={`${label}?`} visible={open} onClose={() => { if (!busy) setOpen(false); }} footer={<Button label={label} variant="danger" loading={busy} disabled={busy} onPress={() => void remove()} fullWidth />}>
      <Text style={styles.copy}>{leaving ? `You will lose access to “${list.name}”. Its other members will keep the list.` : list.kind === 'shared' ? `“${list.name}” will be deleted for every member. This cannot be undone.` : `“${list.name}” will be deleted. Your viewing history and ratings will stay unchanged.`}</Text>
      {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
    </BottomActionSheet>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { ...typography.body, color: colors.textMuted, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
});
