// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { CatalogueDiscoveryItem, CatalogueSearchItem } from '../api/catalogue';
import {
  buildExploreSections,
  filterSearchResults,
  getExploreViewState,
  groupDiscoveryItemsByGenre,
  groupSearchResults,
  interleaveMediaItems,
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
const exploreScreenSource = readFileSync(new URL('./ExploreScreen.tsx', import.meta.url), 'utf8');

assert.match(
  exploreScreenSource,
  /placeholder="Search for Movies, TV Shows or People"/,
  'Explore search must tell users that profiles are searchable',
);
assert.match(
  exploreScreenSource,
  /searchProfiles\(firebaseIdToken, trimmedQuery\)/,
  'the All search must request matching Watchly profiles',
);
assert.match(
  exploreScreenSource,
  /navigation\.navigate\('PublicProfile'/,
  'people results must open the existing public profile route',
);
assert.match(
  exploreScreenSource,
  /profilePreview: \{[\s\S]*avatarUrl: person\.avatarUrl[\s\S]*displayName: person\.displayName[\s\S]*handle: person\.handle/,
  'people results must pass their visible identity into the public profile route',
);

const sections = buildExploreSections({
    announced: [duplicatedMovie, duplicateMovie],
    announcedSeries: [seriesWithSameTmdbId],
    trending: [duplicatedMovie, duplicateMovie],
    trendingSeries: [seriesWithSameTmdbId],
  });

assert.deepEqual(
  sections,
  {
    announced: {
      movie: [duplicatedMovie],
      series: [seriesWithSameTmdbId],
    },
    trending: {
      movie: [duplicatedMovie],
      series: [seriesWithSameTmdbId],
    },
  },
  'section composition deduplicates by media type and TMDB id while preserving API order',
);

assert.deepEqual(
  interleaveMediaItems([duplicatedMovie], [seriesWithSameTmdbId]),
  [duplicatedMovie, seriesWithSameTmdbId],
  'the selected section can pick one featured title across movies and TV shows',
);

const dramaMovie = { ...duplicatedMovie, genres: ['Drama', 'Thriller'] } satisfies CatalogueDiscoveryItem;
const dramaSeries = { ...seriesWithSameTmdbId, genres: ['Drama'] } satisfies CatalogueDiscoveryItem;
const unclassifiedMovie = { ...item(2, 'movie', 'Unclassified'), genres: [] } satisfies CatalogueDiscoveryItem;

assert.deepEqual(
  groupDiscoveryItemsByGenre([dramaMovie, dramaSeries, unclassifiedMovie]),
  [
    { genre: 'Drama', items: [dramaMovie, dramaSeries] },
    { genre: 'Other', items: [unclassifiedMovie] },
    { genre: 'Thriller', items: [dramaMovie] },
  ],
  'extended discovery groups real titles by genre and keeps uncategorized titles visible',
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
    emptyBody: 'Try another movie, TV show or person.',
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
