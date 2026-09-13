import { useRef, useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { deleteSharedWatchlist, leaveSharedWatchlist } from '../api/sharedWatchlists';
import { deleteWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { clearMemoryResourcesWithPrefix } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, removePersistedCache } from '../cache/persistedCache';
import { colors } from '../design/tokens';
import { LibraryListItem } from '../library/useLibraryData';
import { useWatchlistCache } from './WatchlistCacheContext';

export function WatchlistManagementButton({ list, onRemoved }: { list: LibraryListItem; onRemoved: (key: string) => void }) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { removePersonalWatchlist, removeSharedWatchlist } = useWatchlistCache();
  const [busy, setBusy] = useState(false);
  const ownerRef = useRef(currentUser?.id);
  const busyRef = useRef(false);
  ownerRef.current = currentUser?.id;
  const leaving = list.kind === 'shared' && !list.isOwner;
  const label = leaving ? 'Leave watchlist' : 'Delete watchlist';
  async function remove() {
    const ownerId = currentUser?.id;
    if (!ownerId || ownerRef.current !== ownerId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
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
      onRemoved(list.key);
    } catch (cause) {
      if (ownerRef.current === ownerId) Alert.alert(leaving ? 'Could not leave watchlist' : 'Could not delete watchlist', cause instanceof Error ? cause.message : 'Could not update this watchlist.');
    } finally { busyRef.current = false; setBusy(false); }
  }
  function confirmRemoval() {
    Alert.alert(`${label}?`, leaving ? `You will lose access to “${list.name}”. Its other members will keep the list.` : list.kind === 'shared' ? `“${list.name}” will be deleted for every member. This cannot be undone.` : `“${list.name}” will be deleted. Your viewing history and ratings will stay unchanged.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: leaving ? 'Leave' : 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${list.name}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={confirmRemoval} style={styles.trigger}>
    {busy ? <ActivityIndicator color={colors.text} size="small" /> : leaving ? <LogOut color={colors.text} size={19} /> : <Trash2 color={colors.text} size={19} />}
  </Pressable>;
}
const styles = StyleSheet.create({
  trigger: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(9, 12, 19, 0.72)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
