// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  filterReleaseCalendarItems,
  filterReleaseCalendarItemsByDate,
  getInitialReleaseMonthKey,
  getReleaseMonthItems,
  getReleaseMonthKeys,
  type ReleaseCalendarItem,
} from './releaseCalendarModel';

const items: ReleaseCalendarItem[] = [
  {
    contentType: 'movie', episodeNumber: null, id: 'movie', precision: 'date',
    releaseDate: '2026-08-20', seasonNumber: null, title: 'Film', tmdbId: 10,
    type: 'movie_release',
  },
  {
    contentType: 'series', episodeNumber: 1, id: 'episode', precision: 'date',
    releaseDate: '2026-09-02', seasonNumber: 2, title: 'Series episode', tmdbId: 20,
    type: 'episode_release',
  },
  {
    contentType: 'series', episodeNumber: null, id: 'unknown', precision: 'unknown',
    releaseDate: null, seasonNumber: 3, title: 'Series season', tmdbId: 20,
    type: 'season_release',
  },
];

assert.deepEqual(getReleaseMonthKeys(items), ['2026-08', '2026-09']);
assert.equal(getInitialReleaseMonthKey(items), '2026-08');
assert.deepEqual(getReleaseMonthItems(items, '2026-09').map((item) => item.id), ['episode']);
assert.deepEqual(filterReleaseCalendarItemsByDate(items, '2026-08-20').map((item) => item.id), ['movie']);
assert.deepEqual(filterReleaseCalendarItems(items, 'movies').map((item) => item.id), ['movie']);
assert.deepEqual(filterReleaseCalendarItems(items, 'series').map((item) => item.id), ['episode', 'unknown']);
assert.deepEqual(filterReleaseCalendarItems(items, 'all'), items);

console.log('Release calendar model QA passed.');
