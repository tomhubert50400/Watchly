// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import '../cache/cachedResourcePause.qa';

const code = ts.transpileModule(readFileSync(new URL('./DiscoverScreen.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function mount(signedIn: boolean) {
  const slots: any[] = [];
  let cursor = 0;
  let effects: Array<{ index: number; create: Function; deps: unknown[] }> = [];
  let resources: Array<{ enabled: boolean; paused: boolean }> = [];
  const browse: Array<{ filters: any; resolve: (value: any) => void; reject: (error: Error) => void }> = [];
  const images: Array<{ urls: string[]; isCurrent: () => boolean }> = [];
  const details: Array<{ resolve: () => void }> = [];
  const noop = () => {};
  const data = { items: Array.from({ length: 6 }, (_, index) => ({
    id: `movie:${index}`, tmdbId: index + 1, mediaType: 'movie', posterUrl: `poster:${index}`, backdropUrl: `backdrop:${index}`,
  })) };
  const collections = { items: ['2000s', 'award-winners', '1990s', 'animation'].map(id => ({ id, artwork: [] })) };
  const sameDeps = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const preloadCatalogueItems = () => new Promise<void>(resolve => details.push({ resolve }));
  const moduleExports: Record<string, Function> = {};
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, (value: unknown) => { slots[index].value = value; }];
      },
      useRef: (current: unknown) => { const index = cursor++; slots[index] ??= { current }; return slots[index]; },
      useCallback: (callback: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
        return slots[index].callback;
      },
      useEffect: (create: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) effects.push({ index, create, deps });
      },
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    '@react-navigation/native': { useNavigation: () => ({ navigate: noop }) },
    'lucide-react-native': {},
    'react-native': { Keyboard: { dismiss: noop }, StyleSheet: { create: (value: unknown) => value } },
    '../auth/AuthSessionContext': { useAuthSession: () => ({ currentUser: signedIn ? { id: 'test-user' } : null, firebaseIdToken: signedIn ? 'test-token' : null }) },
    '../cache/persistedCache': { getPrivateCacheKey: (id: string, key: string) => `${id}:${key}`, getPublicCacheKey: (key: string) => key },
    '../api/discover': {
      browseResourceKey: (filters: unknown) => JSON.stringify(filters), collectionFilters: (id: string) => ({ collectionId: id }), discoverMoods: [],
      getDiscover: noop, getDiscoverCollections: noop,
      getDiscoverBrowse: (_token: unknown, filters: unknown) => new Promise((resolve, reject) => browse.push({ filters, resolve, reject })),
    },
    '../cache/useCachedResource': {
      useCachedResource: (options: { enabled?: boolean; paused?: boolean }) => {
        const index = resources.length;
        resources.push({ enabled: options.enabled ?? true, paused: options.paused ?? false });
        return { data: index === 0 ? data : collections, retry: noop, revalidate: noop };
      },
      preloadCachedResource: ({ load }: { load: Function }) => load(),
    },
    '../cache/optionalImagePrefetch': { prefetchOptionalImages: (urls: string[], isCurrent: () => boolean) => { images.push({ urls, isCurrent }); return Promise.resolve(); } },
    '../sync/userDataEvents': { useUserDataRevision: () => 0 },
    './CatalogueCacheContext': { useCatalogueCache: () => ({ preloadCatalogueItems }) },
    '../design/tokens': { colors: {}, spacing: {}, radii: {}, typography: {} },
  };
  runInNewContext(code, { exports: moduleExports, require: (name: string) => {
    if (name in modules) return modules[name];
    if (name.startsWith('../components/') || name.startsWith('./Discover') || name === './ExploreMediaCard' || name === '../library/WatchlistRail') return {};
    throw new Error(`Unexpected import ${name}`);
  } });
  return {
    browse, images, details,
    enabled: () => resources.map(resource => resource.enabled),
    paused: () => resources.map(resource => resource.paused),
    render: (isActive: boolean) => {
      cursor = 0; effects = []; resources = [];
      const tree = moduleExports.DiscoverScreen({ isActive });
      for (const effect of effects) slots[effect.index]?.cleanup?.();
      for (const effect of effects) slots[effect.index] = { deps: effect.deps, cleanup: effect.create() };
      return tree;
    },
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

async function verify(signedIn: boolean) {
  const screen = mount(signedIn);
  screen.render(false);
  assert.deepEqual(screen.enabled(), [true, true], 'inactive Discover must keep both resources available');
  assert.deepEqual(screen.paused(), [true, true], 'inactive Discover must pause both resources');
  assert.equal(screen.browse.length, 0);
  assert.equal(screen.images.length, 0);
  assert.equal(screen.details.length, 0);
  screen.render(true);
  assert.deepEqual(screen.enabled(), [true, true]);
  assert.deepEqual(screen.paused(), [false, false]);
  assert.equal(screen.browse.length, 1, 'focus starts only the first optional browse request');
  assert.equal(screen.details.length, 1);
  assert.equal(screen.images[0].isCurrent(), true);
  screen.render(false);
  assert.equal(screen.images[0].isCurrent(), false, 'blur invalidates queued artwork');
  screen.browse[0].resolve({ items: [{ posterUrl: 'stale-result' }] });
  screen.details[0].resolve();
  await flush();
  assert.equal(screen.browse.length, 1, 'blur stops scheduling later collections');
  assert.equal(screen.details.length, 1, 'blur stops later catalogue batches');
  assert.equal(screen.images.length, 1, 'a stale browse response must not enqueue artwork');

  const reopened = screen.render(true);
  assert.equal(screen.browse.length, 2, 'reopening must restart optional warming');
  screen.browse[1].reject(new Error('offline'));
  await flush();
  assert.equal(screen.browse.length, 3, 'one failed browse must not block the next collection');
  reopened.props.children[1].props.onApply('funny');
  screen.render(true);
  assert.equal(screen.browse.length, 4, 'a mood change starts a fresh scope');
  screen.browse[2].resolve({ items: [{ posterUrl: 'old-mood' }] });
  await flush();
  assert.equal(screen.browse.length, 4, 'old mood responses must not continue old warming');
  for (let index = 3; index < 9; index += 1) {
    assert.equal(screen.browse.length, index + 1);
    screen.browse[index].resolve({ items: [{ posterUrl: `current:${index}` }] });
    await flush();
  }
  assert.equal(screen.browse[8].filters.mood, 'funny', 'the current mood must be included');
  assert.equal(screen.images.some(batch => batch.urls.includes('old-mood')), false);
  screen.unmount();
  assert.equal(screen.images.every(batch => !batch.isCurrent()), true, 'unmount invalidates all outstanding image consumers');
  for (const detail of screen.details) detail.resolve();
  await flush();
}
void (async () => {
  await verify(false);
  await verify(true);
  console.log('Discover focus preloading QA passed: inactive, focus, blur, reopen, mood replacement, failures and unmount.');
})();
