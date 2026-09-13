import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { listSeriesProgress } from '../api/progress';
import { getEpisodeViewingSummary, getSeriesViewingSummary, saveViewingHistory } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getMemoryResource, setMemoryResource } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, readPersistedCache, writePersistedCache } from '../cache/persistedCache';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { ensureSeasonDetails } from '../catalogue/cataloguePrefetch';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { localViewingDay, toHistoryDraft } from '../viewings/viewingHistoryModel';
import { loadProgressEntries } from './progressLoader';
import { isProgressCandidate, ProgressItem, resolveProgressItem } from './progressModel';
import type { LibraryMediaItem } from './useLibraryData';

type ProgressData = { items: ProgressItem[]; loadedAt: number; savedAtByKey?: Record<string, number> };

export function useProgressData(media: LibraryMediaItem[], enabled: boolean) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { refreshSeries } = useCatalogueCache();
  const ownerId = currentUser?.id;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const signature = media.filter(isProgressCandidate).map((item) => item.key + ':' + item.updatedAt).sort().join('|');
  const key = getPrivateCacheKey(ownerId ?? 'visitor', 'progress-library:v1');
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const generation = useRef(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: ProgressData } | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const lastRetry = useRef(0);
  const [loadError, setLoadError] = useState<{ ownerId: string; message: string } | null>(null);
  const dataRef = useRef<ProgressData | null>(null);
  dataRef.current = snapshot?.key === key ? snapshot.data : getMemoryResource<ProgressData>(key)?.data ?? null;
  const [busy, setBusy] = useState<string[]>([]);
  const busyRef = useRef(new Set<string>());
  const [error, setError] = useState<{ ownerId: string; message: string } | null>(null);

  useEffect(() => {
    const version = ++generation.current;
    if (!enabled || !ownerId) { setLoading(false); return; }
    const isCurrent = () => generation.current === version && enabledRef.current && ownerRef.current === ownerId;
    const force = retryRevision !== lastRetry.current;
    lastRetry.current = retryRevision;
    setLoading(true);
    setLoadError(null);
    const sources = mediaRef.current.filter(isProgressCandidate);
    const keep = new Set(sources.map((item) => item.key));
    const publish = (data: ProgressData) => {
      dataRef.current = data;
      setSnapshot({ key, data });
      setMemoryResource(key, data, new Date(data.loadedAt).toISOString());
    };
    const persist = () => {
      const data = dataRef.current;
      if (data && ownerRef.current === ownerId) void writePersistedCache(key, data).catch(() => undefined);
    };
    void (async () => {
      try {
        const previous = dataRef.current ?? (await readPersistedCache<ProgressData>(key).catch(() => null))?.data;
        if (!isCurrent()) return;
        publish({ items: (previous?.items ?? []).filter((item) => keep.has(item.media.key)), loadedAt: previous?.loadedAt ?? Date.now(), savedAtByKey: previous?.savedAtByKey ?? Object.fromEntries((previous?.items ?? []).map((item) => [item.media.key, previous!.loadedAt])) });
        let token: string | null = null;
        await loadProgressEntries(sources, {
          force, isCurrent,
          cached: (itemKey) => {
            const data = dataRef.current;
            const item = data?.items.find((entry) => entry.media.key === itemKey);
            return item ? { item, savedAt: data!.savedAtByKey?.[itemKey] ?? data!.loadedAt } : undefined;
          },
          load: async (item) => {
            try {
              token ??= await getFirebaseIdToken();
              if (!token || !isCurrent()) throw new Error('Progress loading stopped.');
              const [series, progress, viewings] = await Promise.all([
                refreshSeries(item.tmdbId), listSeriesProgress(token, item.tmdbId), getSeriesViewingSummary(token, item.tmdbId),
              ]);
              return await resolveProgressItem({
                media: { ...item, title: series.title, backdropUrl: series.backdropUrl, posterUrl: series.posterUrl, numberOfEpisodes: series.numberOfEpisodes, watchedEpisodeCount: progress.watchedEpisodeCount },
                series: { seasons: series.seasons, status: series.status, numberOfEpisodes: series.numberOfEpisodes },
                watched: progress.episodes, viewings: viewings.episodes ?? [],
              }, async (season) => {
                if (!isCurrent()) throw new Error('Progress loading stopped.');
                return (await ensureSeasonDetails(item.tmdbId, season)).item;
              });
            } catch {
              return { media: item, series: { seasons: [], status: null, numberOfEpisodes: null }, watched: [], viewings: [], next: null, state: 'progress', error: 'Could not load the next episode.' };
            }
          },
          onItem: (item, startedAt) => {
            const current = dataRef.current!;
            // A background response must not replace an episode saved after it started.
            if ((current.savedAtByKey?.[item.media.key] ?? 0) > startedAt) return;
            const byKey = new Map(current.items.map((entry) => [entry.media.key, entry]));
            byKey.set(item.media.key, item);
            const now = Date.now();
            publish({ items: sources.flatMap((source) => byKey.has(source.key) ? [byKey.get(source.key)!] : []), loadedAt: now, savedAtByKey: { ...current.savedAtByKey, [item.media.key]: now } });
          },
        });
      } catch (cause) {
        if (isCurrent()) setLoadError({ ownerId, message: cause instanceof Error ? cause.message : 'Could not load progress.' });
      } finally {
        if (isCurrent()) { persist(); setLoading(false); }
      }
    })();
    return () => { generation.current++; persist(); };
  }, [enabled, getFirebaseIdToken, key, ownerId, refreshSeries, retryRevision, signature]);

  const items = dataRef.current?.items ?? [];
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const resource = {
    data: dataRef.current,
    error: loadError?.ownerId === ownerId ? loadError?.message ?? null : null,
    isRefreshing: loading && retryRevision > 0,
    isLoadingMore: loading,
    retry: () => setRetryRevision((value) => value + 1),
    revalidate: () => setRetryRevision((value) => value + 1),
  };

  async function markNext(item: ProgressItem) {
    const episode = item.next;
    const mutationKey = `${ownerId}:${item.media.key}`;
    if (!ownerId || ownerRef.current !== ownerId || !episode || item.error || busyRef.current.has(mutationKey)) return;
    const itemsBefore = itemsRef.current;
    busyRef.current.add(mutationKey);
    setBusy([...busyRef.current]);
    setError(null);
    let saved = false;
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to save this episode.');
      if (ownerRef.current !== ownerId) return;
      const summary = await getEpisodeViewingSummary(token, item.media.tmdbId, episode.seasonNumber, episode.episodeNumber);
      if (ownerRef.current !== ownerId) return;
      if (!summary.history) throw new Error('Could not load viewing history. Try again.');
      const expectedViews = item.viewings.find((entry) => entry.seasonNumber === episode.seasonNumber && entry.episodeNumber === episode.episodeNumber)?.viewCount ?? 0;
      if (summary.history.length !== expectedViews) throw new Error('Your progress changed. Refresh before marking this episode.');
      const previous = summary.history;
      // Stable entry IDs make retries of the same save safe and preserve existing viewings.
      const entries = [...toHistoryDraft(previous), { id: randomUUID(), watchedDate: localViewingDay() }];
      const result = await saveViewingHistory(token, { contentType: 'episode', tmdbId: item.media.tmdbId, ...episode }, previous, entries);
      saved = true;
      if (ownerRef.current !== ownerId) return;
      const now = new Date().toISOString();
      const matches = (entry: { seasonNumber: number; episodeNumber: number }) => entry.seasonNumber === episode.seasonNumber && entry.episodeNumber === episode.episodeNumber;
      const watched = [...item.watched.filter((entry) => !matches(entry)), { ...episode, id: result.items[0]!.id, seriesTmdbId: item.media.tmdbId, updatedAt: now, watchedAt: now }];
      const viewings = [...item.viewings.filter((entry) => !matches(entry)), { ...episode, viewCount: result.items.length, latestLoggedAt: now }];
      const updated = { ...item, watched, viewings, media: { ...item.media, watchedEpisodeCount: watched.length } };
      let next: ProgressItem;
      try {
        next = await resolveProgressItem(updated, async (season) => (await ensureSeasonDetails(item.media.tmdbId, season)).item);
      } catch {
        next = { ...updated, next: null, error: 'Episode saved. Refresh to load the next episode.' };
      }
      if (ownerRef.current !== ownerId) return;
      const savedAt = Date.now();
      const data = { items: (itemsRef.current.length ? itemsRef.current : itemsBefore).map((entry) => entry.media.key === item.media.key ? next : entry), loadedAt: savedAt, savedAtByKey: { ...dataRef.current?.savedAtByKey, [item.media.key]: savedAt } };
      itemsRef.current = data.items;
      dataRef.current = data;
      setSnapshot({ key, data });
      setMemoryResource(key, data, now);
      void writePersistedCache(key, data).catch(() => undefined);
      hapticSuccess();
    } catch (cause) {
      if (ownerRef.current === ownerId) {
        setError({ ownerId, message: cause instanceof Error ? cause.message : 'Could not save this episode.' });
        hapticError();
        resource.revalidate();
      }
    } finally {
      if (ownerRef.current === ownerId && saved) notifyUserDataChanged('episodeProgress', 'viewings');
      busyRef.current.delete(mutationKey);
      setBusy([...busyRef.current]);
    }
  }
  return { ...resource, retry: () => { setError(null); resource.retry(); }, items, markNext, actionError: error && error.ownerId === ownerId ? error.message : null, isBusy: (item: ProgressItem) => busy.includes(`${ownerId}:${item.media.key}`) };
}
