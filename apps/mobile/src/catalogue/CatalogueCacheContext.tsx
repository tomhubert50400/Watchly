import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getMovieDetails, getSeriesDetails, MovieDetails, SeriesDetails } from '../api/catalogue';
import { WatchlistContentType } from '../api/watchlists';

type CatalogueCacheContextValue = {
  getCachedMovie: (tmdbId: number) => MovieDetails | null;
  getCachedSeries: (tmdbId: number) => SeriesDetails | null;
  preloadCatalogueItems: (items: { contentType: WatchlistContentType; tmdbId: number }[]) => void;
  refreshMovie: (tmdbId: number) => Promise<MovieDetails>;
  refreshSeries: (tmdbId: number) => Promise<SeriesDetails>;
};

const MAX_PRELOAD_ITEMS = 40;
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

    const request = getMovieDetails(tmdbId)
      .then((response) => {
        setMovies((current) => ({ ...current, [tmdbId]: response.item }));

        return response.item;
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

    const request = getSeriesDetails(tmdbId)
      .then((response) => {
        setSeries((current) => ({ ...current, [tmdbId]: response.item }));

        return response.item;
      })
      .finally(() => {
        seriesRequestsRef.current.delete(tmdbId);
      });

    seriesRequestsRef.current.set(tmdbId, request);

    return request;
  }, []);

  const preloadCatalogueItems = useCallback(
    (items: { contentType: WatchlistContentType; tmdbId: number }[]) => {
      const uniqueItems = dedupeCatalogueItems(items).slice(0, MAX_PRELOAD_ITEMS);

      uniqueItems.forEach((item) => {
        if (item.contentType === 'movie') {
          void refreshMovie(item.tmdbId).catch(() => undefined);
          return;
        }

        void refreshSeries(item.tmdbId).catch(() => undefined);
      });
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
