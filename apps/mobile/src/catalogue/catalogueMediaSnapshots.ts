import type { MovieDetails } from '../api/catalogue';

export type CatalogueSnapshotItem = { contentType: 'movie' | 'series'; tmdbId: number };
export type CatalogueArtworkSnapshot = Pick<MovieDetails, 'title' | 'posterUrl'>;
export type CatalogueMediaSnapshot = CatalogueArtworkSnapshot & Pick<MovieDetails, 'genres'>;
type Snapshot = CatalogueArtworkSnapshot & { genres?: string[] };
export type CatalogueSnapshots<T extends Snapshot> = { scope: string; items: ReadonlyMap<string, T> };
export type CatalogueSnapshotDataset = { scope: string; items: readonly CatalogueSnapshotItem[] };

export function catalogueSnapshotKey(item: CatalogueSnapshotItem) {
  return `${item.contentType}:${item.tmdbId}`;
}

export function catalogueArtworkSnapshot(item: CatalogueArtworkSnapshot): CatalogueArtworkSnapshot {
  return { title: item.title, posterUrl: item.posterUrl };
}

export function catalogueMediaSnapshot(item: CatalogueMediaSnapshot): CatalogueMediaSnapshot {
  return { ...catalogueArtworkSnapshot(item), genres: [...item.genres] };
}

export function isCurrentCatalogueSnapshotDataset(
  current: CatalogueSnapshotDataset,
  scope: string,
  items: readonly CatalogueSnapshotItem[],
) {
  return current.scope === scope && current.items === items;
}

// These small snapshots belong to the screen's current dataset, not the session
// detail cache. Removed rows and changed owners/sessions release their metadata.
export function retainCatalogueSnapshots<T extends Snapshot>(
  current: CatalogueSnapshots<T>,
  scope: string,
  items: readonly CatalogueSnapshotItem[],
  updates: readonly (readonly [CatalogueSnapshotItem, T])[] = [],
): CatalogueSnapshots<T> {
  const updated = new Map(updates.map(([item, snapshot]) => [catalogueSnapshotKey(item), snapshot]));
  const next = new Map<string, T>();
  for (const item of items) {
    const key = catalogueSnapshotKey(item);
    const previous = current.scope === scope ? current.items.get(key) : undefined;
    const candidate = updated.get(key) ?? previous;
    if (!candidate) continue;
    const unchanged = previous && previous.title === candidate.title && previous.posterUrl === candidate.posterUrl
      && previous.genres?.length === candidate.genres?.length
      && (previous.genres?.every((genre, index) => genre === candidate.genres?.[index]) ?? true);
    next.set(key, unchanged ? previous : candidate);
  }
  if (current.scope === scope && next.size === current.items.size
    && [...next].every(([key, value]) => current.items.get(key) === value)) return current;
  return { scope, items: next };
}
