import { useCallback } from 'react';
import { getMovieDetails, getSeriesDetails } from '../api/catalogue';
import { listReleaseAlerts } from '../api/notifications';
import { listSeriesProgressSummaries } from '../api/progress';
import { listMovieRatings } from '../api/ratings';
import { getSharedWatchlist, listSharedWatchlists } from '../api/sharedWatchlists';
import { listTrackingStates } from '../api/tracking';
import { getWatchlist, listWatchlists } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { createRequestCoalescer, takeHydrationItems } from '../watchlists/requestBoundaries';
import { calculateResumeEpisode, LibraryItemBase, mapLibrarySourceErrors, mergeLibraryItems, shouldShowTrackedTitle } from './libraryModel';

const MAX_LIBRARY_LIST_PREVIEWS = 12;
const MAX_LIBRARY_MEDIA_HYDRATIONS = 24;

export type LibraryMediaItem = LibraryItemBase & {
  backdropUrl: string | null;
  numberOfEpisodes: number | null;
  posterUrl: string | null;
  title: string;
};
export type LibraryListItem = {
  id: string; isOwner: boolean; itemCount: number; key: string; kind: 'personal' | 'shared';
  memberCount: number | null; name: string; posterUrls: Array<string | null>; updatedAt: string;
};
export type LibraryData = { items: LibraryMediaItem[]; lists: LibraryListItem[]; partialError: string | null };

export function useLibraryData() {
  const { currentUser, getFirebaseIdToken, trackingRevision } = useAuthSession();
  const key = currentUser ? `watchly:user:${currentUser.id}:library:v3` : 'watchly:user:visitor:library-disabled';
  const load = useCallback(async (cached?: LibraryData): Promise<LibraryData> => {
    if (!currentUser) throw new Error('Sign in to load your library.');
    const token = await getFirebaseIdToken();
    if (!token) throw new Error('Sign in again to load your library.');
    const previous = cached;
    const [tracking, ratings, progress, personal, shared, alerts] = await Promise.allSettled([
      listTrackingStates(token), listMovieRatings(token), listSeriesProgressSummaries(token),
      listWatchlists(token), listSharedWatchlists(token), listReleaseAlerts(token),
    ]);
    const results = { tracking, ratings, progress, personal, shared, alerts };
    if (Object.values(results).every((result) => result.status === 'rejected')) {
      throw new Error('Could not update your library.');
    }
    const sourceErrors = Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.status === 'rejected' ? result.reason : null]));
    const mediaSourcesFailed = [tracking, ratings, progress, alerts].some((result) => result.status === 'rejected');
    let items: LibraryMediaItem[];
    if (mediaSourcesFailed && previous?.items.length) {
      items = previous.items;
    } else {
      const bases = mergeLibraryItems(
        tracking.status === 'fulfilled' ? tracking.value : [], ratings.status === 'fulfilled' ? ratings.value : [],
        progress.status === 'fulfilled' ? progress.value.items : [], alerts.status === 'fulfilled' ? alerts.value.items : [],
      ).filter(shouldShowTrackedTitle);
      const hydrationKeys = new Set(
        takeHydrationItems(bases, MAX_LIBRARY_MEDIA_HYDRATIONS).map((item) => item.key),
      );
      items = await Promise.all(bases.map((item) => {
        const fallback = previous?.items.find((old) => old.key === item.key);
        return hydrationKeys.has(item.key)
          ? hydrateMediaItem(item, fallback)
          : Promise.resolve(fallback ? { ...fallback, ...item } : toLibraryFallback(item));
      }));
    }
    let lists: LibraryListItem[];
    if ((personal.status === 'rejected' || shared.status === 'rejected') && previous?.lists.length) {
      lists = previous.lists;
    } else {
      const summaries: Omit<LibraryListItem, 'posterUrls'>[] = [
        ...(personal.status === 'fulfilled' ? personal.value.items : []).map((list) => ({ id: list.id, isOwner: true, itemCount: list.itemCount, key: `personal:${list.id}`, kind: 'personal' as const, memberCount: null, name: list.name, updatedAt: list.updatedAt })),
        ...(shared.status === 'fulfilled' ? shared.value.items : []).map((list) => ({ id: list.id, isOwner: list.isOwner, itemCount: list.itemCount, key: `shared:${list.id}`, kind: 'shared' as const, memberCount: list.memberCount, name: list.name, updatedAt: list.updatedAt })),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const previewKeys = new Set(
        takeHydrationItems(summaries, MAX_LIBRARY_LIST_PREVIEWS).map((list) => list.key),
      );
      const loadPoster = createRequestCoalescer(async (mediaKey: string) => {
        const [contentType, rawTmdbId] = mediaKey.split(':');
        const tmdbId = Number(rawTmdbId);
        const details = contentType === 'movie'
          ? (await getMovieDetails(tmdbId)).item
          : (await getSeriesDetails(tmdbId)).item;
        return details.backdropUrl ?? details.posterUrl;
      });
      lists = await Promise.all(summaries.map(async (list) => {
        const fallback = previous?.lists.find((old) => old.key === list.key)?.posterUrls ?? [];
        return {
          ...list,
          posterUrls: previewKeys.has(list.key)
            ? await hydrateListPosters(token, list, fallback, loadPoster)
            : fallback,
        };
      }));
    }
    return { items, lists, partialError: mapLibrarySourceErrors(sourceErrors) };
  }, [currentUser, getFirebaseIdToken, key, trackingRevision]);
  return { key, ...useCachedResource({ enabled: Boolean(currentUser), key, load }) };
}

async function hydrateMediaItem(item: LibraryItemBase, fallback?: LibraryMediaItem): Promise<LibraryMediaItem> {
  try {
    if (item.contentType === 'movie') {
      const { item: details } = await getMovieDetails(item.tmdbId);
      return { ...item, backdropUrl: details.backdropUrl, numberOfEpisodes: null, posterUrl: details.posterUrl, title: details.title };
    }
    const { item: details } = await getSeriesDetails(item.tmdbId);
    const resume = calculateResumeEpisode(details.seasons, item.resumeSeasonNumber, item.resumeEpisodeNumber);
    return { ...item, backdropUrl: details.backdropUrl, numberOfEpisodes: details.numberOfEpisodes, posterUrl: details.posterUrl, title: details.title, resumeEpisodeNumber: resume?.episodeNumber ?? null, resumeSeasonNumber: resume?.seasonNumber ?? null };
  } catch {
    return fallback ? { ...fallback, ...item } : toLibraryFallback(item);
  }
}

function toLibraryFallback(item: LibraryItemBase): LibraryMediaItem {
  return { ...item, backdropUrl: null, numberOfEpisodes: null, posterUrl: null, title: `TMDB ${item.tmdbId}` };
}

async function hydrateListPosters(
  token: string,
  list: Omit<LibraryListItem, 'posterUrls'>,
  fallback: Array<string | null>,
  loadPoster: (mediaKey: string) => Promise<string | null>,
) {
  try {
    const details = list.kind === 'personal' ? await getWatchlist(token, list.id) : await getSharedWatchlist(token, list.id);
    const urls = await Promise.all(details.items.slice(0, 4).map(async (item) => {
      try { return await loadPoster(`${item.contentType}:${item.tmdbId}`); }
      catch { return null; }
    }));
    return urls.length ? urls : fallback;
  } catch { return fallback; }
}
