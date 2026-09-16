import type { ProgressItem } from './progressModel';
import type { LibraryMediaItem } from './useLibraryData';

export type ProgressCacheEntry = { item: ProgressItem; savedAt: number };
const PROGRESS_FRESH_MS = 5 * 60 * 1000;

export function canReuseProgress(entry: ProgressCacheEntry | undefined, source: LibraryMediaItem, now = Date.now()) {
  return Boolean(entry && entry.item.remainingEpisodes && !entry.item.error && entry.item.media.updatedAt === source.updatedAt && now - entry.savedAt < PROGRESS_FRESH_MS);
}

export async function loadProgressEntries(sources: LibraryMediaItem[], options: {
  cached: (key: string) => ProgressCacheEntry | undefined;
  force: boolean;
  onlyKey?: string;
  isCurrent: () => boolean;
  load: (source: LibraryMediaItem) => Promise<ProgressItem>;
  onItem: (item: ProgressItem, startedAt: number) => void;
}) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(2, sources.length) }, async () => {
    while (options.isCurrent() && cursor < sources.length) {
      const source = sources[cursor++]!;
      if (options.onlyKey && source.key !== options.onlyKey) continue;
      if (!options.force && canReuseProgress(options.cached(source.key), source)) continue;
      const startedAt = Date.now();
      const item = await options.load(source);
      if (options.isCurrent()) options.onItem(item, startedAt);
    }
  }));
}
