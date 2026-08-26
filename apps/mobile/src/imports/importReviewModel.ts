import type { ImportMatch, ImportPreview, ImportPreviewItem } from '../api/imports';

export type ImportRetryTarget = {
  importId: string;
  itemIndex: number;
};

export type CombinedImportPreviewItem = ImportPreviewItem & {
  retryTargets: ImportRetryTarget[];
};

export type CombinedImportPreview = {
  items: CombinedImportPreviewItem[];
  onlyTvTime: boolean;
  summary: ImportPreview['summary'];
};

export type ImportReviewMatch = {
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  rating: number | null;
  title: string;
  tmdbId: number;
};

export type ImportSkippedTitle = {
  rating: number | null;
  retryTargets: ImportRetryTarget[];
  suggestion: ImportMatch | null;
  title: string;
  year: number | null;
};

export function getImportReviewMatches(items: ImportPreviewItem[]): ImportReviewMatch[] {
  const matches = new Map<string, ImportReviewMatch>();

  items.forEach((item) => {
    if (item.status !== 'ready' || !item.match) return;

    const key = `${item.match.contentType}:${item.match.tmdbId}`;
    const sourceRating = item.actions.sourceRating ?? item.actions.rating;
    const existing = matches.get(key);
    if (existing) {
      if (existing.rating === null && sourceRating !== null) {
        matches.set(key, { ...existing, rating: sourceRating });
      }
      return;
    }

    matches.set(key, {
      contentType: item.match.contentType,
      posterUrl: item.match.posterUrl,
      rating: sourceRating,
      title: item.match.title,
      tmdbId: item.match.tmdbId,
    });
  });

  return [...matches.values()];
}

export function getImportSkippedTitles(items: CombinedImportPreviewItem[]): ImportSkippedTitle[] {
  const skipped = new Map<string, ImportSkippedTitle>();

  items.forEach((item) => {
    if (item.status === 'ready') return;

    const title = item.sourceTitle.trim();
    const key = `${title.toLowerCase()}:${item.sourceYear ?? ''}`;
    const sourceRating = item.actions.sourceRating ?? item.actions.rating;
    const existing = skipped.get(key);
    if (existing) {
      skipped.set(key, {
        ...existing,
        rating: existing.rating ?? sourceRating,
        retryTargets: [...existing.retryTargets, ...item.retryTargets],
        suggestion: existing.suggestion ?? item.suggestion,
      });
    } else {
      skipped.set(key, {
        rating: sourceRating,
        retryTargets: item.retryTargets,
        suggestion: item.suggestion,
        title,
        year: item.sourceYear,
      });
    }
  });

  return [...skipped.values()];
}

export function combineImportPreviews(previews: ImportPreview[]): CombinedImportPreview {
  const items = new Map<string, CombinedImportPreviewItem>();

  previews.forEach((preview) => {
    preview.items.forEach((item) => {
      const key = getPreviewItemKey(item);
      const existing = items.get(key);
      const combinedItem: CombinedImportPreviewItem = {
        ...item,
        retryTargets: item.suggestion
          ? [{ importId: item.importId || preview.importId, itemIndex: item.itemIndex }]
          : [],
      };
      items.set(key, existing ? mergePreviewItems(existing, combinedItem) : combinedItem);
    });
  });

  const combinedItems = [...items.values()];
  const readyItems = combinedItems.filter(
    (item): item is CombinedImportPreviewItem & { match: NonNullable<ImportPreviewItem['match']> } =>
      item.status === 'ready' && item.match !== null,
  );

  return {
    items: combinedItems,
    onlyTvTime: previews.length > 0 && previews.every((preview) => preview.source === 'tv-time'),
    summary: {
      favorites: readyItems.filter((item) => item.actions.favorite).length,
      needsAttention: combinedItems.length - readyItems.length,
      ratings: readyItems.filter(
        (item) => item.match.contentType === 'movie' && item.actions.rating !== null,
      ).length,
      ready: readyItems.length,
      reviews: readyItems.filter(
        (item) => item.match.contentType === 'movie' && item.actions.hasReview,
      ).length,
      total: combinedItems.length,
      watched: readyItems.filter((item) => item.actions.watched).length,
      watching: readyItems.filter((item) => item.actions.watching).length,
      watchlisted: readyItems.filter((item) => item.actions.watchlisted).length,
    },
  };
}

function getPreviewItemKey(item: ImportPreviewItem) {
  if (item.status === 'ready' && item.match) {
    return `${item.match.contentType}:${item.match.tmdbId}`;
  }

  return `skipped:${item.sourceTitle.trim().toLowerCase()}:${item.sourceYear ?? ''}`;
}

function mergePreviewItems(
  existing: CombinedImportPreviewItem,
  incoming: CombinedImportPreviewItem,
): CombinedImportPreviewItem {
  return {
    ...existing,
    actions: {
      favorite: existing.actions.favorite || incoming.actions.favorite,
      hasReview: existing.actions.hasReview || incoming.actions.hasReview,
      rating: existing.actions.rating ?? incoming.actions.rating,
      sourceRating: existing.actions.sourceRating ?? incoming.actions.sourceRating,
      viewingCount: Math.max(existing.actions.viewingCount, incoming.actions.viewingCount),
      watched: existing.actions.watched || incoming.actions.watched,
      watching: existing.actions.watching || incoming.actions.watching,
      watchlisted: existing.actions.watchlisted || incoming.actions.watchlisted,
    },
    issues: [...new Set([...existing.issues, ...incoming.issues])],
    retryTargets: [...existing.retryTargets, ...incoming.retryTargets],
    suggestion: existing.suggestion ?? incoming.suggestion,
  };
}
