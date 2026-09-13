import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { listSeriesProgress } from '../api/progress';
import { getEpisodeViewingSummary, getSeriesViewingSummary, saveViewingHistory } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { ensureSeasonDetails } from '../catalogue/cataloguePrefetch';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';
import { localViewingDay, toHistoryDraft } from '../viewings/viewingHistoryModel';
import { isProgressCandidate, ProgressItem, resolveProgressItem } from './progressModel';
import type { LibraryMediaItem } from './useLibraryData';

type ProgressData = { items: ProgressItem[]; loadedAt: number };

export function useProgressData(media: LibraryMediaItem[], enabled: boolean) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { refreshSeries } = useCatalogueCache();
  const revision = useUserDataRevision('episodeProgress', 'viewings', 'tracking');
  const ownerId = currentUser?.id;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const signature = media.filter(isProgressCandidate).map((item) => item.key).sort().join('|');
  const key = getPrivateCacheKey(ownerId ?? 'visitor', 'progress-library:v1');
  const [overrides, setOverrides] = useState<Record<string, { ownerId: string; savedAt: number; item: ProgressItem }>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const busyRef = useRef(new Set<string>());
  const [error, setError] = useState<{ ownerId: string; message: string } | null>(null);
  const load = useCallback(async (): Promise<ProgressData> => {
    void signature; void revision;
    const loadedAt = Date.now();
    const token = await getFirebaseIdToken();
    if (!token) throw new Error('Sign in again to load your progress.');
    const candidates = mediaRef.current.filter(isProgressCandidate);
    const items: ProgressItem[] = new Array(candidates.length);
    let cursor = 0;
    // Keep catalogue and private requests bounded, including for large imported libraries.
    await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        const index = cursor++;
        const item = candidates[index]!;
        try {
          const [series, progress, viewings] = await Promise.all([
            refreshSeries(item.tmdbId), listSeriesProgress(token, item.tmdbId), getSeriesViewingSummary(token, item.tmdbId),
          ]);
          items[index] = await resolveProgressItem({
            media: { ...item, title: series.title, backdropUrl: series.backdropUrl, posterUrl: series.posterUrl, numberOfEpisodes: series.numberOfEpisodes, watchedEpisodeCount: progress.watchedEpisodeCount },
            series: { seasons: series.seasons, status: series.status, numberOfEpisodes: series.numberOfEpisodes },
            watched: progress.episodes, viewings: viewings.episodes ?? [],
          }, async (season) => (await ensureSeasonDetails(item.tmdbId, season)).item);
        } catch {
          items[index] = { media: item, series: { seasons: [], status: null, numberOfEpisodes: null }, watched: [], viewings: [], next: null, state: 'progress', error: 'Could not load the next episode.' };
        }
      }
    }));
    return { items, loadedAt };
  }, [getFirebaseIdToken, ownerId, refreshSeries, revision, signature]);
  const resource = useCachedResource({ key, load, enabled: enabled && Boolean(ownerId), staleTimeMs: 0 });
  const items = (resource.data?.items ?? []).map((item) => {
    const override = overrides[item.media.key];
    return override?.ownerId === ownerId && override.savedAt >= (resource.data?.loadedAt ?? 0) ? override.item : item;
  });
  const itemsRef = useRef(items);
  itemsRef.current = items;

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
      setOverrides((current) => ({ ...current, [item.media.key]: { ownerId, savedAt, item: next } }));
      const data = { items: (itemsRef.current.length ? itemsRef.current : itemsBefore).map((entry) => entry.media.key === item.media.key ? next : entry), loadedAt: savedAt };
      itemsRef.current = data.items;
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
