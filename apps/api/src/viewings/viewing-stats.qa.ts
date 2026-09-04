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

const stats = buildViewingStats(
  events,
  [
    { scoreHalfSteps: 9 },
    { scoreHalfSteps: 9 },
    { scoreHalfSteps: 8 },
  ],
  [
    {
      artworkUrl: 'arrival.jpg',
      contentType: 'MOVIE',
      genres: ['Drama', 'Science Fiction'],
      runtimeMinutes: 108,
      title: 'Arrival',
      tmdbId: 3,
    },
    {
      artworkUrl: 'dark.jpg',
      contentType: 'SERIES',
      genres: ['Drama', 'Mystery'],
      runtimeMinutes: null,
      title: 'Dark',
      tmdbId: 4,
    },
    {
      artworkUrl: 'duplicate.jpg',
      contentType: 'MOVIE',
      genres: ['Drama'],
      runtimeMinutes: 120,
      title: 'Past Lives',
      tmdbId: 1,
    },
  ],
);

assert.deepEqual(stats.summary, {
  episodeCount: 2,
  movieCount: 2,
  seriesCount: 2,
  totalViewCount: 6,
  watchMinutes: 398,
  watchTimeIsEstimated: true,
});
assert.equal(stats.more.rewatchCount, 1);
assert.equal(stats.more.favoriteWatchDay, 'Friday');
assert.equal(stats.more.averageRating, 4.3);
assert.equal(stats.more.mostUsedRating, 4.5);
assert.equal(stats.highlights[0]?.title, 'Past Lives');
assert.equal(stats.highlights.filter((item) => item.tmdbId === 1).length, 1);
assert.deepEqual(stats.taste[0], { count: 6, genre: 'Drama' });

console.log('Viewing stats QA passed.');
