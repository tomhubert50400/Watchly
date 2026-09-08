import assert from 'node:assert/strict';
import type { CatalogueRelatedItem, SeasonDetails, SeriesDetails } from '../api/catalogue';
import { findNextSeriesEpisode, getNextCollectionMovie } from './whatsNextModel';

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
  await assert.rejects(findNextSeriesEpisode(seasons, [], async () => { throw new Error('offline'); }, today), /offline/);
  console.log("What's next model QA passed.");
}
void main();
