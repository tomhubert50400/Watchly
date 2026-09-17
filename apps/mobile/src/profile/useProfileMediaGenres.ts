import { useEffect, useRef, useState } from 'react';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { loadProgressively } from '../watchlists/requestBoundaries';

export function useProfileMediaGenres(items: readonly LibraryMediaItem[], enabled: boolean) {
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const cache = useRef<Record<string, string[]>>({});
  const [genresByKey, setGenresByKey] = useState<Record<string, string[]>>({});
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(false);
    let failed = false;
    void loadProgressively({
      concurrency: 3,
      items: items.filter((item) => cache.current[item.key] === undefined),
      load: async (item) => {
        if (!active) return null;
        try {
          const details = item.contentType === 'movie'
            ? await refreshMovie(item.tmdbId)
            : await refreshSeries(item.tmdbId);
          return details.genres;
        } catch {
          failed = true;
          return null;
        }
      },
      onLoaded: (genres, item) => {
        if (active && genres) cache.current[item.key] = genres;
      },
    }).then(() => {
      if (!active) return;
      setGenresByKey({ ...cache.current });
      setError(failed);
      setLoading(false);
    });
    return () => { active = false; };
  }, [items, enabled, attempt, refreshMovie, refreshSeries]);

  const genres = [...new Set(items.flatMap((item) => genresByKey[item.key] ?? []))]
    .sort((left, right) => left.localeCompare(right));
  return { genres, genresByKey, loading, error, retry: () => setAttempt((value) => value + 1) };
}
