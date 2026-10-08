export function getWatchlistCoverItems<T extends { id: string }>(items: T[], coverItemIds: string[] = []): T[] {
  const selected = coverItemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => Boolean(item));
  return (selected.length ? selected : items).slice(0, 4);
}

export function toggleWatchlistCoverItem(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((itemId) => itemId !== id);
  return selected.length < 4 ? [...selected, id] : selected;
}

export function getWatchlistBackgroundItem<T extends { id: string; posterUrl?: string | null; backdropUrl?: string | null }>(items: T[], backgroundItemId?: string | null): T | undefined {
  const hasArtwork = (item: T) => Boolean(item.posterUrl || item.backdropUrl);
  return items.find(item => item.id === backgroundItemId && hasArtwork(item)) ?? items.find(hasArtwork);
}
