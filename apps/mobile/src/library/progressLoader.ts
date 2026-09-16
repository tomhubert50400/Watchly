import { canResumeProgress, type ProgressItem } from './progressModel';
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
  maxRecentItems?: number;
  isCurrent: () => boolean;
  load: (source: LibraryMediaItem) => Promise<ProgressItem>;
  onItem: (item: ProgressItem, startedAt: number) => void;
}) {
  let cursor = 0;
  let recentCount = 0;
  await Promise.all(Array.from({ length: Math.min(2, sources.length) }, async () => {
    while (options.isCurrent() && cursor < sources.length && recentCount < (options.maxRecentItems ?? Infinity)) {
      const source = sources[cursor++]!;
      if (options.onlyKey && source.key !== options.onlyKey) continue;
      const cached = options.cached(source.key);
      if (!options.force && canReuseProgress(cached, source)) {
        if (canResumeProgress(cached!.item)) recentCount++;
        continue;
      }
      const startedAt = Date.now();
      const item = await options.load(source);
      if (canResumeProgress(item)) recentCount++;
      if (options.isCurrent()) options.onItem(item, startedAt);
    }
  }));
}
