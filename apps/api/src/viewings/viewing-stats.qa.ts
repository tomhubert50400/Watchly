import assert from 'node:assert/strict';
import { buildViewingStats, ViewingStatsEvent } from './viewing-stats';

const events: ViewingStatsEvent[] = [
  {
    artworkUrl: 'movie.jpg',
    contentType: 'MOVIE',
    episodeNumber: null,
    genres: ['Drama'],
    runtimeMinutes: 120,
    seasonNumber: null,
    subtitle: null,
    title: 'Past Lives',
    tmdbId: 1,
    watchedAt: new Date('2026-07-03T20:00:00.000Z'),
  },
  {
    artworkUrl: 'movie.jpg',
    contentType: 'MOVIE',
    episodeNumber: null,
    genres: ['Drama'],
    runtimeMinutes: 120,
    seasonNumber: null,
    subtitle: null,
    title: 'Past Lives',
    tmdbId: 1,
    watchedAt: new Date('2026-07-10T20:00:00.000Z'),
  },
  {
    artworkUrl: 'series.jpg',
    contentType: 'EPISODE',
    episodeNumber: 1,
    genres: ['Drama', 'Mystery'],
    runtimeMinutes: 50,
    seasonNumber: 1,
    subtitle: 'Pilot',
    title: 'Severance',
    tmdbId: 2,
    watchedAt: new Date('2026-07-11T20:00:00.000Z'),
  },
  {
    artworkUrl: 'series.jpg',
    contentType: 'EPISODE',
    episodeNumber: 2,
    genres: ['Drama', 'Mystery'],
    runtimeMinutes: null,
    seasonNumber: 1,
    subtitle: 'Half Loop',
    title: 'Severance',
    tmdbId: 2,
    watchedAt: null,
  },
];

const stats = buildViewingStats(events, [
  { scoreHalfSteps: 9 },
  { scoreHalfSteps: 9 },
  { scoreHalfSteps: 8 },
]);

assert.deepEqual(stats.summary, {
  episodeCount: 2,
  movieCount: 1,
  seriesCount: 1,
  totalViewCount: 4,
  watchMinutes: 290,
  watchTimeIsEstimated: true,
});
assert.equal(stats.more.rewatchCount, 1);
assert.equal(stats.more.favoriteWatchDay, 'Friday');
assert.equal(stats.more.averageRating, 4.3);
assert.equal(stats.more.mostUsedRating, 4.5);
assert.equal(stats.highlights[0]?.title, 'Past Lives');
assert.deepEqual(stats.taste[0], { count: 4, genre: 'Drama' });

console.log('Viewing stats QA passed.');
