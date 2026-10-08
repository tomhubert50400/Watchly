import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, ChevronDown, ChevronUp, Funnel, Plus, Users, Vote } from 'lucide-react-native';
import { type GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  createSharedVotingSession,
  dismissSharedVotingSession,
  deleteSharedVotingSession,
  getSharedWatchlist,
  type SharedWatchlist,
  type SharedVotingSession,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { SegmentedControl } from '../components/SegmentedControl';
import { WatchlistBackground } from './WatchlistBackground';
import { getWatchlistBackgroundItem } from './watchlistCover';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { isTitleRemoved, useTitleRemovalUpdates } from '../sync/titleRemovalUpdates';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';
import { CreateSharedVoteSheet, type SharedVoteOptions } from './CreateSharedVoteSheet';
import { WatchlistActionsMenu } from './WatchlistActionsMenu';
import { WatchlistMembersSheet } from './WatchlistMembersSheet';
import { useWatchlistTrashHeader } from './WatchlistTrashHeader';
import { draggedPosterCenter } from './watchlistTrashTarget';
import { useWatchlistRemoval } from './useWatchlistRemoval';
import { WatchlistArtworkSheet } from './WatchlistArtworkSheet';
import { getVoteLifecycle, isRecentVoteResult } from './sharedVoteModel';
import { InlineSharedVote, type VoteUpdateOptions } from './InlineSharedVote';
import { useVoteExpansion } from './useVoteExpansion';
import { voteMediaKey } from './VoteTitlePicker';
import { hydrateWatchlistItems } from './personalWatchlistHydration';
import {
  useWatchlistFilters,
  WatchlistFiltersSheet,
  WatchlistFilterStatus,
} from './WatchlistFilters';
import {
  WatchlistDisplayItem,
  WatchlistPage,
  WatchlistPosterGrid,
  WatchlistSection,
} from './WatchlistDetailLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedWatchlist'>;
type HydratedItem = SharedWatchlist['items'][number] & {
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
};
type SharedListDetails = { hydratedItems: HydratedItem[]; watchlist: SharedWatchlist; loadedAt?: number };
type OwnedDetails = { data: SharedListDetails | null; ownerId: string | null };
type DraggedTitle = { item: WatchlistDisplayItem; point: { x: number; y: number }; gripX: number; gripY: number; width: number };

export function SharedWatchlistScreen({ navigation, route }: Props) {
  const watchlistsRevision = useUserDataRevision('watchlists');
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const ownerId = currentUser?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const resourceScope = JSON.stringify([ownerId, 'shared', route.params.watchlistId]);
  const scopeRef = useRef({ key: resourceScope });
  if (scopeRef.current.key !== resourceScope) scopeRef.current = { key: resourceScope };
  const voteSync = useMemo(() => ({ revision: 0, pending: new Set<string>(), loads: new WeakMap<SharedListDetails, number>() }), [resourceScope]);
  const cacheKey = getPrivateCacheKey(ownerId ?? 'visitor', `shared-watchlist:${route.params.watchlistId}:v3`);
  const load = useCallback(async (cached?: SharedListDetails): Promise<SharedListDetails> => {
    const loadedAt = Date.now();
    const voteRevision = voteSync.revision;
    const expectedOwnerId = ownerId;
    const expectedScope = scopeRef.current;
    const token = await getFirebaseIdToken();
    if (!expectedOwnerId || scopeRef.current !== expectedScope || !token) {
      throw new Error('Sign in again to load this shared list.');
    }

    const watchlist = await getSharedWatchlist(token, route.params.watchlistId);
    if (scopeRef.current !== expectedScope) {
      throw new Error('The active account changed while loading this list.');
    }

    const current = ownedDetailsRef.current;
    const previousItems = current.ownerId === expectedOwnerId && current.data?.watchlist.id === watchlist.id
      ? current.data.hydratedItems : cached?.hydratedItems;
    const previousByMedia = new Map(previousItems?.map((item) => [`${item.contentType}:${item.tmdbId}`, item]));
    const hydratedItems = watchlist.items.map((item): HydratedItem => {
      const previous = previousByMedia.get(`${item.contentType}:${item.tmdbId}`);
      return {
        ...item,
        backdropUrl: previous?.backdropUrl ?? null,
        posterUrl: previous?.posterUrl ?? null,
        title: previous?.title ?? 'Title',
      };
    });
    const loaded = { hydratedItems, watchlist, loadedAt };
    voteSync.loads.set(loaded, voteRevision);
    return loaded;
  }, [getFirebaseIdToken, ownerId, route.params.watchlistId, voteSync]);
  const resource = useCachedResource<SharedListDetails>({
    enabled: Boolean(ownerId && firebaseIdToken),
    key: cacheKey,
    load,
  });
  useFocusEffect(useCallback(() => {
    resource.revalidate();
  }, [resourceScope, watchlistsRevision, resource.revalidate]));
  const [ownedDetails, setOwnedDetails] = useState<OwnedDetails>({ data: null, ownerId: null });
  const ownedDetailsRef = useRef(ownedDetails);
  const [isCreatingVote, setIsCreatingVote] = useState(false);
  const [isMembersSheetOpen, setIsMembersSheetOpen] = useState(false);
  const [artworkScope, setArtworkScope] = useState<string | null>(null);
  const [isVoteComposerOpen, setIsVoteComposerOpen] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [votesExpanded, toggleVotesExpanded] = useVoteExpansion(ownerId, route.params.watchlistId, 'section', true);
  const view = route.params.view ?? 'titles';
  const scrollRef = useRef<ScrollView>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setIsVoteComposerOpen(false);
    setIsCreatingVote(false);
    setVoteError(null);
  }, [resourceScope]);
  const [moving, setMoving] = useState<DraggedTitle | null>(null);
  const movingRef = useRef<DraggedTitle | null>(null);
  const dragOverlay = useRef<View>(null);
  const [overlayOrigin, setOverlayOrigin] = useState({ x: 0, y: 0 });
  const trash = useWatchlistTrashHeader(Boolean(moving));
  const removal = useWatchlistRemoval({
    kind: 'shared', watchlistId: route.params.watchlistId, name: route.params.title,
    onRemoved: (item) => {
      if (!ownerId || scopeRef.current.key !== resourceScope) return;
      const current = ownedDetailsRef.current.data;
      if (!current || current.watchlist.id !== route.params.watchlistId) return;
      commitDetails(ownerId, {
        ...current,
        hydratedItems: current.hydratedItems.filter((row) => row.id !== item.id),
        watchlist: {
          ...current.watchlist, items: current.watchlist.items.filter((row) => row.id !== item.id),
          coverItemIds: current.watchlist.coverItemIds?.filter((id) => id !== item.id),
          backgroundItemId: current.watchlist.backgroundItemId === item.id ? null : current.watchlist.backgroundItemId,
        },
      });
      resource.revalidate();
    },
  });

  function cancelDrag() {
    movingRef.current = null;
    setMoving(null);
    trash.reset();
  }
  function updateDrag(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (movingRef.current?.item.id !== item.id) return;
    const point = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    movingRef.current = { ...movingRef.current, point };
    setMoving(movingRef.current);
    trash.update(draggedPosterCenter(point, movingRef.current));
  }
  function endDrag(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (movingRef.current?.item.id !== item.id) return;
    const droppedInTrash = trash.isOverTrash(draggedPosterCenter(
      { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }, movingRef.current,
    ));
    cancelDrag();
    if (droppedInTrash) removal.removeDroppedItem(item);
  }

  useEffect(() => {
    if (!ownerId || !resource.data) {
      const empty = { data: null, ownerId: null };
      ownedDetailsRef.current = empty;
      setOwnedDetails(empty);
      return;
    }
    // Cache restores and older GETs must not overwrite immediate local choices.
    // Once saves finish, only a request started after the last change can replace them.
    if (voteSync.revision > 0) {
      if (voteSync.pending.size) return;
      if (voteSync.loads.get(resource.data) !== voteSync.revision) {
        resource.revalidate();
        return;
      }
    }
    const expectedScope = scopeRef.current;
    const watchlist = resource.data.watchlist;
    const savedAt = resource.savedAt ?? new Date().toISOString();
    let cancelled = false;
    const isCurrent = () => !cancelled && scopeRef.current === expectedScope;
    const initial = { data: resource.data, ownerId };
    ownedDetailsRef.current = initial;
    setOwnedDetails(initial);
    void hydrateWatchlistItems({
      backgroundItemId: watchlist.backgroundItemId,
      isCurrent,
      items: watchlist.items,
      previousItems: resource.data.hydratedItems,
      load: (item) => item.contentType === 'movie' ? refreshMovie(item.tmdbId) : refreshSeries(item.tmdbId),
      onProgress: (hydratedItems) => {
        const current = ownedDetailsRef.current;
        if (!isCurrent() || current.ownerId !== ownerId || current.data?.watchlist.id !== watchlist.id) return;
        const remainingIds = new Set(current.data.watchlist.items.map((item) => item.id));
        const next = { ...current.data, hydratedItems: hydratedItems.filter((item) => remainingIds.has(item.id)) };
        const owned = { data: next, ownerId };
        ownedDetailsRef.current = owned;
        setOwnedDetails(owned);
        setMemoryResource(cacheKey, next, savedAt);
      },
    }).then(() => {
      if (!isCurrent()) return;
      const current = ownedDetailsRef.current;
      if (current.ownerId === ownerId && current.data?.watchlist.id === watchlist.id) {
        void writePersistedCache(cacheKey, current.data, undefined, savedAt).catch(() => undefined);
      }
    });
    return () => { cancelled = true; };
  }, [cacheKey, ownerId, refreshMovie, refreshSeries, resource.data, resource.savedAt, resourceScope, resource.revalidate, voteSync]);

  const removalRevision = useTitleRemovalUpdates();
  const details = useMemo(() => {
    void removalRevision;
    const current = ownedDetails.ownerId === ownerId && ownedDetails.data?.watchlist.id === route.params.watchlistId
      ? ownedDetails.data : null;
    if (!current) return null;
    const keep = (item: WatchlistDisplayItem) => !isTitleRemoved(ownerId, `shared:${route.params.watchlistId}`, item, current.loadedAt);
    return { ...current, hydratedItems: current.hydratedItems.filter(keep),
      watchlist: { ...current.watchlist, items: current.watchlist.items.filter((item) =>
        !isTitleRemoved(ownerId, `shared:${route.params.watchlistId}`, item, current.loadedAt)) } };
  }, [ownedDetails, ownerId, route.params.watchlistId, removalRevision]);
  const filters = useWatchlistFilters(details?.hydratedItems ?? [], resourceScope);
  const watchlist = details?.watchlist ?? null;
  const backgroundItem = getWatchlistBackgroundItem(details?.hydratedItems ?? [], watchlist?.backgroundItemId);
  const backgroundUrl = backgroundItem?.posterUrl ?? backgroundItem?.backdropUrl ?? null;

  const headerActions = watchlist ? (
    <WatchlistActionsMenu key={resourceScope} actions={[
      { label: 'Filters', nativeIcon: 'line.3.horizontal.decrease', icon: <Funnel color={filters.active ? colors.accentText : colors.text} size={20} />, onPress: filters.open, active: filters.active },
      { label: 'Add titles', nativeIcon: 'plus', icon: <Plus color={colors.text} size={20} />, onPress: () => navigation.navigate('MainTabs', { screen: 'Explore' }) },
      { label: 'New vote', nativeIcon: 'checkmark.bubble', icon: <Vote color={colors.text} size={20} />, onPress: () => { setVoteError(null); setIsVoteComposerOpen(true); } },
      ...(watchlist.isOwner ? [{ label: 'Cover & background', nativeIcon: 'photo', icon: <Camera color={colors.text} size={20} />, onPress: () => setArtworkScope(resourceScope) }] : []),
      { label: `Members (${watchlist.memberCount})`, nativeIcon: 'person.2', icon: <Users color={colors.text} size={20} />, onPress: () => setIsMembersSheetOpen(true) },
    ]} />
  ) : undefined;

  const commitDetails = useCallback((expectedOwnerId: string, next: SharedListDetails, persist = true) => {
    if (ownerIdRef.current !== expectedOwnerId) return;
    const owned = { data: next, ownerId: expectedOwnerId };
    ownedDetailsRef.current = owned;
    setOwnedDetails(owned);
    if (!persist) return;
    setMemoryResource(cacheKey, next, new Date().toISOString());
    void writePersistedCache(
      getPrivateCacheKey(expectedOwnerId, `shared-watchlist:${route.params.watchlistId}:v3`),
      next,
    ).catch(() => undefined);
  }, [cacheKey, route.params.watchlistId]);

  function updateVote(session: SharedVotingSession, options: VoteUpdateOptions = {}, replacedId = session.id) {
    if (!ownerId || scopeRef.current.key !== resourceScope) return;
    const current = ownedDetailsRef.current;
    if (current.ownerId !== ownerId || current.data?.watchlist.id !== route.params.watchlistId) return;
    voteSync.revision++;
    voteSync.pending.delete(replacedId);
    if (options.persist === false) voteSync.pending.add(session.id);
    const remove = new Set(options.removeItemIds ?? []);
    const added = (options.media ?? []).flatMap(media => {
      const candidate = session.candidates.find(row => voteMediaKey(row) === voteMediaKey(media));
      return candidate ? [{ ...media, id: candidate.itemId, backdropUrl: null, createdAt: new Date().toISOString(), title: media.title ?? 'Title' }] : [];
    });
    const byId = new Map(current.data.hydratedItems.filter(item => !remove.has(item.id)).map(item => [item.id, item]));
    added.forEach(item => byId.set(item.id, item));
    const watchlistItems = new Map(current.data.watchlist.items.filter(item => !remove.has(item.id)).map(item => [item.id, item]));
    added.forEach(({ id, contentType, tmdbId, createdAt }) => watchlistItems.set(id, { id, contentType, tmdbId, createdAt }));
    const votes = current.data.watchlist.votingSessions;
    commitDetails(ownerId, { ...current.data, hydratedItems: [...byId.values()], watchlist: {
      ...current.data.watchlist, items: [...watchlistItems.values()],
      votingSessions: votes.some(row => row.id === replacedId) ? votes.map(row => row.id === replacedId ? session : row) : [session, ...votes],
    } }, options.persist !== false);
    if (options.persist !== false) notifyUserDataChanged('watchlists');
  }

  async function removeVote(session: SharedVotingSession, deleteForEveryone = false) {
    const expectedScope = scopeRef.current;
    const expectedOwnerId = ownerIdRef.current;
    const current = ownedDetailsRef.current.data;
    if (!expectedOwnerId || !current || (deleteForEveryone ? !session.isCreator : getVoteLifecycle(session) === 'open')) return;
    voteSync.revision++;
    voteSync.pending.add(session.id);
    setVoteError(null);
    commitDetails(expectedOwnerId, { ...current, watchlist: { ...current.watchlist,
      votingSessions: current.watchlist.votingSessions.filter(vote => vote.id !== session.id),
    } }, false);
    try {
      const token = await getFirebaseIdToken();
      if (scopeRef.current !== expectedScope) return;
      if (!token) throw new Error('Sign in again to update this vote.');
      await (deleteForEveryone ? deleteSharedVotingSession : dismissSharedVotingSession)(token, current.watchlist.id, session.id);
      if (scopeRef.current !== expectedScope) return;
      voteSync.revision++;
      voteSync.pending.delete(session.id);
      const latest = ownedDetailsRef.current.data;
      if (latest) commitDetails(expectedOwnerId, { ...latest, watchlist: { ...latest.watchlist,
        votingSessions: latest.watchlist.votingSessions.filter(vote => vote.id !== session.id),
      } });
      notifyUserDataChanged('watchlists');
    } catch (error) {
      if (scopeRef.current !== expectedScope) return;
      voteSync.revision++;
      voteSync.pending.delete(session.id);
      const latest = ownedDetailsRef.current.data;
      if (latest && !latest.watchlist.votingSessions.some(vote => vote.id === session.id)) {
        commitDetails(expectedOwnerId, { ...latest, watchlist: { ...latest.watchlist,
          votingSessions: [...latest.watchlist.votingSessions, session],
        } });
      }
      setVoteError(error instanceof Error ? error.message : deleteForEveryone ? 'Could not delete this vote.' : 'Could not hide this result.');
      resource.revalidate();
      hapticError();
    }
  }

  async function handleCreateVote(options: SharedVoteOptions) {
    const expectedScope = scopeRef.current;
    const expectedOwnerId = ownerIdRef.current;
    const snapshot = ownedDetailsRef.current.data;
    const title = options.title.trim();
    if (!expectedOwnerId || !snapshot || !title || !options.items.length || isCreatingVote) return;
    const temporaryId = `pending:${Date.now()}`;
    const optimistic: SharedVotingSession = {
      id: temporaryId, title, isCreator: true, isAnonymous: options.isAnonymous, allowMultipleVotes: options.allowMultipleVotes,
      status: 'OPEN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + options.durationMinutes * 60000).toISOString(), closedAt: null, winningCandidateId: null, leaders: [],
      candidates: options.items.map(item => ({ ...item, id: `${temporaryId}:${voteMediaKey(item)}`,
        itemId: snapshot.watchlist.items.find(row => voteMediaKey(row) === voteMediaKey(item))?.id ?? `${temporaryId}:${voteMediaKey(item)}`,
        voteCount: 0, userHasVoted: false,
      })),
    };
    const temporaryItems = optimistic.candidates.map(row => row.itemId).filter(id => id.startsWith('pending:'));
    setIsCreatingVote(true); setIsVoteComposerOpen(false); setVoteError(null);
    navigation.setParams({ view: 'votes' });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    updateVote(optimistic, { media: options.items, persist: false });
    try {
      const token = await getFirebaseIdToken();
      if (scopeRef.current !== expectedScope || !token) throw new Error('Sign in again to create a vote.');
      const created = await createSharedVotingSession(token, snapshot.watchlist.id, {
        title, durationMinutes: options.durationMinutes, isAnonymous: options.isAnonymous, allowMultipleVotes: options.allowMultipleVotes,
        titles: options.items.map(({ contentType, tmdbId }) => ({ contentType, tmdbId })),
      });
      if (scopeRef.current !== expectedScope) return;
      updateVote(created, { media: options.items, removeItemIds: temporaryItems }, temporaryId);
      hapticSuccess();
    } catch (error) {
      if (scopeRef.current === expectedScope) {
        voteSync.revision++;
        voteSync.pending.delete(temporaryId);
        resource.revalidate();
        const current = ownedDetailsRef.current.data;
        if (current) commitDetails(expectedOwnerId, { ...current, hydratedItems: current.hydratedItems.filter(item => !temporaryItems.includes(item.id)),
          watchlist: { ...current.watchlist, items: current.watchlist.items.filter(item => !temporaryItems.includes(item.id)),
            votingSessions: current.watchlist.votingSessions.filter(vote => vote.id !== temporaryId) } });
        setVoteError(error instanceof Error ? error.message : 'Could not create the vote.'); hapticError();
      }
    } finally { if (scopeRef.current === expectedScope) setIsCreatingVote(false); }
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
      <WatchlistPage title={route.params.title} headerFade background={<WatchlistBackground imageUrl={null} />}>
        <SignInRequiredCard
          body="You need to be signed in to use member-only shared lists. Sign in here to open this list."
          title="Sign in to view this shared list"
        />
      </WatchlistPage>
    );
  }
  if (resource.isInitialLoading && !details) {
    return <WatchlistPage title={route.params.title} headerFade background={<WatchlistBackground imageUrl={null} />} />;
  }
  if (resource.error && !details) {
    return (
      <WatchlistPage title={route.params.title} headerFade background={<WatchlistBackground imageUrl={null} />}>
        <EmptyState body={resource.error} title="Shared list unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      </WatchlistPage>
    );
  }
  if (!details || !watchlist) return null;

  const activeVotes = watchlist.votingSessions.filter(session => getVoteLifecycle(session, now) === 'open');
  const pastVotes = watchlist.votingSessions.filter(session => isRecentVoteResult(session, now));
  const renderVotes = (sessions: SharedWatchlist['votingSessions']) => (
    <WatchlistSection>
      <View style={styles.votesToolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={votesExpanded ? 'Collapse votes' : 'Expand votes'}
        accessibilityState={{ expanded: votesExpanded }} onPress={toggleVotesExpanded} style={styles.votesHeading}>
        <Text accessibilityRole="header" style={styles.votesTitle}>Votes</Text>
        {votesExpanded ? <ChevronUp size={22} color={colors.text} /> : <ChevronDown size={22} color={colors.text} />}
      </Pressable>
        <Button label="New vote" compact variant="secondary" icon={<Plus size={16} color={colors.text} />}
          onPress={() => { setVoteError(null); setIsVoteComposerOpen(true); }} />
      </View>
      <View style={[styles.votes, !votesExpanded && styles.hiddenVotes]} accessibilityElementsHidden={!votesExpanded}
        importantForAccessibility={votesExpanded ? 'auto' : 'no-hide-descendants'}>
      {sessions.length === 0 ? <EmptyState title="Choose what to watch together" body="Start a vote and let everyone pick their favourites." /> : null}
      {sessions.map((session, index) => <View key={`${resourceScope}:${session.id}`} style={styles.votes}>
        {index === activeVotes.length && pastVotes.length > 0 ? <Text style={styles.resultsLabel}>Results</Text> : null}
        <InlineSharedVote session={session}
        watchlistId={watchlist.id} items={details.hydratedItems} isOwner={watchlist.isOwner} now={now} viewerAvatarUrl={watchlist.members.find(member => member.id === ownerId)?.avatarUrl}
        onChange={updateVote} onDismiss={session => void removeVote(session)} onDelete={session => void removeVote(session, true)} /></View>)}
      </View>
    </WatchlistSection>
  );

  const statusBanner = resource.error
    ? <InlineStatusBanner detail={resource.error} tone="error" />
    : undefined;

  return (
    <>
      <WatchlistPage title={route.params.title}
        actions={headerActions}
        trashHeader={trash.header?.()}
        headerFade
        background={<WatchlistBackground imageUrl={backgroundUrl} />}
        scrollRef={scrollRef}
        scrollEnabled={!moving}
        overlay={moving ? <View ref={dragOverlay} pointerEvents="none" style={StyleSheet.absoluteFill}
          onLayout={() => dragOverlay.current?.measureInWindow((x, y) => setOverlayOrigin({ x, y }))}>
          <MediaPoster posterUrl={moving.item.posterUrl} accessibilityLabel="Title being moved"
            style={{ position: 'absolute', left: moving.point.x - overlayOrigin.x - moving.gripX,
              top: moving.point.y - overlayOrigin.y - moving.gripY, width: moving.width, height: moving.width * 1.5, borderRadius: radii.md }} />
        </View> : null}
        isRefreshing={false}
        onRefresh={resource.retry}
      >
        <SegmentedControl options={[{ label: 'Titles', value: 'titles' }, { label: 'Votes', value: 'votes' }]}
          value={view} disabled={Boolean(moving)} onChange={(value) => {
            navigation.setParams({ view: value });
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          }} />
        {statusBanner}
        <View style={view !== 'votes' && styles.hiddenVotes} accessibilityElementsHidden={view !== 'votes'}
          importantForAccessibility={view === 'votes' ? 'auto' : 'no-hide-descendants'}>
        {voteError ? <InlineStatusBanner detail={voteError} tone="error" /> : null}
        {renderVotes([...activeVotes, ...pastVotes])}
        </View>

        <View style={view !== 'titles' && styles.hiddenVotes} accessibilityElementsHidden={view !== 'titles'}
          importantForAccessibility={view === 'titles' ? 'auto' : 'no-hide-descendants'}>
        <WatchlistSection delay={50}>
          <WatchlistFilterStatus filters={filters} />
          {details.hydratedItems.length === 0 ? (
            <Text style={styles.emptyCopy}>
              Add titles from their detail pages before starting a vote.
            </Text>
          ) : (
            <WatchlistPosterGrid items={filters.visibleItems} onOpen={openItem} movingItemId={moving?.item.id}
              onMoveStart={(item, event, geometry) => {
                trash.reset();
                movingRef.current = { item, ...geometry, point: { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY } };
                setMoving(movingRef.current);
              }}
              onMove={updateDrag} onMoveCancel={cancelDrag} onMoveEnd={endDrag} />
          )}
        </WatchlistSection>
        </View>

      </WatchlistPage>

      {isVoteComposerOpen ? <CreateSharedVoteSheet key={resourceScope} items={details.hydratedItems}
        error={voteError} isCreating={isCreatingVote} onClose={() => setIsVoteComposerOpen(false)}
        onCreate={handleCreateVote} /> : null}
      <WatchlistFiltersSheet filters={filters} />
      {artworkScope === resourceScope && watchlist.isOwner ? <WatchlistArtworkSheet key={resourceScope}
        kind="shared" watchlistId={watchlist.id} items={watchlist.items}
        backgroundItemId={watchlist.backgroundItemId} coverItemIds={watchlist.coverItemIds}
        onClose={() => setArtworkScope(null)}
        onBackgroundSaved={(backgroundItemId) => {
          const snapshot = ownedDetailsRef.current;
          if (ownerId && snapshot.ownerId === ownerId && snapshot.data) {
            commitDetails(ownerId, { ...snapshot.data, watchlist: { ...snapshot.data.watchlist, backgroundItemId } });
            resource.revalidate();
          }
        }}
        onCoverSaved={(coverItemIds) => {
          const snapshot = ownedDetailsRef.current;
          if (ownerId && snapshot.ownerId === ownerId && snapshot.data) {
            commitDetails(ownerId, { ...snapshot.data, watchlist: { ...snapshot.data.watchlist, coverItemIds } });
          }
        }} /> : null}
      {isMembersSheetOpen ? <WatchlistMembersSheet key={resourceScope} watchlist={watchlist}
        onClose={() => setIsMembersSheetOpen(false)}
        onLeft={() => { setIsMembersSheetOpen(false); navigation.goBack(); }} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  votesToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  resultsLabel: { ...typography.meta, color: colors.textMuted, paddingTop: spacing.sm },
  votesHeading: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm, minHeight: 44 },
  votesTitle: { ...typography.title, color: colors.text },
  votes: { gap: spacing.sm },
  hiddenVotes: { display: 'none' },
  emptyCopy: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.sm },
});
