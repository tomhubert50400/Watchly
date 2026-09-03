import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen, Plus } from 'lucide-react-native';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { createSharedWatchlist } from '../api/sharedWatchlists';
import { disableReleaseAlert, enableReleaseAlert } from '../api/notifications';
import { createWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { writePersistedCache } from '../cache/persistedCache';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { TextInput } from '../components/TextInput';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { buildLibrarySummary, getLastWatchedLibraryItem } from './libraryModel';
import { OwnerScopedData, replaceOwnedData, updateOwnedData } from './libraryState';
import { LibrarySummary } from './LibrarySummary';
import { ReleaseAlertRow } from './ReleaseAlertRow';
import { LibraryData, LibraryListItem, LibraryMediaItem, useLibraryData } from './useLibraryData';
import { WatchlistRail } from './WatchlistRail';

type Tab = 'all' | 'lists' | 'progress';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const resource = useLibraryData();
  const [scopedData, setScopedData] = useState<OwnerScopedData<LibraryData> | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListKind, setNewListKind] = useState<'personal' | 'shared'>('personal');
  const alertConfirmedValuesRef = useRef(new Map<string, boolean>());
  const alertMutationQueuesRef = useRef(new Map<string, Promise<void>>());
  const alertPendingCountsRef = useRef(new Map<string, number>());
  const dataRef = useRef<LibraryData | null>(null);
  const activeOwnerIdRef = useRef(currentUser?.id ?? null);
  activeOwnerIdRef.current = currentUser?.id ?? null;
  const resourceDataRef = useRef(resource.data);
  const resourceOwnerIdRef = useRef<string | null>(resource.data ? currentUser?.id ?? null : null);
  if (resourceDataRef.current !== resource.data) {
    resourceDataRef.current = resource.data;
    resourceOwnerIdRef.current = resource.data ? currentUser?.id ?? null : null;
  }
  let data: LibraryData | null = null;
  if (currentUser && scopedData && scopedData.ownerId === currentUser.id) {
    data = scopedData.data;
  }
  dataRef.current = data;
  useEffect(() => {
    const ownerId = currentUser?.id ?? null;
    const sourceOwnerId = resourceOwnerIdRef.current;
    if (!ownerId) {
      setScopedData(null);
      return;
    }
    if (resource.data && sourceOwnerId) {
      setScopedData((current) => replaceOwnedData(current, ownerId, sourceOwnerId, resource.data!));
    } else {
      setScopedData((current) => current?.ownerId === ownerId ? current : null);
    }
  }, [currentUser?.id, resource.data]);
  useEffect(() => { setActionError(null); setBusyKey(null); }, [currentUser?.id]);
  const summary = useMemo(() => buildLibrarySummary(data?.items ?? [], data?.lists.length ?? 0), [data]);
  const continueItems = (data?.items ?? []).filter((item) => item.contentType === 'series' && item.resumeEpisodeNumber !== null);
  const visibleItems = tab === 'progress' ? continueItems : data?.items ?? [];
  const lastWatchedItem = getLastWatchedLibraryItem(data?.items ?? []);
  const atmosphereUrl = lastWatchedItem?.posterUrl ?? lastWatchedItem?.backdropUrl ?? null;

  function openItem(item: LibraryMediaItem, resume = false) {
    if (resume && item.contentType === 'series' && item.resumeSeasonNumber && item.resumeEpisodeNumber) {
      navigation.navigate('EpisodeDetail', { episodeNumber: item.resumeEpisodeNumber, seasonNumber: item.resumeSeasonNumber, seriesTitle: item.title, title: item.title, tmdbId: item.tmdbId });
    } else if (item.contentType === 'movie') navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    else navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  }
  function openList(list: LibraryListItem) {
    navigation.navigate(list.kind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: list.name, watchlistId: list.id });
  }
  function updateData(ownerId: string, update: (current: LibraryData) => LibraryData) {
    setScopedData((current) => updateOwnedData(current, ownerId, update));
  }
  async function persist(cacheKey: string, next: LibraryData) { await writePersistedCache(cacheKey, next).catch(() => undefined); }

  async function toggleAlert(item: LibraryMediaItem) {
    if (!currentUser || !data) return;
    const ownerId = currentUser.id; const cacheKey = resource.key;
    const currentData = dataRef.current ?? data;
    const currentItem = currentData.items.find((entry) => entry.key === item.key) ?? item;
    const nextEnabled = !currentItem.hasReleaseAlert;
    const next = { ...currentData, items: currentData.items.map((entry) => entry.key === item.key ? { ...entry, hasReleaseAlert: nextEnabled } : entry) };
    if ((alertPendingCountsRef.current.get(item.key) ?? 0) === 0) {
      alertConfirmedValuesRef.current.set(item.key, currentItem.hasReleaseAlert);
    }
    alertPendingCountsRef.current.set(item.key, (alertPendingCountsRef.current.get(item.key) ?? 0) + 1);
    setActionError(null);
    dataRef.current = next;
    updateData(ownerId, () => next);
    void persist(cacheKey, next);

    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in again to update this alert.');
        if (nextEnabled) await enableReleaseAlert(token, item.contentType, item.tmdbId);
        else await disableReleaseAlert(token, item.contentType, item.tmdbId);
        alertConfirmedValuesRef.current.set(item.key, nextEnabled);
      } catch (error) {
        if (activeOwnerIdRef.current === ownerId) {
          setActionError(error instanceof Error ? error.message : 'Could not update this alert.');
          hapticError();
        }
      } finally {
        const pendingCount = (alertPendingCountsRef.current.get(item.key) ?? 1) - 1;
        if (pendingCount > 0) {
          alertPendingCountsRef.current.set(item.key, pendingCount);
        } else {
          alertPendingCountsRef.current.delete(item.key);
          const confirmedValue = alertConfirmedValuesRef.current.get(item.key) ?? currentItem.hasReleaseAlert;
          if (activeOwnerIdRef.current === ownerId) {
            const current = dataRef.current;
            if (current) {
              const reconciled = { ...current, items: current.items.map((entry) => (
                entry.key === item.key ? { ...entry, hasReleaseAlert: confirmedValue } : entry
              )) };
              dataRef.current = reconciled;
              updateData(ownerId, () => reconciled);
              void persist(cacheKey, reconciled);
            }
            notifyUserDataChanged('releaseAlerts');
          }
        }
      }
    };
    const previousQueue = alertMutationQueuesRef.current.get(item.key) ?? Promise.resolve();
    const queuedMutation = previousQueue.then(commitMutation, commitMutation);
    alertMutationQueuesRef.current.set(item.key, queuedMutation.catch(() => undefined));
  }

  async function createList() {
    const name = newListName.trim(); if (!currentUser || !data || !name || busyKey) return;
    const ownerId = currentUser.id; const cacheKey = resource.key;
    setBusyKey('create-list'); setActionError(null);
    try {
      const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to create a list.');
      const created = newListKind === 'personal' ? await createWatchlist(token, name) : await createSharedWatchlist(token, name);
      if (activeOwnerIdRef.current !== ownerId) return;
      const nextList: LibraryListItem = { id: created.id, isOwner: true, itemCount: created.itemCount, key: `${newListKind}:${created.id}`, kind: newListKind, memberCount: newListKind === 'shared' ? (created as Awaited<ReturnType<typeof createSharedWatchlist>>).memberCount : null, name: created.name, posterUrls: [], updatedAt: created.updatedAt };
      const next = { ...data, lists: [nextList, ...data.lists] };
      updateData(ownerId, (current) => current.lists.some((list) => list.key === nextList.key) ? current : { ...current, lists: [nextList, ...current.lists] });
      await persist(cacheKey, next);
      if (activeOwnerIdRef.current === ownerId) {
        setNewListName('');
        hapticSuccess();
      }
    } catch (error) {
      if (activeOwnerIdRef.current === ownerId) {
        setActionError(error instanceof Error ? error.message : 'Could not create this list.');
        hapticError();
      }
    }
    finally { if (activeOwnerIdRef.current === ownerId) setBusyKey(null); }
  }

  const banner = actionError ? <InlineStatusBanner detail={actionError} tone="error" title="Action failed" /> : null;
  const createListFooter = currentUser && data && tab === 'lists' ? (
    <Button
      disabled={!newListName.trim() || busyKey === 'create-list'}
      fullWidth
      icon={<Plus color={colors.textOnAccent} size={18} />}
      label="Create list"
      onPress={() => void createList()}
    />
  ) : undefined;
  return <Screen background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null} eyebrow={currentUser ? 'Your collection' : undefined} footer={createListFooter} refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined} statusBanner={banner} tabBarPadding title="Library" trailing={currentUser ? <IconButton accessibilityLabel="Open Journal" icon={<BookOpen color={colors.text} size={21} />} onPress={() => navigation.navigate('Journal')} /> : null}>
    {!currentUser ? <SignInRequiredCard body="You need to be signed in to use this section. Sign in here to keep your progress, ratings, release alerts and lists together." title="Sign in to use Library" />
      : resource.isInitialLoading && !data ? <LoadingState label="Loading your library" />
      : resource.error && !data ? <EmptyState body={resource.error} title="Library unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : data && data.items.length === 0 && data.lists.length === 0 ? <EmptyState body="Track a title or create a list. Your progress and ratings will appear here automatically." title="Start your Library"><Button label="Explore titles" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} /></EmptyState>
      : data ? <View style={styles.content}>
        <LibrarySummary summary={summary} />
        <SegmentedControl options={[{ label: 'All', value: 'all' }, { accessibilityLabel: 'In progress', label: 'Progress', value: 'progress' }, { label: 'Lists', value: 'lists' }]} value={tab} onChange={setTab} />
        {tab !== 'lists' && continueItems.length > 0 ? <View style={styles.section}><SectionHeader title="Continue watching" /><ContinueWatchingCard item={continueItems[0]!} onPress={() => openItem(continueItems[0]!, true)} /></View> : null}
        {tab !== 'progress' ? <View style={styles.section}><SectionHeader actionLabel="Journal" onActionPress={() => navigation.navigate('Journal')} title="My lists" />{data.lists.length ? <WatchlistRail lists={data.lists} onOpen={openList} /> : <Text style={styles.emptyInline}>No personal or shared lists yet.</Text>}</View> : null}
        {tab === 'lists' ? <View style={styles.create}><SegmentedControl buttonMinHeight={36} options={[{ label: 'Personal', value: 'personal' }, { label: 'Shared', value: 'shared' }]} value={newListKind} onChange={setNewListKind} /><TextInput label="New list" value={newListName} onChangeText={setNewListName} placeholder="Weekend ideas" /></View> : null}
        {tab !== 'lists' ? <View style={styles.section}><SectionHeader title={tab === 'progress' ? 'In progress' : 'Tracked titles & alerts'} />{visibleItems.map((item) => <ReleaseAlertRow item={item} key={item.key} onOpen={() => openItem(item)} onToggle={() => void toggleAlert(item)} />)}{visibleItems.length === 0 ? <Text style={styles.emptyInline}>Nothing in progress right now.</Text> : null}</View> : null}
      </View> : null}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, section: { gap: spacing.sm }, create: { gap: spacing.md }, emptyInline: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md } });
