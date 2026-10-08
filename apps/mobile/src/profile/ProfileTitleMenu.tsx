import { type ReactNode, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { removeProfileTitle } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { PosterActionsMenu } from '../components/PosterActionsMenu';
import { useToast } from '../notifications/ToastContext';
import { beginTitleRemoval } from '../sync/titleRemovalUpdates';
import { PROFILE_TITLE_REMOVAL_MESSAGE, refreshAfterProfileTitleRemoval } from './profileTitleRemoval';

export function ProfileTitleMenu({ children, contentType, enabled, label, onOpen, title, tmdbId, width }: {
  children: ReactNode;
  contentType: 'movie' | 'series';
  enabled: boolean;
  label: string;
  onOpen: () => void;
  title: string;
  tmdbId: number;
  width: number;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const [removing, setRemoving] = useState(false);
  const busy = useRef(false);
  const ownerId = currentUser?.id;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const canRemove = enabled && Boolean(ownerId);

  async function remove() {
    if (!canRemove || !ownerId || busy.current || currentOwner.current !== ownerId) return;
    const update = beginTitleRemoval(ownerId, 'profile', { contentType, tmdbId }, true);
    if (!update) return;
    busy.current = true;
    setRemoving(true);
    try {
      const token = await getFirebaseIdToken();
      if (!token || currentOwner.current !== ownerId) throw new Error('Sign in again to remove this title.');
      await removeProfileTitle(token, contentType, tmdbId);
      update.commit();
      await refreshAfterProfileTitleRemoval(ownerId, contentType, tmdbId);
    } catch (error) {
      update.rollback();
      if (currentOwner.current === ownerId) showToast(error instanceof Error ? error.message : 'Could not remove this title.');
    } finally {
      busy.current = false;
      setRemoving(false);
    }
  }

  function confirmRemoval() {
    if (!canRemove || busy.current) return;
    Alert.alert(`Remove "${title}" from your profile?`, PROFILE_TITLE_REMOVAL_MESSAGE,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void remove() }]);
  }

  return <PosterActionsMenu enabled={canRemove} disabled={removing} actionLabel="Remove from profile"
    label={label} onOpen={onOpen} onRemove={confirmRemoval} title={title} width={width}>
    {children}
  </PosterActionsMenu>;
}
