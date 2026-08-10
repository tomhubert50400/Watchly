import { useEffect, useMemo, useState } from 'react';
import type { ProfileBackdropSelection } from '../api/profile';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';

type LoadedArtwork = {
  key: string;
  url: string | null;
};

export function useProfileBackdropArtwork(
  selection: ProfileBackdropSelection | null,
) {
  const {
    getCachedMovie,
    getCachedSeries,
    refreshMovie,
    refreshSeries,
  } = useCatalogueCache();
  const [loadedArtwork, setLoadedArtwork] = useState<LoadedArtwork | null>(null);
  const key = selection ? `${selection.contentType}:${selection.tmdbId}` : null;
  const cachedArtwork = useMemo(() => {
    if (!selection) return null;
    const item = selection.contentType === 'movie'
      ? getCachedMovie(selection.tmdbId)
      : getCachedSeries(selection.tmdbId);
    return item?.backdropUrl ?? item?.posterUrl ?? null;
  }, [getCachedMovie, getCachedSeries, selection]);

  useEffect(() => {
    if (!selection || !key) return;

    let active = true;
    const request = selection.contentType === 'movie'
      ? refreshMovie(selection.tmdbId)
      : refreshSeries(selection.tmdbId);

    void request
      .then((item) => {
        if (active) {
          setLoadedArtwork({ key, url: item.backdropUrl ?? item.posterUrl ?? null });
        }
      })
      .catch(() => {
        if (active) setLoadedArtwork({ key, url: null });
      });

    return () => {
      active = false;
    };
  }, [key, refreshMovie, refreshSeries, selection]);

  if (!key) return null;
  return cachedArtwork ?? (loadedArtwork?.key === key ? loadedArtwork.url : null);
}
