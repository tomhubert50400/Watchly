type ArtworkSelection = { coverItemIds: string[]; backgroundItemId: string | null };

export async function saveWatchlistArtwork({ selected, saved, isCurrent, saveCover, saveBackground, onSaved }: {
  selected: ArtworkSelection;
  saved: ArtworkSelection;
  isCurrent: () => boolean;
  saveCover: (ids: string[]) => Promise<{ coverItemIds: string[] }>;
  saveBackground: (id: string | null) => Promise<{ backgroundItemId: string | null }>;
  onSaved: (change: Partial<ArtworkSelection>) => void;
}) {
  if (!isCurrent()) return;
  if (selected.coverItemIds.length !== saved.coverItemIds.length
    || selected.coverItemIds.some((id, index) => id !== saved.coverItemIds[index])) {
    const result = await saveCover(selected.coverItemIds);
    if (!isCurrent()) return;
    saved.coverItemIds = result.coverItemIds;
    onSaved(result);
  }
  if (!isCurrent()) return;
  if (selected.backgroundItemId !== saved.backgroundItemId) {
    const result = await saveBackground(selected.backgroundItemId);
    if (!isCurrent()) return;
    saved.backgroundItemId = result.backgroundItemId;
    onSaved(result);
  }
}
