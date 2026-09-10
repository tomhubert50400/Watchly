import assert from 'node:assert/strict';
import type { CatalogueRelatedItem, SeasonDetails, SeriesDetails } from '../api/catalogue';
import { findNextSeriesEpisode, getMovieCycleWatchedIds, getNextCollectionMovie, getSeriesRewatchAnchor } from './whatsNextModel';

const today = '2026-09-08';
const movie = (tmdbId: number, releaseDate: string | null): CatalogueRelatedItem => ({
  tmdbId, releaseDate, title: `Film ${tmdbId}`, posterUrl: null, mediaType: 'movie',
});
const films = [movie(3, '2023-01-01'), movie(1, '2021-01-01'), movie(2, '2022-01-01'),
  movie(4, '2027-01-01'), movie(5, null), movie(6, ''), movie(3, '2023-01-01')];
assert.equal(getNextCollectionMovie(films, 1, new Set(), today)?.tmdbId, 2);
assert.equal(getNextCollectionMovie(films, 1, new Set([2]), today)?.tmdbId, 3);
assert.equal(getNextCollectionMovie(films, 1, new Set([2, 3]), today), null);
assert.equal(getNextCollectionMovie(films, 3, new Set(), today), null);
assert.equal(getNextCollectionMovie(films, 999, new Set(), today), null);
assert.equal(getNextCollectionMovie(films, 4, new Set(), today), null);
assert.equal(films[0].tmdbId, 3, 'selection must not reorder the cached collection');

const originalViews = [1, 2, 3].map((tmdbId) => ({ tmdbId, viewCount: 1, latestLoggedAt: '2026-01-01T12:00:00.000Z' }));
const rewatchedFirst = { tmdbId: 1, viewCount: 2, latestLoggedAt: '2026-09-08T10:00:00.000Z' };
const allWatched = new Set([1, 2, 3]);
assert.equal(getNextCollectionMovie(films, 1, getMovieCycleWatchedIds(allWatched, originalViews[0], originalViews), today), null);
assert.equal(getNextCollectionMovie(films, 1, getMovieCycleWatchedIds(allWatched, rewatchedFirst, originalViews), today)?.tmdbId, 2,
  'rewatching the first film starts a new cycle without clearing old watched statuses');
const rewatchedSecond = { tmdbId: 2, viewCount: 2, latestLoggedAt: '2026-09-08T11:00:00.000Z' };
assert.equal(getNextCollectionMovie(films, 1, getMovieCycleWatchedIds(allWatched, rewatchedFirst, [...originalViews.filter((item) => item.tmdbId !== 2), rewatchedSecond]), today)?.tmdbId, 3,
  'logging the sequel later on the same day advances the cycle from the first film');
assert.equal(getNextCollectionMovie(films, 3, getMovieCycleWatchedIds(allWatched, { ...rewatchedFirst, tmdbId: 3 }, originalViews), today), null,
  'rewatching the last film never wraps to the first');
assert.deepEqual([...allWatched], [1, 2, 3]);

const season = (seasonNumber: number, airDate: string): SeriesDetails['seasons'][number] => ({
  seasonNumber, airDate, episodeCount: 2, id: String(seasonNumber), name: 'Season', posterUrl: null,
});
const seasons = [season(2, '2022-01-01'), season(0, '2020-01-01'), season(1, '2021-01-01'), season(3, '2027-01-01')];
const calls: number[] = [];
const loadSeason = async (seasonNumber: number) => {
  calls.push(seasonNumber);
  return { episodes: [
    { seasonNumber, episodeNumber: 2, airDate: seasonNumber === 2 ? '2027-01-01' : '2021-01-02' },
    { seasonNumber, episodeNumber: 1, airDate: '2021-01-01' },
  ] } as SeasonDetails;
};

async function main() {
  assert.deepEqual(await findNextSeriesEpisode(seasons, [], loadSeason, today), { seasonNumber: 1, episodeNumber: 1 });
  const watched = [{ seasonNumber: 1, episodeNumber: 1 }, { seasonNumber: 1, episodeNumber: 2 }];
  calls.length = 0;
  assert.deepEqual(await findNextSeriesEpisode(seasons, watched, loadSeason, today), { seasonNumber: 2, episodeNumber: 1 });
  assert.deepEqual(calls, [2], 'fully watched seasons should not trigger extra catalogue requests');
  assert.equal(await findNextSeriesEpisode(seasons, [...watched, { seasonNumber: 2, episodeNumber: 1 }], loadSeason, today), null);
  assert.deepEqual(await findNextSeriesEpisode(seasons, [{ seasonNumber: 1, episodeNumber: 2 }], loadSeason, today),
    { seasonNumber: 1, episodeNumber: 1 }, 'fill gaps instead of skipping unwatched episodes');
  assert.deepEqual(await findNextSeriesEpisode(seasons, [{ seasonNumber: 0, episodeNumber: 50 }], loadSeason, today),
    { seasonNumber: 1, episodeNumber: 1 }, 'specials must not advance the main series');
  assert.equal(await findNextSeriesEpisode([season(1, '2027-01-01')], [], loadSeason, today), null);
  const rewatchedEpisode = { seasonNumber: 1, episodeNumber: 1, viewCount: 2, latestLoggedAt: rewatchedFirst.latestLoggedAt };
  const anchor = getSeriesRewatchAnchor([rewatchedEpisode,
    { seasonNumber: 1, episodeNumber: 2, viewCount: 1, latestLoggedAt: originalViews[0].latestLoggedAt },
    { seasonNumber: 0, episodeNumber: 1, viewCount: 3, latestLoggedAt: rewatchedSecond.latestLoggedAt }]);
  assert.deepEqual(anchor, rewatchedEpisode, 'a special does not restart the main series');
  assert.deepEqual(await findNextSeriesEpisode(seasons, [rewatchedEpisode], loadSeason, today, anchor), { seasonNumber: 1, episodeNumber: 2 });
  const secondAnchor = getSeriesRewatchAnchor([rewatchedEpisode,
    { ...rewatchedEpisode, episodeNumber: 2, latestLoggedAt: rewatchedSecond.latestLoggedAt }]);
  assert.deepEqual(await findNextSeriesEpisode(seasons, [], loadSeason, today, secondAnchor), { seasonNumber: 2, episodeNumber: 1 },
    'rewatches continue across seasons without returning to earlier episodes');
  assert.equal(await findNextSeriesEpisode(seasons, [], loadSeason, today, { seasonNumber: 2, episodeNumber: 1 }), null,
    'rewatching the last released episode does not wrap or suggest future episodes');
  assert.equal(getSeriesRewatchAnchor([{ ...rewatchedEpisode, viewCount: 1 }]), null, 'removing the extra viewing restores the original cycle');
  await assert.rejects(findNextSeriesEpisode(seasons, [], async () => { throw new Error('offline'); }, today), /offline/);
  console.log("What's next model QA passed.");
}
void main();
