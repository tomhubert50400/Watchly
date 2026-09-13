import { useEffect, useRef, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BookOpen, Check, ListFilter, Plus } from 'lucide-react-native';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSharedWatchlist } from '../api/sharedWatchlists';
import { createWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { writePersistedCache } from '../cache/persistedCache';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { ScreenReveal } from '../components/ScreenReveal';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { hapticSuccess } from '../feedback/haptics';
import { getLastWatchedLibraryItem } from '../library/libraryModel';
import { LibraryData, LibraryListItem, useLibraryData } from '../library/useLibraryData';
import { WatchlistCard } from '../library/WatchlistRail';
import { ProgressCard } from '../library/ProgressCard';
import { ProgressFilter, progressFilters } from '../library/progressModel';
import { useProgressData } from '../library/useProgressData';
import { RootStackParamList, RootTabParamList } from '../navigation/types';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { useWatchlistCache } from './WatchlistCacheContext';
import { WatchlistManagementButton } from './WatchlistManagementButton';

type ListFilterKind = 'all' | 'personal' | 'shared';
const filters = [{ label: 'All lists', value: 'all' }, { label: 'Personal', value: 'personal' }, { label: 'Shared', value: 'shared' }] as const;

export function WatchlistsScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Library'>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<RootTabParamList, 'Library'>>();
  const view = route.params?.view ?? 'watchlists';
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('progress');
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const filterButtonRef = useRef<View>(null);
  const [filterAnchor, setFilterAnchor] = useState({ x: 0, y: 0 });
  const filterWidth = Math.min(width - spacing.md * 2, Math.max(190, 140 * fontScale));
  const filterRowHeight = Math.max(48, typography.body.lineHeight * fontScale + spacing.lg);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { preloadWatchlists } = useWatchlistCache();
  const resource = useLibraryData();
  const progress = useProgressData(resource.data?.items ?? [], view === 'progress' && Boolean(resource.data));
  const [filter, setFilter] = useState<ListFilterKind>('all');
  const [sheet, setSheet] = useState<'create' | 'filter' | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'personal' | 'shared'>('personal');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ ownerId: string; list: LibraryListItem } | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const ownerRef = useRef(currentUser?.id);
  const creatingRef = useRef(false);
  ownerRef.current = currentUser?.id;
  useEffect(() => { setSheet(null); setName(''); setError(null); setCreated(null); setRemoved([]); setFilter('all'); }, [currentUser?.id]);
  useEffect(() => { setSheet((current) => current === 'filter' ? null : current); }, [width, height, fontScale]);
  const data = resource.data;
  useEffect(() => {
    if (created && data?.lists.some((list) => list.key === created.list.key)) setCreated(null);
  }, [created, data?.lists]);
  useEffect(() => {
    if (data && !data.partialError) setRemoved((current) => current.filter((key) => data.lists.some((list) => list.key === key)));
  }, [data]);
  const lists = (created?.ownerId === currentUser?.id && created && !data?.lists.some((list) => list.key === created.list.key)
    ? [created.list, ...(data?.lists ?? [])] : data?.lists ?? []).filter((list) => !removed.includes(list.key));
  const visibleLists = lists.filter((list) => filter === 'all' || list.kind === filter);
  const visibleProgress = progress.items.filter((item) => item.state === progressFilter);
  const activeFilters = view === 'progress' ? progressFilters : filters;
  const activeFilter = view === 'progress' ? progressFilter : filter;
  const lastWatched = getLastWatchedLibraryItem(data?.items ?? []);
  const atmosphereUrl = lastWatched?.posterUrl ?? lastWatched?.backdropUrl ?? lists[0]?.posterUrls.find(Boolean) ?? null;

  function openFilter() {
    filterButtonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
      setFilterAnchor({
        x: Math.max(spacing.md, Math.min(x + buttonWidth - filterWidth, width - filterWidth - spacing.md)),
        y: Math.max(insets.top + spacing.sm, Math.min(y + buttonHeight + spacing.sm, height - insets.bottom - filterRowHeight * filters.length - spacing.lg)),
      });
      setSheet('filter');
    });
  }

  function removeList(key: string) {
    setRemoved((current) => [...current, key]);
    if (data) {
      const next = { ...data, lists: lists.filter((list) => list.key !== key) };
      setMemoryResource(resource.key, next, new Date().toISOString());
      void writePersistedCache(resource.key, next).catch(() => undefined);
    }
    notifyUserDataChanged('watchlists');
  }

  async function createList() {
    const ownerId = currentUser?.id;
    const cleanName = name.trim();
    if (!ownerId || !cleanName || creatingRef.current) return;
    if (lists.filter((list) => list.kind === kind).length >= 5) {
      setError(kind === 'personal' ? 'You can have up to 5 personal watchlists.' : 'You can belong to up to 5 shared watchlists, including lists you create.');
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (ownerRef.current !== ownerId) return;
      if (!token) throw new Error('Sign in again to create a watchlist.');
      const result = kind === 'personal' ? await createWatchlist(token, cleanName) : await createSharedWatchlist(token, cleanName);
      if (ownerRef.current !== ownerId) return;
      const list: LibraryListItem = { ...result, key: `${kind}:${result.id}`, kind, isOwner: true, memberCount: 'memberCount' in result ? result.memberCount : null, posterUrls: [] };
      setCreated({ ownerId, list });
      if (data) {
        const next: LibraryData = { ...data, lists: [list, ...lists] };
        setMemoryResource(resource.key, next, new Date().toISOString());
        void writePersistedCache(resource.key, next).catch(() => undefined);
      }
      setSheet(null);
      setName('');
      setFilter('all');
      notifyUserDataChanged('watchlists');
      void preloadWatchlists().catch(() => undefined);
      hapticSuccess();
      navigation.navigate(kind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: list.name, watchlistId: list.id });
    } catch (cause) {
      if (ownerRef.current === ownerId) setError(cause instanceof Error ? cause.message : 'Could not create this watchlist.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  return <>
    <Screen title={view === 'progress' ? 'Progress' : 'Watchlists'} tabBarPadding horizontalPadding={width < 360 ? spacing.md : spacing.xl}
      contentReady={!currentUser || Boolean(data)}
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={currentUser ? <RefreshControl onRefresh={() => { resource.retry(); if (view === 'progress') progress.retry(); }} refreshing={resource.isRefreshing || (view === 'progress' && progress.isRefreshing)} tintColor={colors.accent} /> : undefined}
      trailing={currentUser ? <View style={styles.actions}>
        <View ref={filterButtonRef} collapsable={false}>
          <IconButton accessibilityLabel={`Filter ${view}, ${activeFilters.find((item) => item.value === activeFilter)?.label}`} accessibilityState={{ expanded: sheet === 'filter' }} icon={<ListFilter color={activeFilter === 'all' || activeFilter === 'progress' ? colors.textMuted : colors.accentText} size={21} />} onPress={openFilter} />
        </View>
        {view === 'progress' ? <IconButton accessibilityLabel="Open Journal" icon={<BookOpen color={colors.text} size={21} />} onPress={() => navigation.navigate('Journal')} /> : <Pressable accessibilityRole="button" accessibilityLabel="Create watchlist" onPress={() => { setKind(filter === 'shared' ? 'shared' : 'personal'); setError(null); setSheet('create'); }} style={styles.createButton}><Plus color={colors.textOnAccent} size={24} /></Pressable>}
      </View> : null}>
      <SegmentedControl containerStyle={styles.viewSwitch} options={[{ label: 'Watchlists', value: 'watchlists' }, { label: 'Progress', value: 'progress' }]} value={view} onChange={(value) => { tabNavigation.setParams({ view: value }); setSheet(null); }} />
      {!currentUser ? <SignInRequiredCard title="Sign in to use watchlists" body="Keep your next movies and series together, on your own or with friends." />
        : resource.isInitialLoading && !data ? <LoadingState variant="grid" label="Loading watchlists" />
        : resource.error && !data ? <EmptyState title="Watchlists unavailable" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState>
        : view === 'progress' ? <View style={styles.content}>
          {data?.partialError ? <InlineStatusBanner detail={data.partialError} onRetry={resource.retry} tone="error" /> : null}
          {progress.actionError || progress.error ? <InlineStatusBanner detail={progress.actionError ?? progress.error!} onRetry={progress.retry} tone="error" /> : null}
          <Text style={styles.progressLabel}>{progressFilters.find((item) => item.value === progressFilter)?.label}</Text>
          {!progress.data ? progress.error ? <EmptyState title="Progress unavailable" body="Refresh to load your next episodes." /> : <LoadingState variant="grid" label="Loading your progress" /> : visibleProgress.length === 0 ? <EmptyState title={progressFilter === 'progress' ? 'Nothing in progress right now' : progressFilter === 'caughtUp' ? 'No series up to date yet' : 'No completed series yet'} body={progressFilter === 'progress' ? 'Start a series to find your next episode here. Caught-up series are available in the filter.' : 'Your series will appear here as you mark episodes watched.'} /> : visibleProgress.map((item) => <ProgressCard key={item.media.key} item={item} busy={progress.isBusy(item)} onRetry={progress.retry} onWatched={() => void progress.markNext(item)} onOpen={() => item.next ? navigation.navigate('EpisodeDetail', { ...item.next, seriesTitle: item.media.title, title: item.media.title, tmdbId: item.media.tmdbId }) : navigation.navigate('SeriesDetail', { title: item.media.title, tmdbId: item.media.tmdbId })} />)}
        </View> : <View style={styles.content}>
          {data?.partialError ? <InlineStatusBanner detail={data.partialError} onRetry={resource.retry} tone="error" /> : null}
          {visibleLists.map((list, index) => <ScreenReveal key={list.key} delay={Math.min(index * 40, 160)} style={styles.list}>
            <WatchlistCard fullWidth blendId={`watchlists-${list.key}`} name={list.name} subtitle={`${list.itemCount} ${list.itemCount === 1 ? 'title' : 'titles'} · ${list.kind === 'shared' ? `Shared · ${list.memberCount ?? 1} ${(list.memberCount ?? 1) === 1 ? 'member' : 'members'}` : 'Personal'}`} posterUrls={list.posterUrls} onPress={() => navigation.navigate(list.kind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: list.name, watchlistId: list.id })} />
            <View style={styles.management}><WatchlistManagementButton list={list} onRemoved={removeList} /></View>
          </ScreenReveal>)}
          {visibleLists.length === 0 ? <EmptyState title={filter === 'all' ? 'Your next watch starts here' : `No ${filter} lists yet`} body="Create a watchlist and add movies or series from their detail pages."><Button label="Create watchlist" onPress={() => { setKind(filter === 'shared' ? 'shared' : 'personal'); setError(null); setSheet('create'); }} /></EmptyState> : null}
          <View style={styles.utilities}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Journal')} style={styles.utility}><BookOpen color={colors.textMuted} size={18} /><Text style={styles.utilityText}>Journal</Text></Pressable>
          </View>
        </View>}
    </Screen>
    <Modal transparent animationType="fade" visible={sheet === 'filter'} onRequestClose={() => setSheet(null)} statusBarTranslucent>
      <View style={styles.filterOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={view === 'progress' ? 'Close progress filters' : 'Close watchlist filters'} style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
        <View accessibilityViewIsModal onAccessibilityEscape={() => setSheet(null)} style={[styles.filterBubble, { left: filterAnchor.x, top: filterAnchor.y, width: filterWidth }]}>
          {activeFilters.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: activeFilter === item.value }} style={({ pressed }) => [styles.filterRow, { minHeight: filterRowHeight }, pressed && styles.filterRowPressed]} onPress={() => { if (view === 'progress') setProgressFilter(item.value as ProgressFilter); else setFilter(item.value as ListFilterKind); setSheet(null); }}><Text style={styles.filterText}>{item.label}</Text>{activeFilter === item.value ? <Check color={colors.accentText} size={20} /> : null}</Pressable>)}
        </View>
      </View>
    </Modal>
    <BottomActionSheet title="New watchlist" visible={sheet === 'create'} onClose={() => { if (!creating) setSheet(null); }} footer={<Button label="Create watchlist" fullWidth disabled={creating || !name.trim()} onPress={() => void createList()} />}>
      <BottomActionSheetScrollView contentContainerStyle={styles.content}>
        <SegmentedControl options={[{ label: 'Personal', value: 'personal' }, { label: 'Shared', value: 'shared' }]} value={kind} onChange={(value) => { setKind(value); setError(null); }} />
        <TextInput label="Name" placeholder="Weekend ideas" value={name} onChangeText={setName} maxLength={80} editable={!creating} onSubmitEditing={() => void createList()} />
        {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  </>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: { gap: spacing.lg },
  viewSwitch: { marginBottom: spacing.lg },
  progressLabel: { ...typography.meta, color: colors.textMuted },
  createButton: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  list: { position: 'relative' },
  management: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  utilities: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  utility: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 44 },
  utilityText: { ...typography.body, fontSize: 13, color: colors.textMuted },
  filterOverlay: { flex: 1 },
  filterBubble: { ...shadows.raised, position: 'absolute', backgroundColor: colors.panelElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  filterRowPressed: { backgroundColor: colors.segmentSelected },
  filterText: { ...typography.body, color: colors.text, flex: 1 },
});
