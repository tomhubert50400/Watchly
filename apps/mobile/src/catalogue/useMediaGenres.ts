import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProgressively } from '../watchlists/requestBoundaries';
import { useCatalogueCache } from './CatalogueCacheContext';
import {
  getCachedMediaGenres,
  getMediaGenresKey,
  loadCachedMediaGenres,
  MediaGenresItem,
  seedMediaGenres,
} from './mediaGenresCache';

export function useMediaGenres(items: readonly MediaGenresItem[], enabled: boolean) {
  const { getCachedMovie, getCachedSeries, refreshMovie, refreshSeries } = useCatalogueCache();
  const signature = items.map(getMediaGenresKey).join('|');
  const mediaItems = useMemo(
    () => [...new Map(items.map((item) => [getMediaGenresKey(item), item])).values()],
    [signature],
  );
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState({ signature: '', loading: false, error: false });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const genresByKey: Record<string, string[]> = {};
  mediaItems.forEach((item) => {
    let genres = getCachedMediaGenres(item);
    if (genres === null) {
      const details = item.contentType === 'movie'
        ? getCachedMovie(item.tmdbId)
        : getCachedSeries(item.tmdbId);
      if (details) seedMediaGenres(item, details.genres);
      genres = getCachedMediaGenres(item);
    }
    if (genres !== null) genresByKey[getMediaGenresKey(item)] = genres;
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let failed = false;
    const missing = mediaItems.filter((item) => getCachedMediaGenres(item) === null);
    setStatus({ signature, loading: missing.length > 0, error: false });

    void loadProgressively({
      concurrency: 3,
      items: missing,
      isCurrent: () => active,
      load: async (item) => {
        try {
          return await loadCachedMediaGenres(item, async () => {
            const details = item.contentType === 'movie'
              ? await refreshMovie(item.tmdbId)
              : await refreshSeries(item.tmdbId);
            return details.genres;
          });
        } catch {
          failed = true;
          return null;
        }
      },
      onLoaded: () => setStatus({ signature, loading: true, error: failed }),
    }).then(() => {
      if (active) setStatus({ signature, loading: false, error: failed });
    });

    return () => { active = false; };
  }, [mediaItems, signature, enabled, attempt, refreshMovie, refreshSeries]);

  const genres = [...new Set(Object.values(genresByKey).flat())]
    .sort((left, right) => left.localeCompare(right));
  const currentStatus = status.signature === signature ? status : null;
  return {
    genres,
    genresByKey,
    loading: enabled && (currentStatus?.loading ?? Object.keys(genresByKey).length < mediaItems.length),
    error: enabled && (currentStatus?.error ?? false),
    retry,
  };
}
