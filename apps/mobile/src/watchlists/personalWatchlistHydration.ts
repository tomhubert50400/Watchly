import type { PersonalWatchlistItem } from '../api/watchlists';
import { loadProgressively } from './requestBoundaries';

type WatchlistArtwork = {
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
};

export type HydratedPersonalWatchlistItem = PersonalWatchlistItem & WatchlistArtwork;

export const hydratePersonalWatchlistItems = hydrateWatchlistItems<PersonalWatchlistItem>;

export async function hydrateWatchlistItems<T extends { id: string; contentType: 'movie' | 'series'; tmdbId: number }>({
  items,
  previousItems = [],
  backgroundItemId,
  load,
  isCurrent,
  onProgress,
}: {
  items: T[];
  previousItems?: (T & Omit<WatchlistArtwork, 'title'> & { title: string | null })[];
  backgroundItemId?: string | null;
  load: (item: T) => Promise<WatchlistArtwork>;
  isCurrent: () => boolean;
  onProgress: (items: (T & WatchlistArtwork)[]) => void;
}) {
  const previousByMedia = new Map(previousItems.map((item) => [`${item.contentType}:${item.tmdbId}`, item]));
  const hydratedItems = items.map((item): T & WatchlistArtwork => {
    const previous = previousByMedia.get(`${item.contentType}:${item.tmdbId}`);
    return {
      ...item,
      backdropUrl: previous?.backdropUrl ?? null,
      posterUrl: previous?.posterUrl ?? null,
      title: previous?.title && !needsHydration(previous) ? previous.title : 'Loading title',
    };
  });
  const pending = hydratedItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => needsHydration(item))
    .sort((a, b) => Number(b.item.id === backgroundItemId) - Number(a.item.id === backgroundItemId));

  if (isCurrent()) onProgress([...hydratedItems]);
  await loadProgressively({
    concurrency: 3,
    items: pending,
    isCurrent,
    load: async ({ item }) => {
      try {
        const artwork = await load(item);
        return { ...item, backdropUrl: artwork.backdropUrl, posterUrl: artwork.posterUrl, title: artwork.title };
      } catch {
        return { ...item, title: 'Title unavailable' };
      }
    },
    onLoaded: (loaded, { index }) => {
      hydratedItems[index] = loaded;
      onProgress([...hydratedItems]);
    },
  });
  return hydratedItems;
}

function needsHydration(item: { title: string | null }) {
  return !item.title || item.title === 'Loading title' || item.title === 'Title unavailable' || /^TMDB \d+$/.test(item.title);
}
