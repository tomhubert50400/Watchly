import { useEffect, useState } from 'react';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { calculateResumeEpisode } from '../library/libraryModel';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { loadProgressively } from '../watchlists/requestBoundaries';

const PROFILE_MEDIA_HYDRATION_CONCURRENCY = 3;

export function useHydratedProfileMediaItems(items: readonly LibraryMediaItem[]) {
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [hydratedItems, setHydratedItems] = useState<LibraryMediaItem[]>([...items]);

  useEffect(() => {
    let active = true;
    setHydratedItems((current) => items.map((item) => {
      const previous = current.find((candidate) => candidate.key === item.key);
      if (!previous) return item;

      return {
        ...item,
        backdropUrl: item.backdropUrl ?? previous.backdropUrl,
        numberOfEpisodes: item.numberOfEpisodes ?? previous.numberOfEpisodes,
        posterUrl: item.posterUrl ?? previous.posterUrl,
        title: isCataloguePlaceholderTitle(item.title) ? previous.title : item.title,
      };
    }));

    const pendingItems = items.filter(needsCatalogueHydration);
    void loadProgressively({
      concurrency: PROFILE_MEDIA_HYDRATION_CONCURRENCY,
      items: pendingItems,
      load: async (item) => {
        try {
          return await hydrateProfileMediaItem(item, refreshMovie, refreshSeries);
        } catch {
          return item;
        }
      },
      onLoaded: (loaded, source) => {
        if (!active || loaded === source) return;
        setHydratedItems((current) => current.map((item) => (
          item.key === loaded.key ? loaded : item
        )));
      },
    });

    return () => {
      active = false;
    };
  }, [items, refreshMovie, refreshSeries]);

  return hydratedItems;
}

export function useHydratedProfileMediaItem(item: LibraryMediaItem) {
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [hydratedItem, setHydratedItem] = useState(item);

  useEffect(() => {
    let active = true;
    setHydratedItem((current) => mergeHydratedItem(item, current));

    if (!needsCatalogueHydration(item)) {
      return () => {
        active = false;
      };
    }

    void hydrateProfileMediaItem(item, refreshMovie, refreshSeries)
      .then((loaded) => {
        if (active) setHydratedItem(loaded);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [item, refreshMovie, refreshSeries]);

  return hydratedItem;
}

export function getProfileMediaDisplayTitle(item: Pick<LibraryMediaItem, 'title'>) {
  return isCataloguePlaceholderTitle(item.title) ? 'Loading title' : item.title;
}

export function needsCatalogueHydration(item: LibraryMediaItem) {
  return isCataloguePlaceholderTitle(item.title)
    || (item.contentType === 'series' && item.numberOfEpisodes === null);
}

function isCataloguePlaceholderTitle(title: string) {
  return /^TMDB \d+$/.test(title);
}

async function hydrateProfileMediaItem(
  item: LibraryMediaItem,
  refreshMovie: ReturnType<typeof useCatalogueCache>['refreshMovie'],
  refreshSeries: ReturnType<typeof useCatalogueCache>['refreshSeries'],
) {
  if (item.contentType === 'movie') {
    const details = await refreshMovie(item.tmdbId);
    return {
      ...item,
      backdropUrl: details.backdropUrl,
      numberOfEpisodes: null,
      posterUrl: details.posterUrl,
      title: details.title,
    };
  }

  const details = await refreshSeries(item.tmdbId);
  const resume = calculateResumeEpisode(
    details.seasons,
    item.resumeSeasonNumber,
    item.resumeEpisodeNumber,
  );
  return {
    ...item,
    backdropUrl: details.backdropUrl,
    numberOfEpisodes: details.numberOfEpisodes,
    posterUrl: details.posterUrl,
    resumeEpisodeNumber: resume?.episodeNumber ?? null,
    resumeSeasonNumber: resume?.seasonNumber ?? null,
    title: details.title,
  };
}

function mergeHydratedItem(item: LibraryMediaItem, previous: LibraryMediaItem) {
  if (previous.key !== item.key) return item;

  return {
    ...item,
    backdropUrl: item.backdropUrl ?? previous.backdropUrl,
    numberOfEpisodes: item.numberOfEpisodes ?? previous.numberOfEpisodes,
    posterUrl: item.posterUrl ?? previous.posterUrl,
    title: isCataloguePlaceholderTitle(item.title) ? previous.title : item.title,
  };
}
