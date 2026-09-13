import type { LibraryListItem, WatchlistPreviewItem } from '../library/useLibraryData';

export type HomeWatchlistItem = WatchlistPreviewItem & { listId: string; listKind: 'personal' | 'shared'; listName: string };

export function selectHomeWatchlistItems(lists: LibraryListItem[]): HomeWatchlistItem[] {
  const result: HomeWatchlistItem[] = [];
  const seen = new Set<string>();
  const ordered = [...lists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // Alternate lists so a single large list cannot occupy the whole rail.
  for (let index = 0; index < 4; index += 1) {
    for (const list of ordered) {
      const item = list.previewItems?.[index];
      if (!item || !item.posterUrl) continue;
      const key = `${item.contentType}:${item.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...item, listId: list.id, listKind: list.kind, listName: list.name });
      if (result.length === 6) return result;
    }
  }
  return result;
}
