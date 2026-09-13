import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen, Check, ListFilter, Play, Plus, Users } from 'lucide-react-native';
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
import { RootStackParamList } from '../navigation/types';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { useWatchlistCache } from './WatchlistCacheContext';
import { WatchlistManagementButton } from './WatchlistManagementButton';

type ListFilterKind = 'all' | 'personal' | 'shared';
const filters = [{ label: 'All lists', value: 'all' }, { label: 'Personal', value: 'personal' }, { label: 'Shared', value: 'shared' }] as const;

export function WatchlistsScreen() {
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
    <Screen title="Watchlists" tabBarPadding horizontalPadding={width < 360 ? spacing.md : spacing.xl}
      contentReady={!currentUser || Boolean(data)}
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined}
      trailing={currentUser ? <View style={styles.actions}>
        <View ref={filterButtonRef} collapsable={false}>
          <IconButton accessibilityLabel={`Filter watchlists, ${filters.find((item) => item.value === filter)?.label}`} accessibilityState={{ expanded: sheet === 'filter' }} icon={<ListFilter color={filter === 'all' ? colors.textMuted : colors.accentText} size={21} />} onPress={openFilter} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Create watchlist" onPress={() => { setKind(filter === 'shared' ? 'shared' : 'personal'); setError(null); setSheet('create'); }} style={styles.createButton}><Plus color={colors.textOnAccent} size={24} /></Pressable>
      </View> : null}>
      {!currentUser ? <SignInRequiredCard title="Sign in to use watchlists" body="Keep your next movies and series together, on your own or with friends." />
        : resource.isInitialLoading && !data ? <LoadingState variant="grid" label="Loading watchlists" />
        : resource.error && !data ? <EmptyState title="Watchlists unavailable" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState>
        : <View style={styles.content}>
          {data?.partialError ? <InlineStatusBanner detail={data.partialError} onRetry={resource.retry} tone="error" /> : null}
          {visibleLists.map((list, index) => <ScreenReveal key={list.key} delay={Math.min(index * 40, 160)} style={styles.list}>
            <WatchlistCard fullWidth blendId={`watchlists-${list.key}`} name={list.name} posterUrls={list.posterUrls} onPress={() => navigation.navigate(list.kind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: list.name, watchlistId: list.id })} />
            <View style={styles.metadata}><Text style={styles.meta}>{list.itemCount} {list.itemCount === 1 ? 'title' : 'titles'}</Text><View style={styles.actions}>{list.kind === 'shared' ? <Users color={colors.textMuted} size={16} /> : null}<Text style={styles.meta}>{list.kind === 'shared' ? `Shared · ${list.memberCount ?? 1} members` : 'Personal'}</Text><WatchlistManagementButton list={list} onRemoved={removeList} /></View></View>
          </ScreenReveal>)}
          {visibleLists.length === 0 ? <EmptyState title={filter === 'all' ? 'Your next watch starts here' : `No ${filter} lists yet`} body="Create a watchlist and add movies or series from their detail pages."><Button label="Create watchlist" onPress={() => { setKind(filter === 'shared' ? 'shared' : 'personal'); setError(null); setSheet('create'); }} /></EmptyState> : null}
          <View style={styles.utilities}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProgressAlerts')} style={styles.utility}><Play color={colors.textMuted} size={18} /><Text style={styles.utilityText}>Progress & alerts</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Journal')} style={styles.utility}><BookOpen color={colors.textMuted} size={18} /><Text style={styles.utilityText}>Journal</Text></Pressable>
          </View>
        </View>}
    </Screen>
    <Modal transparent animationType="fade" visible={sheet === 'filter'} onRequestClose={() => setSheet(null)} statusBarTranslucent>
      <View style={styles.filterOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close watchlist filters" style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
        <View accessibilityViewIsModal onAccessibilityEscape={() => setSheet(null)} style={[styles.filterBubble, { left: filterAnchor.x, top: filterAnchor.y, width: filterWidth }]}>
          {filters.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: filter === item.value }} style={({ pressed }) => [styles.filterRow, { minHeight: filterRowHeight }, pressed && styles.filterRowPressed]} onPress={() => { setFilter(item.value); setSheet(null); }}><Text style={styles.filterText}>{item.label}</Text>{filter === item.value ? <Check color={colors.accentText} size={20} /> : null}</Pressable>)}
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
  createButton: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.sm },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  meta: { ...typography.body, fontSize: 12, color: colors.textMuted },
  utilities: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  utility: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 44 },
  utilityText: { ...typography.body, fontSize: 13, color: colors.textMuted },
  filterOverlay: { flex: 1 },
  filterBubble: { ...shadows.raised, position: 'absolute', backgroundColor: colors.panelElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  filterRowPressed: { backgroundColor: colors.segmentSelected },
  filterText: { ...typography.body, color: colors.text, flex: 1 },
});
