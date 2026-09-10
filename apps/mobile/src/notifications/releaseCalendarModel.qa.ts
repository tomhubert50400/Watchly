// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  filterReleaseCalendarItems,
  getReleaseDaysRemaining,
  getReleaseDisplay,
  getUpcomingReleases,
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

assert.equal(getReleaseDaysRemaining(items[0]!, new Date(2026, 7, 19, 23, 59)), 1, 'Countdown must use calendar days, not elapsed hours');
assert.equal(getReleaseDaysRemaining(items[0]!, new Date(2026, 7, 20, 0, 1)), 0);
assert.equal(getReleaseDaysRemaining(items[0]!, new Date(2026, 7, 21)), -1);
assert.equal(getReleaseDaysRemaining(items[2]!, new Date()), null, 'Unknown dates must not invent a countdown');
assert.equal(getReleaseDaysRemaining({ ...items[0]!, precision: 'unknown' }, new Date()), null);
assert.equal(getReleaseDaysRemaining({ ...items[0]!, releaseDate: '2027-01-01' }, new Date(2026, 11, 31, 23)), 1);
assert.equal(getReleaseDaysRemaining({ ...items[0]!, releaseDate: '2026-03-09' }, new Date(2026, 2, 7, 23)), 2, 'DST must not change the calendar day count');
assert.deepEqual(getUpcomingReleases([items[2]!, items[1]!, items[0]!], new Date(2026, 7, 19)).map((item) => item.id), ['movie', 'episode', 'unknown']);
assert.deepEqual(getUpcomingReleases(items, new Date(2026, 7, 21)).map((item) => item.id), ['episode', 'unknown'], 'Cached past releases must disappear');
assert.equal(items[0]?.id, 'movie', 'Sorting must not mutate cached data');
assert.deepEqual(getReleaseDisplay({ ...items[1]!, title: 'Severance: S2E1 Hello, Ms. Cobel' }), {
  title: 'Severance', detail: 'S02 · E01', episodeName: 'Hello, Ms. Cobel',
});
assert.deepEqual(getReleaseDisplay({ ...items[2]!, title: 'Severance: Season 3' }), {
  title: 'Severance', detail: 'Season 3', episodeName: null,
});
assert.equal(getReleaseDisplay(items[0]!).title, 'Film');
assert.equal(getReleaseDisplay(items[1]!).episodeName, null, 'Do not invent a missing episode name');
assert.deepEqual(getUpcomingReleases([
  items[1]!, { ...items[2]!, seasonNumber: 2 },
], new Date(2026, 7, 19)).map((item) => item.id), ['episode'], 'Do not duplicate a season announcement when its episodes are listed');
assert.deepEqual(filterReleaseCalendarItems(items, 'movies').map((item) => item.id), ['movie']);
assert.deepEqual(filterReleaseCalendarItems(items, 'series').map((item) => item.id), ['episode', 'unknown']);
assert.deepEqual(filterReleaseCalendarItems(items, 'all'), items);

console.log('Release calendar model QA passed.');
