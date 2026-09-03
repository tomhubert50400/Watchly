// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import type { EpisodeProgress } from '../api/progress';
import {
  applyEpisodeMutation,
  applyEpisodeWatchedThroughMutation,
  createEpisodeKey,
  createWatchedEpisodeState,
  getNextEpisode,
  getScopedWatchedEpisodeState,
  getSeasonProgressFraction,
  getWatchedEpisodeRestorationPlan,
  isEpisodeWatched,
  rollbackEpisodeMutation,
} from './episodeModel';

const watchedAt = '2026-07-10T10:00:00.000Z';
const progress = (seasonNumber: number, episodeNumber: number): EpisodeProgress => ({
  episodeNumber,
  id: `progress-${seasonNumber}-${episodeNumber}`,
  seasonNumber,
  seriesTmdbId: 1399,
  updatedAt: watchedAt,
  watchedAt,
});
const episodes = [1, 2, 3].map((episodeNumber) => ({ episodeNumber, seasonNumber: 1 }));

const initial = createWatchedEpisodeState([progress(1, 1), progress(2, 1)]);
assert.equal(isEpisodeWatched(initial, 1, 1), true, 'watched state includes the exact season episode');
assert.equal(isEpisodeWatched(initial, 1, 2), false, 'watched state does not bleed across episodes');
assert.equal(isEpisodeWatched(initial, 1, 1), true, 'watched state is stable');
assert.equal(Object.keys(initial).length, 2, 'same episode number in another season remains distinct');

assert.deepEqual(getNextEpisode(episodes, initial), episodes[1], 'next episode is the first unwatched episode');
assert.equal(
  getNextEpisode(episodes, createWatchedEpisodeState(episodes.map((item) => progress(item.seasonNumber, item.episodeNumber)))),
  null,
  'a completed season has no next episode',
);

assert.deepEqual(getSeasonProgressFraction(episodes, initial), {
  completed: 1,
  fraction: 1 / 3,
  total: 3,
});
assert.deepEqual(getSeasonProgressFraction([], initial), { completed: 0, fraction: 0, total: 0 });

const mark = applyEpisodeMutation(initial, {
  episodeNumber: 2,
  now: watchedAt,
  seasonNumber: 1,
  seriesTmdbId: 1399,
  watched: true,
});
assert.equal(isEpisodeWatched(mark.state, 1, 2), true, 'mark is optimistic');
assert.equal(mark.intent.action, 'mark');
assert.equal(mark.intent.undoAction, 'unmark', 'mark creates an inverse undo intent');
assert.equal(mark.intent.previouslyWatched, false);
assert.equal(isEpisodeWatched(rollbackEpisodeMutation(mark.state, mark.intent), 1, 2), false, 'mark rollback restores previous state');

const watchedThrough = applyEpisodeWatchedThroughMutation(initial, {
  episodeNumber: 3,
  now: watchedAt,
  seasonNumber: 1,
  seriesTmdbId: 1399,
});
assert.equal(isEpisodeWatched(watchedThrough, 1, 1), true, 'watched-through keeps existing progress');
assert.equal(isEpisodeWatched(watchedThrough, 1, 2), true, 'watched-through fills the first gap');
assert.equal(isEpisodeWatched(watchedThrough, 1, 3), true, 'watched-through includes the target episode');
assert.deepEqual(
  getWatchedEpisodeRestorationPlan(watchedThrough, initial),
  { markEpisodeNumbers: [], unmarkEpisodeNumbers: [2, 3] },
  'restoration identifies only progress added by the watched-through mutation',
);

const unmark = applyEpisodeMutation(initial, {
  episodeNumber: 1,
  now: watchedAt,
  seasonNumber: 1,
  seriesTmdbId: 1399,
  watched: false,
});
assert.equal(isEpisodeWatched(unmark.state, 1, 1), false, 'unmark is optimistic');
assert.equal(unmark.intent.action, 'unmark');
assert.equal(unmark.intent.undoAction, 'mark', 'unmark creates an inverse undo intent');
assert.equal(unmark.intent.previouslyWatched, true);
const restored = rollbackEpisodeMutation(unmark.state, unmark.intent);
assert.equal(isEpisodeWatched(restored, 1, 1), true, 'unmark rollback restores previous state');
assert.deepEqual(restored[createEpisodeKey(1, 1)], initial[createEpisodeKey(1, 1)]);

assert.deepEqual(
  getScopedWatchedEpisodeState('watchly:user:a:progress', 'watchly:user:b:progress', initial),
  {},
  'private progress from another cache owner is never exposed',
);
assert.equal(
  getScopedWatchedEpisodeState('watchly:user:a:progress', 'watchly:user:a:progress', initial),
  initial,
  'private progress remains visible to its cache owner',
);

console.log('Episode model QA passed.');
