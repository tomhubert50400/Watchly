import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen } from 'lucide-react-native';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { disableReleaseAlert, enableReleaseAlert } from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { writePersistedCache } from '../cache/persistedCache';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { buildLibrarySummary, getLastWatchedLibraryItem } from './libraryModel';
import { OwnerScopedData, replaceOwnedData, updateOwnedData } from './libraryState';
import { LibrarySummary } from './LibrarySummary';
import { ReleaseAlertRow } from './ReleaseAlertRow';
import { LibraryData, LibraryMediaItem, useLibraryData } from './useLibraryData';

type Tab = 'alerts' | 'progress';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const resource = useLibraryData();
  const [scopedData, setScopedData] = useState<OwnerScopedData<LibraryData> | null>(null);
  const [tab, setTab] = useState<Tab>('progress');
  const [actionError, setActionError] = useState<string | null>(null);
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
  useEffect(() => { setActionError(null); }, [currentUser?.id]);
  const summary = useMemo(() => buildLibrarySummary(data?.items ?? [], data?.lists.length ?? 0), [data]);
  const continueItems = (data?.items ?? []).filter((item) => item.contentType === 'series' && item.resumeEpisodeNumber !== null);
  const alertItems = (data?.items ?? []).filter((item) => item.hasReleaseAlert);
  const visibleItems = tab === 'progress' ? continueItems : alertItems;
  const lastWatchedItem = getLastWatchedLibraryItem(data?.items ?? []);
  const atmosphereUrl = lastWatchedItem?.posterUrl ?? lastWatchedItem?.backdropUrl ?? null;

  function openItem(item: LibraryMediaItem, resume = false) {
    if (resume && item.contentType === 'series' && item.resumeSeasonNumber && item.resumeEpisodeNumber) {
      navigation.navigate('EpisodeDetail', { episodeNumber: item.resumeEpisodeNumber, seasonNumber: item.resumeSeasonNumber, seriesTitle: item.title, title: item.title, tmdbId: item.tmdbId });
    } else if (item.contentType === 'movie') navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    else navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
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

  const banner = actionError ? <InlineStatusBanner detail={actionError} tone="error" title="Action failed" /> : null;
  return <Screen contentReady={!currentUser || Boolean(data)} background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null} safeAreaEdges={['bottom']} refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined} statusBanner={banner} title="" trailing={currentUser ? <IconButton accessibilityLabel="Open Journal" icon={<BookOpen color={colors.text} size={21} />} onPress={() => navigation.navigate('Journal')} /> : null}>
    {!currentUser ? <SignInRequiredCard body="You need to be signed in to use this section. Sign in here to keep your progress, ratings and release alerts together." title="Sign in to view progress" />
      : resource.isInitialLoading && !data ? <LoadingState variant="grid" label="Loading your library" />
      : resource.error && !data ? <EmptyState body={resource.error} title="Library unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : data && data.items.length === 0 && data.lists.length === 0 ? <EmptyState body="Track a title. Your progress and ratings will appear here automatically." title="Start tracking"><Button label="Explore titles" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} /></EmptyState>
      : data ? <View style={styles.content}>
        <ScreenReveal delay={80}><LibrarySummary summary={summary} /></ScreenReveal>
        <SegmentedControl options={[{ accessibilityLabel: 'In progress', label: 'Progress', value: 'progress' }, { label: 'Release alerts', value: 'alerts' }]} value={tab} onChange={setTab} />
        {tab === 'progress' && continueItems.length > 0 ? <ScreenReveal delay={130} style={styles.section}><SectionHeader title="Continue watching" /><ContinueWatchingCard item={continueItems[0]!} onPress={() => openItem(continueItems[0]!, true)} /></ScreenReveal> : null}
        <ScreenReveal delay={200} style={styles.section}><SectionHeader title={tab === 'progress' ? 'In progress' : 'Release alerts'} />{visibleItems.map((item) => <ReleaseAlertRow item={item} key={item.key} onOpen={() => openItem(item)} onToggle={() => void toggleAlert(item)} />)}{visibleItems.length === 0 ? <Text style={styles.emptyInline}>{tab === 'progress' ? 'Nothing in progress right now.' : 'No active release alerts.'}</Text> : null}</ScreenReveal>
      </View> : null}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, section: { gap: spacing.sm }, emptyInline: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md } });
