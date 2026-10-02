// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { filterWatchlistItems } from './watchlistFiltersModel';

const items = Array.from({ length: 500 }, (_, index) => ({
  id: `item-${index}`,
  contentType: index % 2 === 0 ? 'movie' as const : 'series' as const,
  tmdbId: Math.floor(index / 2) + 1,
  sectionId: index < 250 ? 'first' : 'second',
}));
const original = JSON.stringify(items);
const genresByKey = Object.fromEntries(items.map((item, index) => [
  `${item.contentType}:${item.tmdbId}`,
  index % 3 === 0 ? ['Drama', 'Comedy'] : ['Action'],
]));

assert.deepEqual(filterWatchlistItems(items, 'all', null, {}), items);
assert.equal(filterWatchlistItems(items, 'movie', null, {}).length, 250);
assert.equal(filterWatchlistItems(items, 'series', null, {}).length, 250);
const dramas = filterWatchlistItems(items, 'all', 'Drama', genresByKey);
assert.equal(dramas.length, 167);
assert.equal(dramas.at(-1)?.id, 'item-498', 'genre filters must include matches at the end of a large list');
const seriesDramas = filterWatchlistItems(items, 'series', 'Drama', genresByKey);
assert(seriesDramas.every((item) => item.contentType === 'series'));
assert.equal(seriesDramas[0].id, 'item-3', 'movie and series with the same TMDB id must keep separate genres');
assert.equal(seriesDramas.at(-1)?.sectionId, 'second', 'filtering must preserve section membership');
assert.deepEqual(filterWatchlistItems(items, 'all', 'Drama', {}), [], 'unknown genres must not be mistaken for matches');
assert.deepEqual(filterWatchlistItems(items, 'all', 'Western', genresByKey), []);
assert.equal(JSON.stringify(items), original, 'filtering must never change membership or source ordering');
assert.deepEqual(filterWatchlistItems(items, 'all', null, genresByKey), items, 'clearing filters must restore the whole list');
console.log('Watchlist filters QA passed: type and genre combinations, 500 titles, media identity, sections and clear.');
