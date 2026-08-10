import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addSharedWatchlistMember,
  createSharedVotingSession,
  getSharedWatchlist,
  type SharedWatchlist,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { SectionHeader } from '../components/SectionHeader';
import { TextInput } from '../components/TextInput';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticConfirm, hapticError, hapticSuccess } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { getVoteLifecycle, getVoteLeaders, getVoteRemainingLabel } from './sharedVoteModel';
import { takeHydrationItems } from './requestBoundaries';
import {
  WatchlistDisplayItem,
  WatchlistPage,
  WatchlistPosterGrid,
  WatchlistSection,
} from './WatchlistDetailLayout';

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
  const cacheKey = getPrivateCacheKey(ownerId ?? 'visitor', `shared-watchlist:${route.params.watchlistId}:v3`);
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
  const [isMembersSheetOpen, setIsMembersSheetOpen] = useState(false);
  const [isVoteComposerOpen, setIsVoteComposerOpen] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: watchlist ? () => (
        <Pressable
          accessibilityLabel={`Open members, ${watchlist.memberCount} ${watchlist.memberCount === 1 ? 'member' : 'members'}`}
          accessibilityRole="button"
          onPress={() => setIsMembersSheetOpen(true)}
          style={({ pressed }) => [
            styles.headerMembersButton,
            pressed ? styles.headerMembersButtonPressed : null,
          ]}
        >
          <Users color={colors.text} size={20} strokeWidth={2} />
        </Pressable>
      ) : undefined,
    });
  }, [navigation, watchlist?.memberCount]);

  const commitDetails = useCallback((expectedOwnerId: string, next: SharedListDetails) => {
    if (ownerIdRef.current !== expectedOwnerId) return;
    const owned = { data: next, ownerId: expectedOwnerId };
    ownedDetailsRef.current = owned;
    setOwnedDetails(owned);
    void writePersistedCache(
      getPrivateCacheKey(expectedOwnerId, `shared-watchlist:${route.params.watchlistId}:v3`),
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
    setMemberError(null);
    try {
      const token = await getFirebaseIdToken();
      if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to add a member.');
      await addSharedWatchlistMember(token, snapshot.watchlist.id, cleanUserId);
      if (ownerIdRef.current !== expectedOwnerId) return;
      setMemberUserId('');
      resource.revalidate();
      hapticConfirm();
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        setMemberError(error instanceof Error ? error.message : 'Could not add this member.');
        hapticError();
      }
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
    setVoteError(null);
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
      setIsVoteComposerOpen(false);
      hapticSuccess();
      navigation.navigate('SharedVotingSession', {
        sessionId: created.id, title: created.title, watchlistId: snapshot.watchlist.id,
      });
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        setVoteError(error instanceof Error ? error.message : 'Could not create the vote.');
        hapticError();
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setIsCreatingVote(false);
    }
  }

  function openItem(item: WatchlistDisplayItem) {
    const title = item.title ?? (item.contentType === 'movie' ? 'Film' : 'Series');

    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title, tmdbId: item.tmdbId });
      return;
    }

    navigation.navigate('SeriesDetail', { title, tmdbId: item.tmdbId });
  }

  if (!ownerId || !firebaseIdToken) {
    return (
      <WatchlistPage>
        <SignInRequiredCard
          body="You need to be signed in to use member-only shared lists. Sign in here to open this list."
          title="Sign in to view this shared list"
        />
      </WatchlistPage>
    );
  }
  if (resource.isInitialLoading && !details) {
    return <WatchlistPage><LoadingState label="Loading list" /></WatchlistPage>;
  }
  if (resource.error && !details) {
    return (
      <WatchlistPage>
        <EmptyState body={resource.error} title="Shared list unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      </WatchlistPage>
    );
  }
  if (!details || !watchlist) return null;

  const statusBanner = voteError
    ? <InlineStatusBanner detail={voteError} tone="error" />
    : undefined;
  const memberForm = watchlist.isOwner ? (
    <View style={styles.memberForm}>
      <Text style={styles.memberFormTitle}>Add a member</Text>
      <Text style={styles.composerCopy}>Use their profile code to give them access.</Text>
      {memberError ? <InlineStatusBanner detail={memberError} tone="error" /> : null}
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        label="Profile code"
        onChangeText={(value) => {
          setMemberUserId(value);
          setMemberError(null);
        }}
        value={memberUserId}
      />
      <Button
        disabled={!memberUserId.trim()}
        fullWidth
        label="Add member"
        loading={isAddingMember}
        onPress={handleAddMember}
      />
    </View>
  ) : undefined;

  return (
    <>
      <WatchlistPage
        footer={isVoteComposerOpen ? (
          <Button
            disabled={!sessionTitle.trim() || details.hydratedItems.length === 0}
            fullWidth
            label="Create vote"
            loading={isCreatingVote}
            onPress={handleCreateVote}
          />
        ) : undefined}
        isRefreshing={resource.isRefreshing}
        onRefresh={resource.retry}
      >
        {statusBanner}

        <WatchlistSection>
          <SectionHeader title="Titles" />
          {details.hydratedItems.length === 0 ? (
            <Text style={styles.emptyCopy}>
              Add titles from their detail pages before starting a vote.
            </Text>
          ) : (
            <WatchlistPosterGrid items={details.hydratedItems} onOpen={openItem} />
          )}
        </WatchlistSection>

        <WatchlistSection>
          <SectionHeader
            actionLabel={isVoteComposerOpen ? 'Cancel' : 'New vote'}
            onActionPress={() => setIsVoteComposerOpen((current) => !current)}
            title="Voting"
          />
          {isVoteComposerOpen ? (
            <View style={styles.composer}>
              <Text style={styles.composerCopy}>Every title in this list becomes a candidate.</Text>
              <TextInput
                label="Vote title"
                maxLength={80}
                onChangeText={setSessionTitle}
                value={sessionTitle}
              />
            </View>
          ) : null}
          {watchlist.votingSessions.length === 0 ? (
            <Text style={styles.emptyCopy}>No voting sessions yet.</Text>
          ) : (
            <View style={styles.sessionList}>
              {watchlist.votingSessions.map((session) => {
                const lifecycle = getVoteLifecycle(session);
                const leaders = getVoteLeaders(session.candidates);
                const summary = leaders.maxVotes === 0
                  ? 'No votes yet'
                  : leaders.isTie
                    ? `Tie · ${leaders.maxVotes} votes`
                    : `Leader · ${leaders.maxVotes} votes`;

                return (
                  <Pressable
                    accessibilityLabel={`Open vote ${session.title}, ${lifecycle}`}
                    accessibilityRole="button"
                    key={session.id}
                    onPress={() => navigation.navigate('SharedVotingSession', {
                      sessionId: session.id,
                      title: session.title,
                      watchlistId: watchlist.id,
                    })}
                    style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
                  >
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                      <Text style={styles.meta}>{summary} · {getVoteRemainingLabel(session)}</Text>
                    </View>
                    <View style={[styles.statusPill, lifecycle !== 'open' && styles.statusPillNeutral]}>
                      <Text style={[styles.statusText, lifecycle !== 'open' && styles.statusTextNeutral]}>
                        {lifecycle}
                      </Text>
                    </View>
                    <ChevronRight color={colors.textSubtle} size={19} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </WatchlistSection>
      </WatchlistPage>

      <BottomActionSheet
        footer={memberForm}
        onClose={() => {
          setIsMembersSheetOpen(false);
          setMemberError(null);
          setMemberUserId('');
        }}
        title="Members"
        visible={isMembersSheetOpen}
      >
        <BottomActionSheetScrollView
          contentContainerStyle={styles.membersSheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.membersCount}>
            {watchlist.memberCount} {watchlist.memberCount === 1 ? 'member' : 'members'}
          </Text>

          <View style={styles.memberList}>
            {watchlist.members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.memberName}>
                  {member.displayName?.trim() || 'Unnamed member'}
                </Text>
              </View>
            ))}
          </View>
        </BottomActionSheetScrollView>
      </BottomActionSheet>
    </>
  );
}

function initials(name: string | null) {
  const value = name?.trim();
  if (!value) return 'W';
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  avatarText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  composerCopy: { ...typography.body, color: colors.textMuted },
  composer: { backgroundColor: colors.panelSoft, borderRadius: radii.lg, gap: spacing.md, padding: spacing.md },
  emptyCopy: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.sm },
  headerMembersButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  headerMembersButtonPressed: { backgroundColor: colors.panelElevated },
  memberForm: { gap: spacing.sm },
  memberFormTitle: { ...typography.title, color: colors.text },
  memberList: { borderTopColor: colors.border, borderTopWidth: 1 },
  memberName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  memberRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 62, paddingVertical: spacing.sm },
  membersCount: { ...typography.meta, color: colors.textSubtle, paddingBottom: spacing.md },
  membersSheetContent: { paddingBottom: spacing.lg },
  meta: { ...typography.meta, color: colors.textSubtle, marginTop: 3 },
  pressed: { opacity: 0.75 },
  sessionRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 68, paddingVertical: spacing.sm },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionList: { borderTopColor: colors.border, borderTopWidth: 1 },
  sessionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statusPill: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusPillNeutral: { backgroundColor: colors.panelElevated },
  statusText: { color: colors.accentText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusTextNeutral: { color: colors.textMuted },
});
