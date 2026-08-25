import type { ImportPreviewItem } from '../api/imports';

export type ImportReviewMatch = {
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  rating: number | null;
  title: string;
  tmdbId: number;
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
