import { useRef } from 'react';
import { Alert } from 'react-native';
import { removeSharedWatchlistItem } from '../api/sharedWatchlists';
import { removeWatchlistItem } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useToast } from '../notifications/ToastContext';
import { PROFILE_TITLE_REMOVAL_MESSAGE, refreshAfterProfileTitleRemoval } from '../profile/profileTitleRemoval';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { beginTitleRemoval } from '../sync/titleRemovalUpdates';
import type { WatchlistDisplayItem } from './WatchlistDetailLayout';

export type WatchlistItemRemoval = {
  kind: 'personal' | 'shared';
  watchlistId: string;
  name: string;
  isPlanned?: boolean;
  onRemoved: (item: WatchlistDisplayItem) => void;
};

export function useWatchlistRemoval(removal: WatchlistItemRemoval) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const pending = useRef(new Set<string>());
  const ownerId = currentUser?.id;
  const scope = `${ownerId}:${removal.kind}:${removal.watchlistId}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const removesProfile = Boolean(removal.isPlanned);

  async function remove(item: WatchlistDisplayItem) {
    if (!ownerId || pending.current.has(item.id) || currentScope.current !== scope) return;
    const update = beginTitleRemoval(ownerId, `${removal.kind}:${removal.watchlistId}`, item, removesProfile);
    if (!update) return;
    pending.current.add(item.id);
    try {
      const token = await getFirebaseIdToken();
      if (!token || currentScope.current !== scope) throw new Error('Sign in again to update this watchlist.');
      await (removal.kind === 'shared' ? removeSharedWatchlistItem : removeWatchlistItem)(token, removal.watchlistId, item.contentType, item.tmdbId);
      update.commit();
      if (currentScope.current === scope) removal.onRemoved(item);
      if (removesProfile) await refreshAfterProfileTitleRemoval(ownerId, item.contentType, item.tmdbId);
      else notifyUserDataChanged('watchlists', ...(removal.isPlanned ? ['tracking' as const] : []));
    } catch (error) {
      update.rollback();
      if (currentScope.current === scope) showToast(error instanceof Error ? error.message : 'Could not remove this title.');
    } finally {
      pending.current.delete(item.id);
    }
  }

  function removeDroppedItem(item: WatchlistDisplayItem) {
    if (!ownerId || pending.current.has(item.id)) return;
    if (!removesProfile) { void remove(item); return; }
    Alert.alert(`Remove "${item.title || 'this title'}" from ${removal.name}?`, PROFILE_TITLE_REMOVAL_MESSAGE,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void remove(item) }]);
  }
  return { removeDroppedItem };
}
