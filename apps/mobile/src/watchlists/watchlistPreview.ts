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
  loadArtwork: (item: PreviewItem) => Promise<string | null>;
  token: string;
}) {
  try {
    const details = list.kind === 'personal'
      ? await getWatchlist(token, list.id)
      : await getSharedWatchlist(token, list.id);
    const urls = await Promise.all(details.items.slice(0, 4).map(async (item) => {
      try {
        return await loadArtwork(item);
      } catch {
        return null;
      }
    }));

    return urls.length ? urls : fallback;
  } catch {
    return fallback;
  }
}
