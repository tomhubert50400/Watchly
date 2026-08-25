import assert from 'node:assert/strict';
import type { ImportPreviewItem } from '../api/imports';
import { getImportReviewMatches } from './importReviewModel';

const heat = createItem({
  contentType: 'movie',
  rating: 4.5,
  title: 'Heat',
  tmdbId: 949,
});
const breakingBad = createItem({
  contentType: 'series',
  rating: 5,
  title: 'Breaking Bad',
  tmdbId: 1396,
});
const unmatched = createItem({
  contentType: 'movie',
  rating: null,
  status: 'unmatched',
  title: 'Unknown',
  tmdbId: 0,
});

assert.deepEqual(
  getImportReviewMatches([heat, { ...heat, actions: { ...heat.actions, sourceRating: null } }, breakingBad, unmatched]),
  [
    {
      contentType: 'movie',
      posterUrl: 'https://image.test/949.jpg',
      rating: 4.5,
      title: 'Heat',
      tmdbId: 949,
    },
    {
      contentType: 'series',
      posterUrl: 'https://image.test/1396.jpg',
      rating: 5,
      title: 'Breaking Bad',
      tmdbId: 1396,
    },
  ],
);

console.log('Import review model QA passed.');

function createItem({
  contentType,
  rating,
  status = 'ready',
  title,
  tmdbId,
}: {
  contentType: 'movie' | 'series';
  rating: number | null;
  status?: ImportPreviewItem['status'];
  title: string;
  tmdbId: number;
}): ImportPreviewItem {
  return {
    actions: {
      favorite: false,
      hasReview: false,
      rating: contentType === 'movie' ? rating : null,
      sourceRating: rating,
      viewingCount: 0,
      watched: false,
      watching: false,
      watchlisted: true,
    },
    issues: [],
    match: status === 'ready' ? {
      contentType,
      posterUrl: `https://image.test/${tmdbId}.jpg`,
      releaseDate: null,
      title,
      tmdbId,
    } : null,
    sourceTitle: title,
    sourceYear: null,
    status,
  };
}
