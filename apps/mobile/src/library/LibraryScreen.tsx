import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen, Plus } from 'lucide-react-native';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { createSharedWatchlist, deleteSharedWatchlist } from '../api/sharedWatchlists';
import { disableReleaseAlert, enableReleaseAlert } from '../api/notifications';
import { createWatchlist, deleteWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { writePersistedCache } from '../cache/persistedCache';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextInput } from '../components/TextInput';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { buildLibrarySummary } from './libraryModel';
import { LibrarySummary } from './LibrarySummary';
import { ReleaseAlertRow } from './ReleaseAlertRow';
import { LibraryData, LibraryListItem, LibraryMediaItem, useLibraryData } from './useLibraryData';
import { WatchlistRail } from './WatchlistRail';

type Tab = 'all' | 'lists' | 'progress';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const { currentUser, getFirebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const resource = useLibraryData();
  const [scopedData, setScopedData] = useState<{ data: LibraryData; userId: string } | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListKind, setNewListKind] = useState<'personal' | 'shared'>('personal');
  let data: LibraryData | null = null;
  if (currentUser && scopedData && scopedData.userId === currentUser.id) {
    data = scopedData.data;
  }
  const setData = (next: LibraryData | null) => {
    setScopedData(next && currentUser ? { data: next, userId: currentUser.id } : null);
  };
  useEffect(() => { if (resource.data) setData(resource.data); }, [currentUser?.id, resource.data]);
  const summary = useMemo(() => buildLibrarySummary(data?.items ?? [], data?.lists.length ?? 0), [data]);
  const continueItems = (data?.items ?? []).filter((item) => item.contentType === 'series' && item.resumeEpisodeNumber !== null);
  const visibleItems = tab === 'progress' ? continueItems : data?.items ?? [];

  function openItem(item: LibraryMediaItem, resume = false) {
    if (resume && item.contentType === 'series' && item.resumeSeasonNumber && item.resumeEpisodeNumber) {
      navigation.navigate('EpisodeDetail', { episodeNumber: item.resumeEpisodeNumber, seasonNumber: item.resumeSeasonNumber, seriesTitle: item.title, title: item.title, tmdbId: item.tmdbId });
    } else if (item.contentType === 'movie') navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    else navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  }
  function openList(list: LibraryListItem) {
    navigation.navigate(list.kind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: list.name, watchlistId: list.id });
  }
  async function persist(next: LibraryData) { setData(next); await writePersistedCache(resource.key, next).catch(() => undefined); }

  async function toggleAlert(item: LibraryMediaItem) {
    if (!data || busyKey) return;
    const before = data;
    const next = { ...data, items: data.items.map((entry) => entry.key === item.key ? { ...entry, hasReleaseAlert: !entry.hasReleaseAlert } : entry) };
    setBusyKey(item.key); setActionError(null); setData(next);
    try {
      const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to update this alert.');
      if (item.hasReleaseAlert) await disableReleaseAlert(token, item.contentType, item.tmdbId); else await enableReleaseAlert(token, item.contentType, item.tmdbId);
      await persist(next); notifyTrackingChanged();
    } catch (error) { setData(before); setActionError(error instanceof Error ? error.message : 'Could not update this alert.'); }
    finally { setBusyKey(null); }
  }

  async function createList() {
    const name = newListName.trim(); if (!data || !name || busyKey) return;
    setBusyKey('create-list'); setActionError(null);
    try {
      const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to create a list.');
      const created = newListKind === 'personal' ? await createWatchlist(token, name) : await createSharedWatchlist(token, name);
      const nextList: LibraryListItem = { id: created.id, isOwner: true, itemCount: created.itemCount, key: `${newListKind}:${created.id}`, kind: newListKind, memberCount: newListKind === 'shared' ? (created as Awaited<ReturnType<typeof createSharedWatchlist>>).memberCount : null, name: created.name, posterUrls: [], updatedAt: created.updatedAt };
      await persist({ ...data, lists: [nextList, ...data.lists] }); setNewListName('');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not create this list.'); }
    finally { setBusyKey(null); }
  }

  async function removeList(list: LibraryListItem) {
    if (!data || busyKey) return;
    const before = data; const next = { ...data, lists: data.lists.filter((item) => item.key !== list.key) };
    setData(next); setBusyKey(list.key); setActionError(null);
    try { const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to delete this list.'); if (list.kind === 'personal') await deleteWatchlist(token, list.id); else await deleteSharedWatchlist(token, list.id); await persist(next); }
    catch (error) { setData(before); setActionError(error instanceof Error ? error.message : 'Could not delete this list.'); }
    finally { setBusyKey(null); }
  }

  const banner = resource.isRefreshing ? <InlineStatusBanner tone="updating" /> : resource.error && data ? <InlineStatusBanner detail={resource.error} onRetry={resource.retry} tone="error" title="Library kept offline" /> : (data?.partialError || actionError) ? <InlineStatusBanner detail={actionError ?? data?.partialError ?? ''} onRetry={resource.retry} tone="error" title="Some data needs attention" /> : null;
  return <Screen eyebrow={currentUser ? 'Your collection' : undefined} refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined} statusBanner={banner} tabBarPadding title="Library" trailing={currentUser ? <IconButton accessibilityLabel="Open Journal" icon={<BookOpen color={colors.text} size={21} />} onPress={() => navigation.navigate('Journal')} /> : null}>
    {!currentUser ? <EmptyState body="Sign in from Profile to keep your progress, ratings, release alerts and lists together." title="Your cinema lives here" />
      : resource.isInitialLoading && !data ? <LoadingState label="Loading your library" />
      : resource.error && !data ? <EmptyState body={resource.error} title="Library unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : data && data.items.length === 0 && data.lists.length === 0 ? <EmptyState body="Track a title or create a list. Your progress and ratings will appear here automatically." title="Start your Library"><Button label="Explore titles" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} /></EmptyState>
      : data ? <View style={styles.content}>
        <LibrarySummary summary={summary} />
        <SegmentedControl options={[{ label: 'All', value: 'all' }, { label: 'In progress', value: 'progress' }, { label: 'Lists', value: 'lists' }]} value={tab} onChange={setTab} />
        {tab !== 'lists' && continueItems.length > 0 ? <View style={styles.section}><SectionHeader title="Continue watching" /><ContinueWatchingCard item={continueItems[0]!} onPress={() => openItem(continueItems[0]!, true)} /></View> : null}
        {tab !== 'progress' ? <View style={styles.section}><SectionHeader actionLabel="Journal" onActionPress={() => navigation.navigate('Journal')} title="My lists" />{data.lists.length ? <WatchlistRail lists={data.lists} onDelete={(list) => void removeList(list)} onOpen={openList} /> : <Text style={styles.emptyInline}>No personal or shared lists yet.</Text>}</View> : null}
        {tab === 'lists' ? <View style={styles.create}><SegmentedControl buttonMinHeight={36} options={[{ label: 'Personal', value: 'personal' }, { label: 'Shared', value: 'shared' }]} value={newListKind} onChange={setNewListKind} /><TextInput label="New list" value={newListName} onChangeText={setNewListName} placeholder="Weekend ideas" /><Button disabled={!newListName.trim() || busyKey === 'create-list'} icon={<Plus color={colors.textOnAccent} size={18} />} label="Create list" onPress={() => void createList()} /></View> : null}
        {tab !== 'lists' ? <View style={styles.section}><SectionHeader title={tab === 'progress' ? 'In progress' : 'Tracked titles & alerts'} />{visibleItems.map((item) => <ReleaseAlertRow busy={busyKey === item.key} item={item} key={item.key} onOpen={() => openItem(item)} onToggle={() => void toggleAlert(item)} />)}{visibleItems.length === 0 ? <Text style={styles.emptyInline}>Nothing in progress right now.</Text> : null}</View> : null}
      </View> : null}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, section: { gap: spacing.sm }, create: { gap: spacing.md }, emptyInline: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md } });
