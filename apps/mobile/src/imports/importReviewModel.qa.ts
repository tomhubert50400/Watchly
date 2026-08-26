import assert from 'node:assert/strict';
import type { ImportPreview, ImportPreviewItem, SupportedImportSource } from '../api/imports';
import {
  combineImportPreviews,
  getImportReviewMatches,
  getImportSkippedTitles,
} from './importReviewModel';

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
assert.deepEqual(
  getImportSkippedTitles([
    unmatched,
    { ...unmatched },
    { ...unmatched, sourceYear: 2024 },
    heat,
  ]),
  [
    { title: 'Unknown', year: null },
    { title: 'Unknown', year: 2024 },
  ],
);

const duplicateHeat = {
  ...heat,
  actions: {
    ...heat.actions,
    hasReview: true,
    watched: true,
  },
};
const alien = createItem({
  contentType: 'movie',
  rating: 4,
  title: 'Alien',
  tmdbId: 348,
});
const combined = combineImportPreviews([
  createPreview('letterboxd', 'letterboxd-preview', [heat, breakingBad, unmatched]),
  createPreview('imdb', 'imdb-preview', [duplicateHeat, alien, unmatched]),
]);

assert.equal(combined.items.length, 4, 'Titles shared by several platforms must appear once.');
assert.equal(combined.onlyTvTime, false);
assert.deepEqual(combined.summary, {
  favorites: 0,
  needsAttention: 1,
  ratings: 2,
  ready: 3,
  reviews: 1,
  total: 4,
  watched: 1,
  watching: 0,
  watchlisted: 3,
});
assert.equal(
  combined.items.find((item) => item.match?.tmdbId === 949)?.actions.hasReview,
  true,
  'Actions from duplicate matches must be merged into the shared preview item.',
);
assert.equal(
  combineImportPreviews([createPreview('tv-time', 'tv-time-preview', [breakingBad])]).onlyTvTime,
  true,
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

function createPreview(
  source: SupportedImportSource,
  importId: string,
  items: ImportPreviewItem[],
): ImportPreview {
  return {
    fileName: `${importId}.zip`,
    ignoredFileCount: 0,
    importId,
    items,
    source,
    summary: {
      favorites: 0,
      needsAttention: 0,
      ratings: 0,
      ready: 0,
      reviews: 0,
      total: 0,
      watched: 0,
      watching: 0,
      watchlisted: 0,
    },
  };
}
