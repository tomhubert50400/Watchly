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
