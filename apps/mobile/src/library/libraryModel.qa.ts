// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  buildLibrarySummary,
  calculateResumeEpisode,
  getLastWatchedLibraryItem,
  mapLibrarySourceErrors,
  mergeLibraryItems,
  shouldShowTrackedTitle,
} from './libraryModel';

const states = [
  { contentType: 'movie' as const, favorite: false, id: 'm', status: 'watched' as const, tmdbId: 1, updatedAt: '2026-07-08T00:00:00Z' },
  { contentType: 'series' as const, favorite: true, id: 's', status: 'watching' as const, tmdbId: 2, updatedAt: '2026-07-07T00:00:00Z' },
];
const merged = mergeLibraryItems(
  states,
  [{ id: 'r', score: 4.5, tmdbId: 1, updatedAt: '2026-07-09T00:00:00Z' }],
  [{ latestEpisodeNumber: 5, latestSeasonNumber: 1, seriesTmdbId: 2, updatedAt: '2026-07-10T00:00:00Z', watchedEpisodeCount: 5 }],
  [{ contentType: 'movie' as const, tmdbId: 3, updatedAt: '2026-07-06T00:00:00Z' }],
);
assert.deepEqual(merged.map((item) => item.key), ['series:2', 'movie:1', 'movie:3']);
assert.equal(merged[1]?.ratingScore, 4.5);
assert.equal(merged[2]?.hasReleaseAlert, true);
assert.equal(merged[0]?.lastWatchedAt, '2026-07-10T00:00:00Z');
assert.equal(merged[1]?.lastWatchedAt, '2026-07-08T00:00:00Z');
assert.equal(merged[2]?.lastWatchedAt, null);
assert.equal(getLastWatchedLibraryItem(merged)?.key, 'series:2');

assert.deepEqual(calculateResumeEpisode([{ episodeCount: 6, seasonNumber: 1 }, { episodeCount: 8, seasonNumber: 2 }], 1, 5), { episodeNumber: 6, seasonNumber: 1 });
assert.deepEqual(calculateResumeEpisode([{ episodeCount: 6, seasonNumber: 1 }, { episodeCount: 8, seasonNumber: 2 }], 1, 6), { episodeNumber: 1, seasonNumber: 2 });
assert.equal(calculateResumeEpisode([{ episodeCount: 6, seasonNumber: 1 }], 1, 6), null);

assert.equal(shouldShowTrackedTitle({ favorite: false, hasReleaseAlert: false, inferredWatchingFromProgress: true, resumeEpisodeNumber: null, resumeSeasonNumber: null, status: 'watching' }), false);
assert.equal(shouldShowTrackedTitle({ favorite: false, hasReleaseAlert: true, inferredWatchingFromProgress: false, resumeEpisodeNumber: null, resumeSeasonNumber: null, status: null }), true);
assert.equal(shouldShowTrackedTitle({ favorite: true, hasReleaseAlert: false, inferredWatchingFromProgress: false, resumeEpisodeNumber: null, resumeSeasonNumber: null, status: null }), true);

assert.deepEqual(buildLibrarySummary([
  { ratingScore: 4.5, watchedEpisodeCount: 5 },
  { ratingScore: 3.5, watchedEpisodeCount: 0 },
], 3), { averageRating: 4, listCount: 3, ratedTitleCount: 2, trackedTitleCount: 2, watchedEpisodeCount: 5 });
assert.equal(mapLibrarySourceErrors({ progress: new Error('offline'), ratings: null }), 'Some library data could not update: progress (offline).');
console.log('Library model QA passed.');
