import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import type { CatalogueMovieSectionsResponse } from '../api/catalogue';
import { useAuthSession } from '../auth/AuthSessionContext';
import { preloadCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import {
  loadCatalogueSections,
  PUBLIC_CATALOGUE_SECTIONS_KEY,
} from '../catalogue/catalogueSectionsResource';
import {
  getCommunityFeedKey,
  type HydratedFeedItem,
  loadCommunityFeed,
} from '../feed/FeedScreen';
import {
  getHomeFeedKey,
  getHomeNotificationsKey,
  getHomeProgressKey,
  loadHomeCatalogue,
  loadHomeFeed,
  loadHomeNotifications,
  loadHomeProgress,
  PUBLIC_HOME_KEY,
} from '../home/HomeScreen';
import type { HomeCatalogueData, HomeFeedItem, HomeProgressItem } from '../home/homeData';
import {
  getLibraryResourceKey,
  type LibraryData,
  loadLibraryData,
} from '../library/useLibraryData';
import {
  type CachedProfile,
  getProfileResourceKey,
  loadProfileData,
} from '../profile/ProfileScreen';
import { useWatchlistCache } from '../watchlists/WatchlistCacheContext';
import { useAppLaunchReadiness } from './WatchlyLaunchGate';

const CATALOGUE_SECTIONS_STALE_TIME_MS = 15 * 60 * 1000;
const STARTUP_IMAGE_LIMIT = 24;
const STARTUP_IMAGE_WAIT_MS = 3_000;

export function AppStartupPreloader() {
  const { currentUser, getFirebaseIdToken, status } = useAuthSession();
  const { preloadCatalogueItems, refreshMovie, refreshSeries } = useCatalogueCache();
  const { preloadWatchlists } = useWatchlistCache();
  const [ready, setReady] = useState(false);
  const requestVersionRef = useRef(0);
  useAppLaunchReadiness(ready);

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    void (async () => {
      const [homeResult, catalogueSectionsResult] = await Promise.allSettled([
        preloadCachedResource({ key: PUBLIC_HOME_KEY, load: loadHomeCatalogue }),
        preloadCachedResource({
          key: PUBLIC_CATALOGUE_SECTIONS_KEY,
          load: loadCatalogueSections,
          staleTimeMs: CATALOGUE_SECTIONS_STALE_TIME_MS,
        }),
      ] as const);
      const home = fulfilledValue(homeResult);
      const catalogueSections = fulfilledValue(catalogueSectionsResult);

      if (status === 'loading') {
        return;
      }

      if (requestVersionRef.current === requestVersion) {
        setReady(true);
      }

      if (catalogueSections) {
        await preloadCatalogueItems(
          [
            ...catalogueSections.trending,
            ...catalogueSections.trendingSeries,
            ...catalogueSections.announced,
            ...catalogueSections.announcedSeries,
          ]
            .map((item) => ({ contentType: item.mediaType, tmdbId: item.tmdbId })),
        );
      }

      let progress: HomeProgressItem[] | undefined;
      let feed: HomeFeedItem[] | undefined;
      let communityFeed: HydratedFeedItem[] | undefined;
      let library: LibraryData | undefined;
      let profile: CachedProfile | undefined;

      if (status === 'signedIn' && currentUser) {
        const token = await getFirebaseIdToken();

        if (token) {
          const userId = currentUser.id;
          const privateResults = await Promise.allSettled([
            preloadCachedResource<HomeProgressItem[]>({
              key: getHomeProgressKey(userId),
              load: () => loadHomeProgress(token),
            }),
            preloadCachedResource<HomeFeedItem[]>({
              key: getHomeFeedKey(userId),
              load: () => loadHomeFeed(token),
            }),
            preloadCachedResource({
              key: getHomeNotificationsKey(userId),
              load: () => loadHomeNotifications(token),
            }),
            preloadCachedResource<HydratedFeedItem[]>({
              key: getCommunityFeedKey(userId),
              load: (cached) => loadCommunityFeed(
                token,
                refreshMovie,
                refreshSeries,
                cached,
              ),
            }),
            preloadCachedResource<LibraryData>({
              key: getLibraryResourceKey(userId),
              load: (cached) => loadLibraryData(token, cached),
            }),
            preloadCachedResource<CachedProfile>({
              key: getProfileResourceKey(userId),
              load: (cached) => loadProfileData(token, refreshSeries, cached),
            }),
            preloadWatchlists(),
          ] as const);

          progress = fulfilledValue(privateResults[0]);
          feed = fulfilledValue(privateResults[1]);
          communityFeed = fulfilledValue(privateResults[3]);
          library = fulfilledValue(privateResults[4]);
          profile = fulfilledValue(privateResults[5]);
        }
      }

      await prefetchStartupImages({
        catalogueSections,
        communityFeed,
        feed,
        home,
        library,
        profile,
        progress,
      });
    })();
  }, [
    currentUser?.id,
    getFirebaseIdToken,
    preloadCatalogueItems,
    preloadWatchlists,
    refreshMovie,
    refreshSeries,
    status,
  ]);

  return null;
}

function fulfilledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled' ? result.value : undefined;
}

async function prefetchStartupImages({
  catalogueSections,
  communityFeed,
  feed,
  home,
  library,
  profile,
  progress,
}: {
  catalogueSections?: CatalogueMovieSectionsResponse;
  communityFeed?: HydratedFeedItem[];
  feed?: HomeFeedItem[];
  home?: HomeCatalogueData;
  library?: LibraryData;
  profile?: CachedProfile;
  progress?: HomeProgressItem[];
}) {
  const groups: Array<Array<string | null | undefined>> = [
    [home?.hero?.backdropUrl, home?.hero?.logoUrl, home?.hero?.posterUrl],
    [
      catalogueSections?.spotlight?.backdropUrl,
      ...((catalogueSections?.trending ?? []).slice(0, 6).map((item) => item.posterUrl)),
      ...((catalogueSections?.trendingSeries ?? []).slice(0, 4).map((item) => item.posterUrl)),
      ...((catalogueSections?.announced ?? []).slice(0, 4).map((item) => item.posterUrl)),
      ...((catalogueSections?.announcedSeries ?? []).slice(0, 4).map((item) => item.posterUrl)),
    ],
    [
      ...(library?.items.slice(0, 6).flatMap((item) => [item.backdropUrl, item.posterUrl]) ?? []),
      ...(library?.lists.slice(0, 3).flatMap((item) => item.posterUrls) ?? []),
    ],
    [
      ...(profile?.viewingStats.highlights.slice(0, 3).map((item) => item.artworkUrl) ?? []),
      ...(profile?.opinions.slice(0, 4).map((item) => item.contentImageUrl) ?? []),
    ],
    [
      ...(progress?.slice(0, 4).map((item) => item.backdropUrl) ?? []),
      ...(feed?.slice(0, 4).map((item) => item.contentImageUrl) ?? []),
      ...(home?.trending.slice(0, 6).map((item) => item.posterUrl) ?? []),
    ],
    communityFeed?.slice(0, 6).map((item) => item.contentImageUrl) ?? [],
  ];
  const urls = takeRoundRobinUrls(groups, STARTUP_IMAGE_LIMIT);

  await waitAtMost(
    Promise.allSettled(urls.map((url) => Image.prefetch(url))).then(() => undefined),
    STARTUP_IMAGE_WAIT_MS,
  );
}

function takeRoundRobinUrls(groups: Array<Array<string | null | undefined>>, limit: number) {
  const urls: string[] = [];
  const seen = new Set<string>();
  const longestGroup = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < longestGroup && urls.length < limit; index += 1) {
    for (const group of groups) {
      const url = group[index]?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length === limit) break;
    }
  }

  return urls;
}

function waitAtMost(promise: Promise<void>, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    promise.finally(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
