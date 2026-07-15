// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import type { CatalogueSearchItem } from '../api/catalogue';
import {
  buildExploreSections,
  DEFAULT_EXPLORE_SEARCH_SORT,
  filterSearchResults,
  getExploreViewState,
  groupSearchResults,
  sortSearchResults,
} from './exploreState';

function item(
  tmdbId: number,
  mediaType: CatalogueSearchItem['mediaType'],
  title: string,
): CatalogueSearchItem {
  return {
    id: `${mediaType}-${tmdbId}-${title}`,
    mediaType,
    overview: '',
    posterUrl: null,
    releaseDate: '2026-07-15',
    title,
    tmdbId,
    voteAverage: 8,
  };
}

const duplicatedMovie = item(1, 'movie', 'First title wins');
const duplicateMovie = { ...item(1, 'movie', 'Duplicate'), id: 'different-api-id' };
const seriesWithSameTmdbId = item(1, 'series', 'Different media type');

assert.deepEqual(
  buildExploreSections({
    announced: [duplicatedMovie, duplicateMovie],
    trending: [duplicatedMovie, duplicateMovie, seriesWithSameTmdbId],
  }),
  {
    announced: [duplicatedMovie],
    trending: [duplicatedMovie, seriesWithSameTmdbId],
  },
  'section composition deduplicates by media type and TMDB id while preserving API order',
);

assert.deepEqual(
  groupSearchResults([seriesWithSameTmdbId, duplicatedMovie, duplicateMovie]),
  {
    movies: [duplicatedMovie],
    series: [seriesWithSameTmdbId],
  },
  'search results are deduplicated and grouped by real API media type',
);

const mixedSearchResults = [seriesWithSameTmdbId, duplicatedMovie];

assert.deepEqual(
  filterSearchResults(mixedSearchResults, 'all'),
  mixedSearchResults,
  'the all filter keeps films and series visible',
);
assert.deepEqual(
  filterSearchResults(mixedSearchResults, 'movie'),
  [duplicatedMovie],
  'the film filter only keeps films visible',
);
assert.deepEqual(
  filterSearchResults(mixedSearchResults, 'series'),
  [seriesWithSameTmdbId],
  'the series filter only keeps series visible',
);

const lowerRated = { ...item(2, 'movie', 'Lower rated'), voteAverage: 6 };
const highestRated = { ...item(3, 'movie', 'Highest rated'), voteAverage: 9 };
const equallyRated = { ...item(4, 'series', 'Equally rated'), voteAverage: 9 };
const unrated = { ...item(5, 'series', 'Unrated'), voteAverage: null };
const relevanceOrder = [lowerRated, highestRated, equallyRated, unrated];

assert.equal(
  DEFAULT_EXPLORE_SEARCH_SORT,
  'rating',
  'rating is the default search result order',
);
assert.deepEqual(
  sortSearchResults(relevanceOrder, 'rating'),
  [highestRated, equallyRated, lowerRated, unrated],
  'rating order puts the highest ratings first, keeps ties stable, and leaves unrated titles last',
);
assert.deepEqual(
  sortSearchResults(relevanceOrder, 'relevance'),
  relevanceOrder,
  'relevance order preserves the TMDB result order',
);

assert.deepEqual(
  getExploreViewState({ activeSection: 'trending', error: null, isLoading: true, itemCount: 0, query: '' }),
  {
    emptyBody: 'Fresh picks are on their way.',
    emptyTitle: 'No trending titles yet',
    errorTitle: 'Trending could not be updated',
    isSearching: false,
    loadingLabel: 'Loading trending',
    title: 'Trending now',
  },
);

assert.deepEqual(
  getExploreViewState({ activeSection: 'announced', error: null, isLoading: false, itemCount: 0, query: ' ' }),
  {
    emptyBody: 'New release dates will appear here as they are announced.',
    emptyTitle: 'No upcoming titles yet',
    errorTitle: 'Upcoming titles could not be updated',
    isSearching: false,
    loadingLabel: 'Loading upcoming titles',
    title: 'Coming soon',
  },
);

assert.deepEqual(
  getExploreViewState({ activeSection: 'trending', error: null, isLoading: true, itemCount: 0, query: ' dune ' }),
  {
    emptyBody: 'Try another film or series title.',
    emptyTitle: 'No results for “dune”',
    errorTitle: 'Search could not be completed',
    isSearching: true,
    loadingLabel: 'Searching for “dune”',
    title: 'Search results',
  },
);

assert.equal(
  getExploreViewState({ activeSection: 'trending', error: 'offline', isLoading: false, itemCount: 0, query: 'd' })
    .isSearching,
  false,
  'queries shorter than two characters keep discovery sections visible',
);
assert.equal(
  getExploreViewState({ activeSection: 'trending', error: 'offline', isLoading: false, itemCount: 0, query: 'dune' })
    .errorTitle,
  'Search could not be completed',
  'search errors use a local search label',
);

console.log('Explore state QA passed.');
