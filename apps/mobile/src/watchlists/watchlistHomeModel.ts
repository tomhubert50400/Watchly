import type { LibraryListItem, WatchlistPreviewItem } from '../library/useLibraryData';

export type HomeWatchlistItem = WatchlistPreviewItem & { listId: string; listKind: 'personal' | 'shared'; listName: string };
export const HOME_WATCHLIST_ITEM_LIMIT = 12;

export function selectHomeWatchlistItems(lists: LibraryListItem[]): HomeWatchlistItem[] {
  const result: HomeWatchlistItem[] = [];
  const seen = new Set<string>();
  const ordered = lists.filter((list) => list.showOnHome !== false).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // Alternate lists so a single large list cannot occupy the whole rail.
  for (let index = 0; index < HOME_WATCHLIST_ITEM_LIMIT; index += 1) {
    for (const list of ordered) {
      const item = list.previewItems?.[index];
      if (!item || !item.posterUrl) continue;
      const key = `${item.contentType}:${item.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...item, listId: list.id, listKind: list.kind, listName: list.name });
      if (result.length === HOME_WATCHLIST_ITEM_LIMIT) return result;
    }
  }
  return result;
}
