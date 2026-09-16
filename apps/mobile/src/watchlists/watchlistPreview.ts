import { getWatchlistCoverItems } from './watchlistCover';
import { getSharedWatchlist } from '../api/sharedWatchlists';
import { getWatchlist, WatchlistContentType } from '../api/watchlists';

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
  list,
  loadArtwork,
  token,
}: {
  fallback: Array<string | null>;
  list: PreviewList;
  loadArtwork: (item: PreviewItem, index: number, customCover: boolean) => Promise<string | null>;
  token: string;
}) {
  try {
    const details = list.kind === 'personal'
      ? await getWatchlist(token, list.id)
      : await getSharedWatchlist(token, list.id);
    const urls = await Promise.all(getWatchlistCoverItems<PreviewItem & { id: string }>(details.items, details.coverItemIds).map(async (item, index) => {
      try {
        return await loadArtwork(item, index, Boolean(details.coverItemIds?.length));
      } catch {
        return null;
      }
    }));

    return urls;
  } catch {
    return fallback;
  }
}
