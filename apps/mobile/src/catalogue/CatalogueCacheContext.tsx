import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getMovieDetails, getSeriesDetails, MovieDetails, SeriesDetails } from '../api/catalogue';
import { WatchlistContentType } from '../api/watchlists';
import { loadCachedCatalogueResource } from './catalogueResourceCache';

type CatalogueCacheContextValue = {
  getCachedMovie: (tmdbId: number) => MovieDetails | null;
  getCachedSeries: (tmdbId: number) => SeriesDetails | null;
  preloadCatalogueItems: (items: { contentType: WatchlistContentType; tmdbId: number }[]) => Promise<void>;
  refreshMovie: (tmdbId: number) => Promise<MovieDetails>;
  refreshSeries: (tmdbId: number) => Promise<SeriesDetails>;
};

const MAX_PRELOAD_ITEMS = 3;
const CatalogueCacheContext = createContext<CatalogueCacheContextValue | null>(null);

export function CatalogueCacheProvider({ children }: PropsWithChildren) {
  const [movies, setMovies] = useState<Record<number, MovieDetails>>({});
  const [series, setSeries] = useState<Record<number, SeriesDetails>>({});
  const movieRequestsRef = useRef(new Map<number, Promise<MovieDetails>>());
  const seriesRequestsRef = useRef(new Map<number, Promise<SeriesDetails>>());

  const refreshMovie = useCallback(async (tmdbId: number) => {
    const existingRequest = movieRequestsRef.current.get(tmdbId);

    if (existingRequest) {
      return existingRequest;
    }

    const request = loadCachedCatalogueResource(
      `watchly:public:catalogue:movie:${tmdbId}:v5`,
      async () => (await getMovieDetails(tmdbId)).item,
    )
      .then((item) => {
        setMovies((current) => ({ ...current, [tmdbId]: item }));

        return item;
      })
      .finally(() => {
        movieRequestsRef.current.delete(tmdbId);
      });

    movieRequestsRef.current.set(tmdbId, request);

    return request;
  }, []);

  const refreshSeries = useCallback(async (tmdbId: number) => {
    const existingRequest = seriesRequestsRef.current.get(tmdbId);

    if (existingRequest) {
      return existingRequest;
    }

    const request = loadCachedCatalogueResource(
      `watchly:public:catalogue:series:${tmdbId}:v4`,
      async () => (await getSeriesDetails(tmdbId)).item,
    )
      .then((item) => {
        setSeries((current) => ({ ...current, [tmdbId]: item }));

        return item;
      })
      .finally(() => {
        seriesRequestsRef.current.delete(tmdbId);
      });

    seriesRequestsRef.current.set(tmdbId, request);

    return request;
  }, []);

  const preloadCatalogueItems = useCallback(
    async (items: { contentType: WatchlistContentType; tmdbId: number }[]) => {
      const uniqueItems = dedupeCatalogueItems(items).slice(0, MAX_PRELOAD_ITEMS);

      await Promise.all(uniqueItems.map((item) => {
        if (item.contentType === 'movie') {
          return refreshMovie(item.tmdbId).catch(() => undefined);
        }

        return refreshSeries(item.tmdbId).catch(() => undefined);
      }));
    },
    [refreshMovie, refreshSeries],
  );

  const value = useMemo<CatalogueCacheContextValue>(
    () => ({
      getCachedMovie: (tmdbId) => movies[tmdbId] ?? null,
      getCachedSeries: (tmdbId) => series[tmdbId] ?? null,
      preloadCatalogueItems,
      refreshMovie,
      refreshSeries,
    }),
    [movies, preloadCatalogueItems, refreshMovie, refreshSeries, series],
  );

  return <CatalogueCacheContext.Provider value={value}>{children}</CatalogueCacheContext.Provider>;
}

export function useCatalogueCache() {
  const context = useContext(CatalogueCacheContext);

  if (!context) {
    throw new Error('useCatalogueCache must be used inside CatalogueCacheProvider.');
  }

  return context;
}

function dedupeCatalogueItems(items: { contentType: WatchlistContentType; tmdbId: number }[]) {
  const seen = new Set<string>();
  const uniqueItems: { contentType: WatchlistContentType; tmdbId: number }[] = [];

  items.forEach((item) => {
    const key = `${item.contentType}:${item.tmdbId}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueItems.push(item);
  });

  return uniqueItems;
}
