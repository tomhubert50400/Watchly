import { getWatchlistCoverItems } from './watchlistCover';
import { getSharedWatchlist } from '../api/sharedWatchlists';
import { getWatchlist, WatchlistContentType } from '../api/watchlists';
import { loadProgressively } from './requestBoundaries';
import { HOME_WATCHLIST_ITEM_LIMIT } from './watchlistHomeModel';

type PreviewList = {
  id: string;
  kind: 'personal' | 'shared';
};

type PreviewItem = {
  contentType: WatchlistContentType;
  tmdbId: number;
};

export async function loadWatchlistPreviewUrls({
  fallback,
  includeHomeItems = false,
  list,
  loadArtwork,
  token,
}: {
  fallback: Array<string | null>;
  includeHomeItems?: boolean;
  list: PreviewList;
  loadArtwork: (item: PreviewItem, index: number) => Promise<string | null>;
  token: string;
}) {
  try {
    const details = list.kind === 'personal'
      ? await getWatchlist(token, list.id)
      : await getSharedWatchlist(token, list.id);
    const coverItems = getWatchlistCoverItems<PreviewItem & { id: string }>(details.items, details.coverItemIds);
    const items = includeHomeItems
      ? [...coverItems, ...details.items.filter((item) => !coverItems.some((cover) => cover.id === item.id))].slice(0, HOME_WATCHLIST_ITEM_LIMIT)
      : coverItems;
    const urls: Array<string | null> = [];
    await loadProgressively({
      concurrency: 4,
      items,
      load: async (item, index) => {
        try {
          return await loadArtwork(item, index);
        } catch {
          return null;
        }
      },
      onLoaded: (url, _item, index) => { urls[index] = url; },
    });

    return urls.slice(0, coverItems.length);
  } catch {
    return fallback;
  }
}
