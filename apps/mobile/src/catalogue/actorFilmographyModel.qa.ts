// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import type { CatalogueSearchItem } from '../api/catalogue';
import { filterActorFilmography } from './actorFilmographyModel';

const credits: CatalogueSearchItem[] = [
  { id: 'movie:1', tmdbId: 1, mediaType: 'movie', title: 'Popular film', releaseDate: '1999-10-01', voteAverage: 8, overview: '', posterUrl: null },
  { id: 'series:1', tmdbId: 1, mediaType: 'series', title: 'Recent series', releaseDate: '2025-01-01', voteAverage: 7, overview: '', posterUrl: null },
  { id: 'movie:2', tmdbId: 2, mediaType: 'movie', title: 'Highly rated film', releaseDate: '2020-01-01', voteAverage: 9, overview: '', posterUrl: null },
  { id: 'movie:3', tmdbId: 3, mediaType: 'movie', title: 'Undated film', releaseDate: null, voteAverage: null, overview: '', posterUrl: null },
];
const original = JSON.stringify(credits);
const ids = (items: CatalogueSearchItem[]) => items.map(item => item.id);
assert.deepEqual(ids(filterActorFilmography(credits, 'all', 'latest')), ['series:1', 'movie:2', 'movie:1', 'movie:3']);
assert.deepEqual(ids(filterActorFilmography(credits, 'movie', 'rating')), ['movie:2', 'movie:1', 'movie:3']);
assert.deepEqual(ids(filterActorFilmography(credits, 'series', 'latest')), ['series:1']);
assert.deepEqual(ids(filterActorFilmography(credits, 'all', 'popular')), ids(credits), 'returning to popularity restores server order');
assert.equal(JSON.stringify(credits), original, 'sorting must preserve the cached filmography');
assert.deepEqual(filterActorFilmography(credits.filter(item => item.mediaType === 'movie'), 'series', 'popular'), []);
assert.deepEqual(filterActorFilmography([], 'all', 'rating'), []);
console.log('Actor filmography sorting and filtering QA passed.');
