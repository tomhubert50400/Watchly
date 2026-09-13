import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { disableReleaseAlert, enableReleaseAlert } from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { writePersistedCache } from '../cache/persistedCache';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { getLastWatchedLibraryItem } from './libraryModel';
import { OwnerScopedData, replaceOwnedData, updateOwnedData } from './libraryState';
import { ReleaseAlertRow } from './ReleaseAlertRow';
import { LibraryData, LibraryMediaItem, useLibraryData } from './useLibraryData';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const resource = useLibraryData();
  const [scopedData, setScopedData] = useState<OwnerScopedData<LibraryData> | null>(null);
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
  const alertItems = (data?.items ?? []).filter((item) => item.hasReleaseAlert);
  const lastWatchedItem = getLastWatchedLibraryItem(data?.items ?? []);
  const atmosphereUrl = lastWatchedItem?.posterUrl ?? lastWatchedItem?.backdropUrl ?? null;

  function openItem(item: LibraryMediaItem) {
    if (item.contentType === 'movie') navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
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
  return <Screen contentReady={!currentUser || Boolean(data)} background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null} safeAreaEdges={['bottom']} refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined} statusBanner={banner} title="">
    {!currentUser ? <SignInRequiredCard body="Sign in to manage alerts for the movies and series you follow." title="Sign in to manage release alerts" />
      : resource.isInitialLoading && !data ? <LoadingState variant="grid" label="Loading release alerts" />
      : resource.error && !data ? <EmptyState body={resource.error} title="Release alerts unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : data ? <View style={styles.content}>
        {data.partialError ? <InlineStatusBanner detail={data.partialError} onRetry={resource.retry} tone="error" /> : null}
        <ScreenReveal delay={80} style={styles.section}>
          <SectionHeader title="Followed titles" />
          {alertItems.map((item) => <ReleaseAlertRow item={item} key={item.key} onOpen={() => openItem(item)} onToggle={() => void toggleAlert(item)} />)}
          {alertItems.length === 0 ? <Text style={styles.emptyInline}>No active release alerts.</Text> : null}
        </ScreenReveal>
      </View> : null}
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, section: { gap: spacing.sm }, emptyInline: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md } });
