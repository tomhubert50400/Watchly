// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { clearMemoryResourceCache, clearMemoryResourcesWithPrefix, setMemoryResource } from '../cache/memoryResourceCache';
import { loadCachedCatalogueResource } from './catalogueResourceCache';
import { getOnboardingTasteOptions, searchActors, searchCatalogue } from '../api/catalogue';
import { appendDiscoverBrowsePage, restoreDiscoverBrowsePages } from './discoverBrowsePages';
import type { DiscoverItem } from '../api/discover';

async function run() {
  clearMemoryResourceCache();
  let requests = 0;
  const load = async () => {
    requests += 1;
    await Promise.resolve();
    return { title: 'Heat' };
  };

  const [first, concurrent] = await Promise.all([
    loadCachedCatalogueResource('qa:catalogue:movie:949', load),
    loadCachedCatalogueResource('qa:catalogue:movie:949', load),
  ]);
  const cached = await loadCachedCatalogueResource('qa:catalogue:movie:949', load);

  assert.deepEqual(first, { title: 'Heat' });
  assert.deepEqual(concurrent, first);
  assert.deepEqual(cached, first);
  assert.equal(requests, 1, 'catalogue requests must share in-flight work and reuse fresh data');

  setMemoryResource('qa:catalogue:movie:949', first, new Date(Date.now() - 600_000).toISOString());
  await loadCachedCatalogueResource('qa:catalogue:movie:949', load);
  assert.equal(requests, 2, 'expired catalogue results must refresh');

  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  let fail = false;
  try {
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify(fail ? { message: 'Unavailable' } : { items: [], movies: [], series: [], movieGenres: [], provider: 'tmdb' }), { status: fail ? 503 : 200 });
    };
    await Promise.all([searchCatalogue('Heat', 'movie'), searchCatalogue('Heat', 'movie')]);
    await searchCatalogue('Heat', 'series');
    await searchCatalogue('Heat', 'movie');
    assert.equal(urls.length, 2, 'switching movie/series filters and back must reuse the correct search response');
    await searchCatalogue('Alien', 'movie');
    assert.equal(urls.length, 3, 'different queries must not reuse another search');
    await searchActors('Pacino');
    await searchActors('Pacino');
    assert.equal(urls.length, 4, 'actor results must survive revisiting the same search');
    await getOnboardingTasteOptions();
    await getOnboardingTasteOptions(18);
    await getOnboardingTasteOptions(35);
    await getOnboardingTasteOptions(18);
    await getOnboardingTasteOptions();
    assert.equal(urls.length, 7, 'onboarding genres and the unfiltered selection must keep separate reusable results');
    fail = true;
    await assert.rejects(searchCatalogue('Retry me', 'all'));
    fail = false;
    await searchCatalogue('Retry me', 'all');
    assert.equal(urls.length, 9, 'failed requests must not become cached results');
  } finally {
    globalThis.fetch = originalFetch;
  }

  const userA = 'watchly:user:user-a:profile:search:alex:0:v1';
  const userB = 'watchly:user:user-b:profile:search:alex:0:v1';
  assert.deepEqual(await loadCachedCatalogueResource(userA, async () => ['visible-to-a']), ['visible-to-a']);
  assert.deepEqual(await loadCachedCatalogueResource(userB, async () => ['visible-to-b']), ['visible-to-b']);
  assert.deepEqual(await loadCachedCatalogueResource(userA, async () => []), ['visible-to-a'], 'profile-search cache must remain scoped to its viewer');
  clearMemoryResourcesWithPrefix('watchly:user:user-a:');
  assert.deepEqual(await loadCachedCatalogueResource(userA, async () => ['refreshed-a']), ['refreshed-a'], 'sign-out must clear the viewer search cache');
  assert.deepEqual(await loadCachedCatalogueResource(userB, async () => []), ['visible-to-b'], 'clearing one viewer must not clear another viewer');

  const browseKey = 'watchly:user:user-a:discover:browse:genre=drama:v1';
  const baseSavedAt = new Date().toISOString();
  const movie: DiscoverItem = { id: 'movie:1', tmdbId: 1, mediaType: 'movie', title: 'Title', overview: '', posterUrl: null, releaseDate: null, voteAverage: null, backdropUrl: null, genreIds: [18], reason: '' };
  const initialPages = restoreDiscoverBrowsePages(browseKey, baseSavedAt, true);
  const loadedPages = appendDiscoverBrowsePage(browseKey, initialPages, { items: [movie], hasMore: false, partial: false });
  assert.deepEqual(restoreDiscoverBrowsePages(browseKey, baseSavedAt, true), loadedPages, 'returning to a filter must restore all loaded pages and the next-page cursor');
  assert.equal(restoreDiscoverBrowsePages(`${browseKey}:other-filter`, baseSavedAt, true).items.length, 0, 'pages from another filter must remain separate');
  assert.equal(restoreDiscoverBrowsePages(browseKey.replace('user-a', 'user-b'), baseSavedAt, true).items.length, 0, 'pages from another account must remain separate');
  assert.equal(restoreDiscoverBrowsePages(browseKey, 'new-refresh', true).page, 1, 'refreshing the first page must invalidate old extra pages');

  console.log('Catalogue resource cache QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
