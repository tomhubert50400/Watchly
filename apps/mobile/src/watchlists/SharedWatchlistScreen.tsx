import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, RefreshCw, Users, Vote } from 'lucide-react-native';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  addSharedWatchlistMember,
  createSharedVotingSession,
  getSharedWatchlist,
  type SharedWatchlist,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { getVoteLifecycle, getVoteLeaders, getVoteRemainingLabel } from './sharedVoteModel';
import { takeHydrationItems } from './requestBoundaries';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedWatchlist'>;
type HydratedItem = SharedWatchlist['items'][number] & { posterUrl: string | null; title: string | null };
type SharedListDetails = { hydratedItems: HydratedItem[]; watchlist: SharedWatchlist };
type OwnedDetails = { data: SharedListDetails | null; ownerId: string | null };
const MAX_SHARED_WATCHLIST_HYDRATIONS = 12;

export function SharedWatchlistScreen({ navigation, route }: Props) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const ownerId = currentUser?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const cacheKey = getPrivateCacheKey(ownerId ?? 'visitor', `shared-watchlist:${route.params.watchlistId}:v2`);
  const load = useCallback(async (cached?: SharedListDetails): Promise<SharedListDetails> => {
    const expectedOwnerId = ownerId;
    const token = await getFirebaseIdToken();
    if (!expectedOwnerId || ownerIdRef.current !== expectedOwnerId || !token) {
      throw new Error('Sign in again to load this shared list.');
    }

    const watchlist = await getSharedWatchlist(token, route.params.watchlistId);
    if (ownerIdRef.current !== expectedOwnerId) {
      throw new Error('The active account changed while loading this list.');
    }

    const hydrationIds = new Set(
      takeHydrationItems(watchlist.items, MAX_SHARED_WATCHLIST_HYDRATIONS).map((item) => item.id),
    );
    const hydratedItems = await Promise.all(watchlist.items.map(async (item): Promise<HydratedItem> => {
      const previous = cached?.hydratedItems.find((candidate) => candidate.id === item.id);
      if (!hydrationIds.has(item.id)) {
        return { ...item, posterUrl: previous?.posterUrl ?? null, title: previous?.title ?? null };
      }
      try {
        const media = item.contentType === 'movie'
          ? await refreshMovie(item.tmdbId)
          : await refreshSeries(item.tmdbId);
        return { ...item, posterUrl: media.posterUrl, title: media.title };
      } catch {
        return { ...item, posterUrl: previous?.posterUrl ?? null, title: previous?.title ?? null };
      }
    }));

    if (ownerIdRef.current !== expectedOwnerId) {
      throw new Error('The active account changed while loading this list.');
    }
    return { hydratedItems, watchlist };
  }, [getFirebaseIdToken, ownerId, refreshMovie, refreshSeries, route.params.watchlistId]);
  const resource = useCachedResource<SharedListDetails>({
    enabled: Boolean(ownerId && firebaseIdToken),
    key: cacheKey,
    load,
  });
  const [ownedDetails, setOwnedDetails] = useState<OwnedDetails>({ data: null, ownerId: null });
  const ownedDetailsRef = useRef(ownedDetails);
  const [memberUserId, setMemberUserId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('Tonight');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isCreatingVote, setIsCreatingVote] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      const empty = { data: null, ownerId: null };
      ownedDetailsRef.current = empty;
      setOwnedDetails(empty);
      return;
    }
    if (resource.data) {
      const next = { data: resource.data, ownerId };
      ownedDetailsRef.current = next;
      setOwnedDetails(next);
    }
  }, [ownerId, resource.data]);

  const details = ownedDetails.ownerId === ownerId ? ownedDetails.data : null;
  const watchlist = details?.watchlist ?? null;

  const commitDetails = useCallback((expectedOwnerId: string, next: SharedListDetails) => {
    if (ownerIdRef.current !== expectedOwnerId) return;
    const owned = { data: next, ownerId: expectedOwnerId };
    ownedDetailsRef.current = owned;
    setOwnedDetails(owned);
    void writePersistedCache(
      getPrivateCacheKey(expectedOwnerId, `shared-watchlist:${route.params.watchlistId}:v2`),
      next,
    ).catch(() => undefined);
  }, [route.params.watchlistId]);

  async function handleAddMember() {
    const expectedOwnerId = ownerIdRef.current;
    const owned = ownedDetailsRef.current;
    const snapshot = owned.data;
    const cleanUserId = memberUserId.trim();
    if (!expectedOwnerId || owned.ownerId !== expectedOwnerId || !snapshot?.watchlist.isOwner || !cleanUserId || isAddingMember) return;
    setIsAddingMember(true);
    setMutationError(null);
    try {
      const token = await getFirebaseIdToken();
      if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to add a member.');
      await addSharedWatchlistMember(token, snapshot.watchlist.id, cleanUserId);
      if (ownerIdRef.current !== expectedOwnerId) return;
      setMemberUserId('');
      resource.retry();
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) setMutationError(error instanceof Error ? error.message : 'Could not add this member.');
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setIsAddingMember(false);
    }
  }

  async function handleCreateVote() {
    const expectedOwnerId = ownerIdRef.current;
    const owned = ownedDetailsRef.current;
    const snapshot = owned.data;
    const title = sessionTitle.trim();
    if (!expectedOwnerId || owned.ownerId !== expectedOwnerId || !snapshot || !title || snapshot.watchlist.items.length === 0 || isCreatingVote) return;
    setIsCreatingVote(true);
    setMutationError(null);
    try {
      const token = await getFirebaseIdToken();
      if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to create a vote.');
      const created = await createSharedVotingSession(token, snapshot.watchlist.id, {
        itemIds: snapshot.watchlist.items.map((item) => item.id), title,
      });
      if (ownerIdRef.current !== expectedOwnerId) return;
      commitDetails(expectedOwnerId, {
        ...snapshot,
        watchlist: { ...snapshot.watchlist, votingSessions: [created, ...snapshot.watchlist.votingSessions] },
      });
      setSessionTitle('Tonight');
      navigation.navigate('SharedVotingSession', {
        sessionId: created.id, title: created.title, watchlistId: snapshot.watchlist.id,
      });
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) setMutationError(error instanceof Error ? error.message : 'Could not create the vote.');
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setIsCreatingVote(false);
    }
  }

  if (!ownerId || !firebaseIdToken) {
    return <Screen title=""><EmptyState body="Sign in from Profile to open member-only shared lists." title="Sign in required" /></Screen>;
  }
  if (resource.isInitialLoading && !details) {
    return <Screen title="" statusBanner={<InlineStatusBanner detail="Loading this private shared list." tone="updating" />} />;
  }
  if (resource.error && !details) {
    return <Screen title=""><EmptyState body={resource.error} title="Shared list unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState></Screen>;
  }
  if (!details || !watchlist) return null;

  const statusBanner = resource.isRefreshing
    ? <InlineStatusBanner detail="Keeping saved titles visible." tone="updating" />
    : resource.error
      ? <InlineStatusBanner detail={resource.error} onRetry={resource.retry} tone="offline" />
      : mutationError
        ? <InlineStatusBanner detail={mutationError} tone="error" />
        : undefined;

  return (
    <Screen
      eyebrow="Member-only shared list"
      refreshControl={<RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} />}
      statusBanner={statusBanner}
      title={watchlist.name}
      trailing={
        <Pressable
          accessibilityLabel="Refresh shared list"
          accessibilityRole="button"
          onPress={resource.retry}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <RefreshCw color={colors.textMuted} size={20} />
        </Pressable>
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroMetric}><Users color={colors.accentText} size={20} /><Text style={styles.metricValue}>{watchlist.memberCount}</Text><Text style={styles.metricLabel}>members</Text></View>
        <View style={styles.divider} />
        <View style={styles.heroMetric}><Vote color={colors.accentText} size={20} /><Text style={styles.metricValue}>{watchlist.votingSessions.length}</Text><Text style={styles.metricLabel}>votes</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Titles</Text>
      {details.hydratedItems.length === 0 ? <Text style={styles.emptyCopy}>Add titles from their detail pages before starting a vote.</Text> : (
        <View style={styles.posterGrid}>{details.hydratedItems.map((item) => (
          <View key={item.id} style={styles.posterTile}>
            <MediaPoster accessibilityLabel={item.title ? `${item.title} poster` : 'Unavailable title poster'} posterUrl={item.posterUrl} style={styles.poster} />
            <Text numberOfLines={2} style={styles.posterTitle}>{item.title ?? 'Title unavailable'}</Text>
            <Text style={styles.meta}>{item.contentType === 'movie' ? 'Film' : 'Series'}</Text>
          </View>
        ))}</View>
      )}

      <Text style={styles.sectionTitle}>Voting sessions</Text>
      {watchlist.votingSessions.length === 0 ? <Text style={styles.emptyCopy}>No voting sessions yet.</Text> : (
        <View style={styles.sessionList}>{watchlist.votingSessions.map((session) => {
          const lifecycle = getVoteLifecycle(session);
          const leaders = getVoteLeaders(session.candidates);
          const summary = leaders.maxVotes === 0 ? 'No votes yet' : leaders.isTie ? `Tie · ${leaders.maxVotes} votes` : `Leader · ${leaders.maxVotes} votes`;
          return <Pressable
            accessibilityLabel={`Open vote ${session.title}, ${lifecycle}`}
            accessibilityRole="button"
            key={session.id}
            onPress={() => navigation.navigate('SharedVotingSession', { sessionId: session.id, title: session.title, watchlistId: watchlist.id })}
            style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
          >
            <View style={styles.sessionCopy}><Text style={styles.sessionTitle}>{session.title}</Text><Text style={styles.meta}>{summary} · {getVoteRemainingLabel(session)}</Text></View>
            <View style={[styles.statusPill, lifecycle !== 'open' && styles.statusPillNeutral]}><Text style={[styles.statusText, lifecycle !== 'open' && styles.statusTextNeutral]}>{lifecycle}</Text></View>
            <ChevronRight color={colors.textSubtle} size={20} />
          </Pressable>;
        })}</View>
      )}

      <View style={styles.createCard}>
        <Text style={styles.cardTitle}>Start a vote</Text>
        <Text style={styles.cardBody}>All current titles become candidates on a dedicated voting screen.</Text>
        <TextInput label="Vote title" maxLength={80} onChangeText={setSessionTitle} value={sessionTitle} />
        <Button disabled={!sessionTitle.trim() || details.hydratedItems.length === 0} fullWidth label="Create vote" loading={isCreatingVote} onPress={handleCreateVote} />
      </View>

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.memberList}>{watchlist.members.map((member) => (
        <View key={member.id} style={styles.memberRow}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(member.displayName)}</Text></View><Text numberOfLines={1} style={styles.memberName}>{member.displayName?.trim() || 'Unnamed member'}</Text></View>
      ))}</View>
      {watchlist.isOwner ? <View style={styles.ownerCard}>
        <Text style={styles.cardTitle}>Owner tools</Text>
        <Text style={styles.cardBody}>Invite a member with their real profile code.</Text>
        <TextInput label="Profile code" onChangeText={setMemberUserId} value={memberUserId} />
        <Button disabled={!memberUserId.trim()} fullWidth label="Add member" loading={isAddingMember} onPress={handleAddMember} variant="secondary" />
      </View> : null}
    </Screen>
  );
}

function initials(name: string | null) {
  const value = name?.trim();
  if (!value) return 'W';
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: colors.accentText, fontSize: 11, fontWeight: '800' },
  cardBody: { ...typography.body, color: colors.textMuted },
  cardTitle: { ...typography.title, color: colors.text },
  createCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, marginTop: spacing.xl, padding: spacing.lg },
  divider: { alignSelf: 'stretch', backgroundColor: colors.border, width: 1 },
  emptyCopy: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  heroCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.xl, padding: spacing.lg },
  heroMetric: { alignItems: 'center', flex: 1, gap: spacing.xs },
  memberList: { gap: spacing.sm },
  memberName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  memberRow: { alignItems: 'center', backgroundColor: colors.panelSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, minHeight: touchTargets.min, padding: spacing.sm },
  meta: { ...typography.meta, color: colors.textSubtle, marginTop: 3 },
  metricLabel: { ...typography.meta, color: colors.textSubtle },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  ownerCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, marginTop: spacing.md, padding: spacing.lg },
  poster: { borderRadius: radii.md, height: 174, width: '100%' },
  posterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  posterTile: { width: '47%' },
  posterTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: spacing.sm },
  pressed: { opacity: 0.75 },
  refreshButton: { alignItems: 'center', justifyContent: 'center', minHeight: touchTargets.min, minWidth: touchTargets.min },
  sectionTitle: { ...typography.title, color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  sessionCard: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.md },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionList: { gap: spacing.sm },
  sessionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statusPill: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusPillNeutral: { backgroundColor: colors.panelElevated },
  statusText: { color: colors.accentText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusTextNeutral: { color: colors.textMuted },
});
