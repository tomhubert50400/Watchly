import type { MovieDetails, SeriesDetails } from '../api/catalogue';

export const MAX_CATALOGUE_DETAIL_ENTRIES = 120;

export type CatalogueDetailCache = ReadonlyMap<string, MovieDetails | SeriesDetails>;

// Movies and series share one budget. Refreshing an entry moves it to the end,
// so the oldest successful loads are released first without mutating React state.
export function retainCatalogueDetail(
  current: CatalogueDetailCache,
  tmdbId: number,
  item: MovieDetails | SeriesDetails,
): CatalogueDetailCache {
  const next = new Map(current);
  const key = `${item.mediaType}:${tmdbId}`;
  next.delete(key);
  next.set(key, item);

  while (next.size > MAX_CATALOGUE_DETAIL_ENTRIES) {
    const oldestKey = next.keys().next().value;
    if (oldestKey === undefined) break;
    next.delete(oldestKey);
  }

  return next;
}

export function getCachedMovieDetail(cache: CatalogueDetailCache, tmdbId: number): MovieDetails | null {
  const item = cache.get(`movie:${tmdbId}`);
  return item?.mediaType === 'movie' ? item : null;
}

export function getCachedSeriesDetail(cache: CatalogueDetailCache, tmdbId: number): SeriesDetails | null {
  const item = cache.get(`series:${tmdbId}`);
  return item?.mediaType === 'series' ? item : null;
}
