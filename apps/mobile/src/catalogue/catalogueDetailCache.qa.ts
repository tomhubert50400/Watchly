// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { MovieDetails, SeriesDetails } from '../api/catalogue';
import { clearMemoryResourceCache } from '../cache/memoryResourceCache';
import {
  CatalogueDetailCache,
  getCachedMovieDetail,
  getCachedSeriesDetail,
  MAX_CATALOGUE_DETAIL_ENTRIES,
  retainCatalogueDetail,
} from './catalogueDetailCache';
import { loadCachedCatalogueResource } from './catalogueResourceCache';

function detail(mediaType: 'movie', tmdbId: number): MovieDetails;
function detail(mediaType: 'series', tmdbId: number): SeriesDetails;
function detail(mediaType: 'movie' | 'series', tmdbId: number): MovieDetails | SeriesDetails;
function detail(mediaType: 'movie' | 'series', tmdbId: number): MovieDetails | SeriesDetails {
  const common = {
    backdropUrl: null, cast: [], genres: [], id: `${mediaType}:${tmdbId}`,
    keywords: [], logoAspectRatio: null, logoUrl: null, originalTitle: null,
    overview: '', posterUrl: null, productionCompanies: [], recommendations: [],
    status: null, tagline: null, title: `Title ${tmdbId}`, tmdbId, videos: [], voteAverage: null,
  };
  return mediaType === 'movie'
    ? { ...common, mediaType, budget: null, directors: [], displayRating: null, releaseDate: null, revenue: null, runtimeMinutes: null, writers: [] }
    : { ...common, mediaType, createdBy: [], firstAirDate: null, inProduction: false, lastAirDate: null, networks: [], numberOfEpisodes: null, numberOfSeasons: null, seasons: [] };
}

async function run() {
  let cache: CatalogueDetailCache = new Map();
  assert.equal(getCachedMovieDetail(cache, 1), null);
  assert.equal(getCachedSeriesDetail(cache, 1), null);
  assert.equal(MAX_CATALOGUE_DETAIL_ENTRIES, 120, 'the provider must have one 120-title session budget');

  for (let tmdbId = 1; tmdbId <= 600; tmdbId += 1) {
    const item = detail(tmdbId % 2 === 0 ? 'movie' : 'series', tmdbId);
    cache = retainCatalogueDetail(cache, tmdbId, item);
    assert.equal(cache.size, Math.min(tmdbId, MAX_CATALOGUE_DETAIL_ENTRIES), 'mixed media must share the same bound after every completion');
    assert.equal(cache.get(`${item.mediaType}:${tmdbId}`), item, 'retention must preserve the full detail object');
  }
  assert.equal(getCachedMovieDetail(cache, 2), null, 'older movies must be released');
  assert.equal(getCachedSeriesDetail(cache, 1), null, 'older series must be released');
  assert.equal(getCachedSeriesDetail(cache, 481)?.tmdbId, 481);
  assert.equal(getCachedMovieDetail(cache, 600)?.tmdbId, 600);

  const prior = cache;
  const refreshed = { ...detail('series', 481), title: 'Updated title' };
  cache = retainCatalogueDetail(cache, 481, refreshed);
  assert.equal(cache.size, MAX_CATALOGUE_DETAIL_ENTRIES, 'updating an entry must not consume a second slot');
  assert.equal(getCachedSeriesDetail(cache, 481), refreshed);
  assert.equal(getCachedSeriesDetail(prior, 481)?.title, 'Title 481', 'state updates must not mutate an earlier React snapshot');
  cache = retainCatalogueDetail(cache, 601, detail('movie', 601));
  assert.equal(getCachedSeriesDetail(cache, 481), refreshed, 'refreshing a title must renew its retention');
  assert.equal(getCachedMovieDetail(cache, 482), null, 'the next oldest entry must be evicted instead');
  assert.equal(prior.size, MAX_CATALOGUE_DETAIL_ENTRIES);
  assert.ok(getCachedMovieDetail(prior, 482), 'eviction must not mutate the previous snapshot');

  cache = new Map();
  const movie = detail('movie', 42);
  const series = detail('series', 42);
  cache = retainCatalogueDetail(cache, 42, movie);
  cache = retainCatalogueDetail(cache, 42, series);
  assert.equal(cache.size, 2, 'movie and series IDs must occupy distinct entries');
  assert.equal(getCachedMovieDetail(cache, 42), movie);
  assert.equal(getCachedSeriesDetail(cache, 42), series);
  const orderBeforeReads = [...cache.keys()];
  getCachedMovieDetail(cache, 42);
  getCachedSeriesDetail(cache, 42);
  assert.deepEqual([...cache.keys()], orderBeforeReads, 'render-time reads must remain pure');

  // Use the production loader and retention update with deferred responses to
  // exercise out-of-order completions without a React Native renderer.
  clearMemoryResourceCache();
  cache = new Map();
  let requests = 0;
  const finish: Array<() => void> = [];
  const load = (tmdbId: number) => {
    const item = detail(tmdbId % 2 === 0 ? 'movie' : 'series', tmdbId);
    return loadCachedCatalogueResource(`qa:details:${item.mediaType}:${tmdbId}`, () => {
      requests += 1;
      return new Promise<MovieDetails | SeriesDetails>((resolve) => {
        finish.push(() => resolve(item));
      });
    }).then((loaded) => {
      cache = retainCatalogueDetail(cache, tmdbId, loaded);
      assert.ok(cache.size <= MAX_CATALOGUE_DETAIL_ENTRIES);
      return loaded;
    });
  };
  const pending = Array.from({ length: 600 }, (_, index) => load(index + 1));
  const duplicate = load(600);
  assert.equal(requests, 600, 'same-title pending requests must remain coalesced');
  for (const resolve of [...finish].reverse()) resolve();
  await Promise.all([...pending, duplicate]);
  assert.equal(cache.size, MAX_CATALOGUE_DETAIL_ENTRIES, 'concurrent results must still enforce the shared cap');
  assert.equal(getCachedSeriesDetail(cache, 1)?.tmdbId, 1, 'later completions must not overwrite newer state with a captured snapshot');
  assert.equal(await duplicate, await pending[599], 'coalesced requests must return the same detail object');
  const requestCount = requests;
  const cachedRequest = load(1);
  assert.equal(requests, requestCount, 'fresh shared resources must still avoid redundant requests');
  await cachedRequest;
  clearMemoryResourceCache();

  const provider = readFileSync(new URL('./CatalogueCacheContext.tsx', import.meta.url), 'utf8');
  assert.equal((provider.match(/setDetails\(\(current\) => retainCatalogueDetail\(current, tmdbId, item\)\)/g) ?? []).length, 2,
    'both loaders must apply retention against the latest functional React state');
  assert.ok(!provider.includes('useState<Record<number,'), 'the provider must not retain unbounded parallel detail records');
  assert.equal((provider.match(/const refresh(?:Movie|Series) = useCallback\(async/g) ?? []).length, 2);
  assert.equal((provider.match(/\}, \[\]\);/g) ?? []).length, 2, 'refresh callbacks must remain stable across cache updates');

  console.log('Catalogue detail cache bound, refresh, identity and concurrent completion QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
