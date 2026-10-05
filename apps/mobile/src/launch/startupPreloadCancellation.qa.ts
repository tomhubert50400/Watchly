// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('./AppStartupPreloader.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function mount({ token, publicGate, catalogueGate, status = 'signedOut' }: {
  token?: Promise<string>;
  publicGate?: Promise<void>;
  catalogueGate?: Promise<void>;
  status?: string;
} = {}) {
  let effect!: () => () => void;
  const ready: boolean[] = [];
  const images: Array<{ urls: string[]; isCurrent: () => boolean }> = [];
  const timers: Array<() => void> = [];
  let catalogueLoads = 0;
  let privateLoads = 0;
  const fixtureItems = Array.from({ length: 30 }, (_, index) => ({ mediaType: 'movie', tmdbId: index + 1, posterUrl: `poster:${index}` }));
  const home = { hero: { backdropUrl: 'hero', posterUrl: 'poster', logoUrl: 'logo' }, trending: fixtureItems };
  const sections = { spotlight: { backdropUrl: 'hero' }, trending: fixtureItems, trendingSeries: fixtureItems, announced: fixtureItems, announcedSeries: fixtureItems };
  const noop = () => {};
  const moduleExports: Record<string, Function> = {};
  const modules: Record<string, unknown> = {
    react: { useEffect: (callback: typeof effect) => { effect = callback; }, useRef: (current: unknown) => ({ current }), useState: (initial: boolean) => [initial, (value: boolean) => ready.push(value)] },
    '../auth/AuthSessionContext': { useAuthSession: () => ({ status, currentUser: { id: 'test-user', handle: 'tester', onboardingCompleted: true }, getFirebaseIdToken: () => token ?? Promise.resolve('fixture-token') }) },
    '../cache/useCachedResource': { preloadCachedResource: async ({ key }: { key: string }) => {
      if (key === 'home' || key === 'sections') { await publicGate; return key === 'home' ? home : sections; }
      privateLoads += 1;
      return key === 'library' ? { items: [], lists: [] } : key === 'profile' ? { opinions: [], viewingStats: { highlights: [] } } : [];
    } },
    '../cache/optionalImagePrefetch': { prefetchOptionalImages: (urls: string[], isCurrent: () => boolean) => { images.push({ urls, isCurrent }); return new Promise(() => {}); } },
    '../catalogue/CatalogueCacheContext': { useCatalogueCache: () => ({ preloadCatalogueItems: async () => { catalogueLoads += 1; await catalogueGate; }, refreshMovie: noop, refreshSeries: noop }) },
    '../catalogue/catalogueSectionsResource': { PUBLIC_CATALOGUE_SECTIONS_KEY: 'sections', loadCatalogueSections: noop },
    '../home/HomeScreen': { PUBLIC_HOME_KEY: 'home', getHomeFeedKey: () => 'feed', getHomeNotificationsKey: () => 'notifications' },
    '../feed/FeedScreen': { getCommunityFeedKey: () => 'community' },
    '../library/useLibraryData': { getLibraryResourceKey: () => 'library' },
    '../profile/ProfileScreen': { getProfileResourceKey: () => 'profile' },
    '../watchlists/WatchlistCacheContext': { useWatchlistCache: () => ({ preloadWatchlists: () => Promise.resolve() }) },
    './WatchlyLaunchGate': { useAppLaunchReadiness: noop },
  };
  runInNewContext(code, { exports: moduleExports, setTimeout: (callback: () => void) => timers.push(callback), clearTimeout: noop, require: (name: string) => {
    assert(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  moduleExports.AppStartupPreloader();
  const cleanup = effect();
  return { cleanup, ready, images, timers, catalogueLoads: () => catalogueLoads, privateLoads: () => privateLoads };
}

void (async () => {
  const publicGate = deferred<void>();
  const early = mount({ publicGate: publicGate.promise });
  early.cleanup();
  publicGate.resolve();
  await flush();
  assert.deepEqual(early.ready, [], 'an obsolete startup must not publish readiness');
  assert.equal(early.catalogueLoads(), 0, 'cleanup during public reads stops optional detail warming');
  assert.equal(early.images.length, 0);

  const catalogueGate = deferred<void>();
  const middle = mount({ catalogueGate: catalogueGate.promise });
  await flush();
  assert.deepEqual(middle.ready, [true], 'launch readiness must still precede optional warming');
  middle.cleanup();
  catalogueGate.resolve();
  await flush();
  assert.equal(middle.images.length, 0);

  const token = deferred<string>();
  const authentication = mount({ token: token.promise, status: 'signedIn' });
  await flush();
  authentication.cleanup();
  token.resolve('fixture-token');
  await flush();
  assert.equal(authentication.privateLoads(), 0, 'an obsolete auth scope must not start private preloading');

  const live = mount();
  await flush();
  assert.equal(live.images.length, 1);
  assert.ok(live.images[0].urls.length <= 24, 'startup image count must remain bounded');
  assert.equal(new Set(live.images[0].urls).size, live.images[0].urls.length);
  assert.equal(live.images[0].isCurrent(), true);
  live.cleanup();
  assert.equal(live.images[0].isCurrent(), false, 'cleanup cancels queued startup images');
  live.timers[0]();
  await flush();

  const deadline = mount();
  await flush();
  deadline.timers[0]();
  await flush();
  assert.equal(deadline.images[0].isCurrent(), false, 'the existing three-second budget must also stop queued warming');
  deadline.cleanup();
  console.log('Startup cancellation QA passed: early cleanup, readiness, auth replacement, image cleanup and deadline.');
})();
