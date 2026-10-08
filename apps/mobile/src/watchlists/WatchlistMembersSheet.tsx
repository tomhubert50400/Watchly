import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { WatchlistSearchField } from './WatchlistSearchField';
import {
  inviteSharedWatchlistMember, leaveSharedWatchlist, searchWatchlistInvitees,
  type SharedWatchlist, type WatchlistInvitee,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { clearMemoryResourcesWithPrefix } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, removePersistedCachesWithPrefix } from '../cache/persistedCache';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, typography } from '../design/tokens';
import { notifyUserDataChanged } from '../sync/userDataEvents';

export function WatchlistMembersSheet({ watchlist, onClose, onLeft }: {
  watchlist: SharedWatchlist; onClose: () => void; onLeft: () => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const active = useRef(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WatchlistInvitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const [sentName, setSentName] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    const clean = query.trim().replace(/^@/, '');
    setResults([]);
    setSearchError(null);
    setLoading(!clean || clean.length >= 2);
    if (clean.length === 1) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getFirebaseIdToken();
          if (cancelled || !active.current) return;
          if (!token) throw new Error('Sign in again to search accounts.');
          const response = await searchWatchlistInvitees(token, watchlist.id, clean);
          if (!cancelled && active.current) setResults(response.items);
        } catch (cause) {
          if (!cancelled && active.current) setSearchError(cause instanceof Error ? cause.message : 'Could not search accounts.');
        } finally {
          if (!cancelled && active.current) setLoading(false);
        }
      })();
    }, clean ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [getFirebaseIdToken, query, searchRevision, watchlist.id]);

  async function invite(person: WatchlistInvitee) {
    if (busy.current) return;
    busy.current = true;
    setPendingId(person.id);
    setError(null);
    setSentName(null);
    try {
      const token = await getFirebaseIdToken();
      if (!active.current) return;
      if (!token) throw new Error('Sign in again to invite someone.');
      await inviteSharedWatchlistMember(token, watchlist.id, person.id);
      if (!active.current) return;
      setResults((current) => current.map((row) => row.id === person.id ? { ...row, state: 'pending' } : row));
      setSentName(person.displayName);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Could not send the invitation.');
    } finally {
      busy.current = false;
      if (active.current) setPendingId(null);
    }
  }

  async function leave() {
    if (busy.current || !active.current) return;
    busy.current = true;
    setPendingId('leave');
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!active.current) return;
      if (!token) throw new Error('Sign in again to leave this watchlist.');
      await leaveSharedWatchlist(token, watchlist.id);
      if (!active.current) return;
      const cachePrefix = getPrivateCacheKey(currentUser!.id, `shared-watchlist:${watchlist.id}:`);
      clearMemoryResourcesWithPrefix(cachePrefix);
      await removePersistedCachesWithPrefix(cachePrefix);
      if (!active.current) return;
      notifyUserDataChanged('watchlists');
      onLeft();
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Could not leave this watchlist.');
    } finally {
      busy.current = false;
      if (active.current) setPendingId(null);
    }
  }

  const cleanQuery = query.trim().replace(/^@/, '');
  return <BottomActionSheet title="Members" visible onClose={onClose}>
    <BottomActionSheetScrollView disableScrollViewPanResponder={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
      {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
      <View style={styles.search}>
        <Text style={styles.heading}>Invite people</Text>
        <Text style={styles.copy}>Find someone on Watchly. They will receive a request and choose whether to join.</Text>
        <Text style={styles.copy}>Search accounts</Text>
        <WatchlistSearchField label="Search accounts" placeholder="Name or @username" value={query} onChangeText={setQuery} />
        {sentName ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Invitation sent to {sentName}.</Text> : null}
        <Text style={styles.caption}>{cleanQuery ? 'Search results' : 'People you follow and your followers'}</Text>
        {searchError ? <View style={styles.search}>
          <InlineStatusBanner detail={searchError} tone="error" />
          <Button compact label="Retry search" variant="secondary" onPress={() => setSearchRevision((value) => value + 1)} />
        </View> : loading ? <Text style={styles.copy}>Searching accounts...</Text> : results.length === 0 ?
          <Text style={styles.copy}>{cleanQuery.length === 1 ? 'Type at least 2 characters.' : cleanQuery ? 'No accounts found. Try another name or username.' : 'Search by name or username to find more people.'}</Text> : null}
        {results.map((person) => <View key={person.id} style={styles.row}>
          <UserAvatar avatarUrl={person.avatarUrl} displayName={person.displayName} size={40} />
          <View style={styles.person}>
            <Text numberOfLines={1} style={styles.name}>{person.displayName}</Text>
            <Text numberOfLines={1} style={styles.copy}>@{person.handle}</Text>
            {person.isFollowing || person.followsYou ? <Text style={styles.caption}>
              {person.isFollowing && person.followsYou ? 'You follow each other' : person.isFollowing ? 'Following' : 'Follows you'}
            </Text> : null}
            {person.state === 'restricted' ? <Text style={styles.caption}>Only accepts invitations from people they follow</Text> : null}
          </View>
          {person.state === 'available' ? <Button compact label="Invite" disabled={pendingId !== null}
            loading={pendingId === person.id} onPress={() => void invite(person)} /> :
            <Text style={styles.state}>{person.state === 'pending' ? 'Invited' : person.state === 'member' ? 'Member' : person.state === 'recently_invited' ? 'Recently invited' : 'Private'}</Text>}
        </View>)}
      </View>
      <Text style={styles.heading}>{watchlist.memberCount} {watchlist.memberCount === 1 ? 'member' : 'members'}</Text>
      {watchlist.members.map((member) => <View key={member.id} style={styles.row}>
        <UserAvatar avatarUrl={member.avatarUrl ?? null} displayName={member.displayName} size={40} />
        <Text style={styles.name}>{member.displayName || 'Watchly member'}</Text>
      </View>)}
      {!watchlist.isOwner ? <Button label="Leave watchlist" variant="danger" loading={pendingId === 'leave'}
        onPress={() => Alert.alert('Leave watchlist?', `You will lose access to “${watchlist.name}”. You can join again if you receive a new invitation.`, [
          { text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => void leave() },
        ])} /> : null}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.lg },
  search: { gap: spacing.sm, marginBottom: spacing.lg },
  heading: { ...typography.title, color: colors.text },
  copy: { ...typography.meta, color: colors.textMuted },
  caption: { ...typography.meta, color: colors.textSubtle },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  person: { flex: 1, minWidth: 0, gap: 2 },
  state: { ...typography.meta, color: colors.textSubtle, maxWidth: 75 },
});
