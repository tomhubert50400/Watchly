// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { filterWatchlistItems, searchAndSortWatchlistItems } from './watchlistFiltersModel';

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

const titles = [
  { ...items[0], title: 'Été 10', createdAt: '2026-10-02T10:00:00Z' },
  { ...items[1], title: 'Alien', createdAt: '2026-10-03T10:00:00Z' },
  { ...items[2], title: 'Été 2', createdAt: '2026-10-01T10:00:00Z' },
  { ...items[3], title: null },
];
const unchanged = JSON.stringify(titles);
assert.deepEqual(searchAndSortWatchlistItems(titles, '  ETE ', 'title').map(item => item.title), ['Été 2', 'Été 10']);
assert.deepEqual(searchAndSortWatchlistItems(titles, '', 'newest').map(item => item.id), [items[1].id, items[0].id, items[2].id, items[3].id]);
assert.deepEqual(searchAndSortWatchlistItems(titles, '', 'oldest').map(item => item.id), [items[2].id, items[0].id, items[1].id, items[3].id]);
assert.deepEqual(searchAndSortWatchlistItems(titles, '', 'original'), titles);
assert.equal(searchAndSortWatchlistItems(filterWatchlistItems(titles, 'movie', null, {}), 'alien', 'title').length, 0);
assert.equal(JSON.stringify(titles), unchanged, 'search and sorting never mutate source order, ids or section membership');
console.log('Watchlist search/sort QA passed: accents, combined filters, numeric titles, dates, missing metadata and stable source order.');
