// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { MovieDetails } from '../api/catalogue';
import * as voteModel from '../watchlists/sharedVoteModel';
import * as snapshotModel from './catalogueMediaSnapshots';
import { getCachedMovieDetail, retainCatalogueDetail, type CatalogueDetailCache } from './catalogueDetailCache';
import {
  catalogueArtworkSnapshot,
  catalogueMediaSnapshot,
  catalogueSnapshotKey,
  isCurrentCatalogueSnapshotDataset,
  retainCatalogueSnapshots,
  type CatalogueArtworkSnapshot,
  type CatalogueMediaSnapshot,
  type CatalogueSnapshotItem,
  type CatalogueSnapshots,
} from './catalogueMediaSnapshots';

const items: CatalogueSnapshotItem[] = Array.from({ length: 600 }, (_, index) => ({ contentType: 'movie', tmdbId: index + 1 }));
let details: CatalogueDetailCache = new Map();
let calendar: CatalogueSnapshots<CatalogueArtworkSnapshot> = { scope: '', items: new Map() };
let votes: CatalogueSnapshots<CatalogueMediaSnapshot> = { scope: '', items: new Map() };

for (const item of items) {
  const loaded: MovieDetails = {
    backdropUrl: null, cast: [], genres: ['Drama'], id: `movie:${item.tmdbId}`,
    keywords: [], logoAspectRatio: null, logoUrl: null, originalTitle: null,
    overview: 'Full detail data must not be retained by rows.', posterUrl: `https://image.test/${item.tmdbId}.jpg`,
    productionCompanies: [], recommendations: [], status: null, tagline: null,
    title: `Title ${item.tmdbId}`, tmdbId: item.tmdbId, videos: [], voteAverage: null,
    mediaType: 'movie', budget: null, directors: [], displayRating: null, releaseDate: null,
    revenue: null, runtimeMinutes: null, writers: [],
  };
  details = retainCatalogueDetail(details, item.tmdbId, loaded);
  calendar = retainCatalogueSnapshots(calendar, 'owner-a:calendar', items, [[item, catalogueArtworkSnapshot(loaded)]]);
  votes = retainCatalogueSnapshots(votes, 'owner-a:vote-a', items, [[item, catalogueMediaSnapshot(loaded)]]);
}

assert.equal(details.size, 120);
assert.equal(getCachedMovieDetail(details, 1), null, 'the full details must actually be evicted');
assert.equal(calendar.items.size, 600);
assert.equal(votes.items.size, 600);
assert.deepEqual(calendar.items.get('movie:1'), { title: 'Title 1', posterUrl: 'https://image.test/1.jpg' },
  'calendar artwork must survive more than 120 unique loads');
assert.deepEqual(votes.items.get('movie:1'), { title: 'Title 1', posterUrl: 'https://image.test/1.jpg', genres: ['Drama'] },
  'vote title, poster and genres must survive full-detail eviction');
assert.deepEqual(Object.keys(calendar.items.get('movie:1')!).sort(), ['posterUrl', 'title']);
assert.deepEqual(Object.keys(votes.items.get('movie:1')!).sort(), ['genres', 'posterUrl', 'title']);

const originalGenres = ['Drama'];
const projected = catalogueMediaSnapshot({ title: 'Title', posterUrl: null, genres: originalGenres });
assert.notEqual(projected.genres, originalGenres, 'row snapshots must own their small genre lists');
const existing = votes.items.get('movie:1')!;
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-a', items, [[items[0]!, { ...existing, genres: [...existing.genres] }]]), votes,
  'equivalent cache notifications must not cause another state update');
const pruned = retainCatalogueSnapshots(votes, 'owner-a:vote-a', items.slice(0, 2));
assert.equal(pruned.items.size, 2, 'removed dataset entries must be released');
assert.equal(votes.items.size, 600, 'pruning must not mutate prior state');
assert.equal(retainCatalogueSnapshots(votes, 'owner-b:vote-a', items).items.size, 0, 'another owner must not inherit snapshots');
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-b', items).items.size, 0, 'another voting session must not inherit snapshots');
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-a', []).items.size, 0, 'an empty dataset must release all snapshots');

const series = { contentType: 'series' as const, tmdbId: 1 };
const both = retainCatalogueSnapshots(pruned, 'owner-a:vote-a', [items[0]!, series], [[series, { title: 'TV title', posterUrl: null, genres: [] }]]);
assert.equal(both.items.size, 2);
assert.equal(both.items.get(catalogueSnapshotKey(items[0]!))?.title, 'Title 1');
assert.equal(both.items.get(catalogueSnapshotKey(series))?.title, 'TV title');

const initialDataset = { scope: 'owner-a:calendar', items };
assert.equal(isCurrentCatalogueSnapshotDataset(initialDataset, 'owner-a:calendar', items), true);
assert.equal(isCurrentCatalogueSnapshotDataset({ scope: 'owner-b:calendar', items }, 'owner-a:calendar', items), false,
  'an owner change must reject completion before effect cleanup');
assert.equal(isCurrentCatalogueSnapshotDataset({ scope: 'owner-a:calendar', items: [...items] }, 'owner-a:calendar', items), false,
  'a replaced dataset must reject completion even with the same IDs');
const failedUpdate = { ...existing, title: 'Stale completion' };
const nextDataset = { scope: 'owner-b:calendar', items: [items[0]!] };
const afterLateCompletion = isCurrentCatalogueSnapshotDataset(nextDataset, initialDataset.scope, initialDataset.items)
  ? retainCatalogueSnapshots(pruned, initialDataset.scope, items, [[items[0]!, failedUpdate]]) : pruned;
assert.equal(afterLateCompletion, pruned, 'a stale batch must leave current state untouched');

const calendarSource = readFileSync(new URL('../notifications/ReleaseCalendarScreen.tsx', import.meta.url), 'utf8');
const voteSource = readFileSync(new URL('../watchlists/SharedVoteScreen.tsx', import.meta.url), 'utf8');
assert.match(calendarSource, /JSON\.stringify\(\[ownerId, items\.map\(catalogueSnapshotKey\)\]\)/,
  'calendar state must be tagged with its owner and dataset');
assert.match(calendarSource, /artwork\.scope === artworkScope \? artwork\.items\.get/,
  'rendering must reject another owner/dataset synchronously');
assert.match(calendarSource, /setArtwork\(\(current\) => isCurrent\(\) \? retainCatalogueSnapshots/,
  'queued updates must recheck owner/dataset liveness');
assert.match(calendarSource, /offset \+= 3/, 'existing request concurrency must stay unchanged');
assert.match(voteSource, /sessionMatchesRoute && candidateSnapshots\.scope === cacheKey \? candidateSnapshots\.items\.get/,
  'vote rendering must reject another owner/session synchronously');
assert.match(voteSource, /preloadCatalogueItems\(session\.candidates\.map/,
  'snapshot retention must preserve the existing preload path');

// Execute the real screen with a small hook/module harness. This deliberately
// keeps its existing ownedVote state while the same owner changes route A -> B.
function createVoteScreenHarness(screenSource = voteSource) {
  const slots: any[] = [];
  let cursor = 0;
  let effects: Array<{ index: number; create: () => unknown }> = [];
  let data: any = null;
  const cached = new Map<number, CatalogueMediaSnapshot>();
  const noop = () => {};
  const getToken = async () => 'test-token';
  const getCachedMovie = (tmdbId: number) => cached.get(tmdbId) ?? null;
  const getCachedSeries = () => null;
  const preloadCatalogueItems = async () => {};
  const sameDeps = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: any) => {
        const index = cursor++;
        slots[index] ??= { kind: 'state', value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, (value: any) => {
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        }];
      },
      useRef: (current: unknown) => { const index = cursor++; slots[index] ??= { current }; return slots[index]; },
      useCallback: (callback: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
        return slots[index].value;
      },
      useMemo: (create: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: create(), deps };
        return slots[index].value;
      },
      useEffect: (create: () => unknown, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) {
          slots[index] = { ...slots[index], deps };
          effects.push({ index, create });
        }
      },
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (value: unknown) => value }, Alert: {} },
    '../auth/AuthSessionContext': { useAuthSession: () => ({ currentUser: { id: 'same-owner' }, firebaseIdToken: 'test-token', getFirebaseIdToken: getToken }) },
    '../cache/useCachedResource': { useCachedResource: () => ({ data, isInitialLoading: !data, retry: noop, revalidate: noop }) },
    '../cache/persistedCache': { getPrivateCacheKey: (ownerId: string, key: string) => `${ownerId}:${key}`, writePersistedCache: async () => {} },
    '../catalogue/CatalogueCacheContext': { useCatalogueCache: () => ({ getCachedMovie, getCachedSeries, preloadCatalogueItems }) },
    '../catalogue/catalogueMediaSnapshots': snapshotModel,
    '../design/tokens': { colors: {}, radii: {}, spacing: {}, touchTargets: {}, typography: {} },
    './sharedVoteModel': voteModel,
  };
  const moduleExports: Record<string, Function> = {};
  const code = ts.transpileModule(screenSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports: moduleExports, setInterval: () => 1, clearInterval: noop,
    require: (name: string) => {
      if (name in modules) return modules[name];
      if (name.startsWith('../components/') || name.startsWith('../feedback/') || name.startsWith('../sync/')
        || name === '../api/sharedWatchlists' || name === '../auth/SignInRequired'
        || name === './WatchlistDetailLayout' || name === 'lucide-react-native') return {};
      throw new Error(`Unexpected vote screen import: ${name}`);
    },
  });
  const snapshotSlot = () => slots.find(slot => slot.kind === 'state' && slot.value?.items instanceof Map);
  return {
    cached,
    data: (next: unknown) => { data = next; },
    snapshots: () => snapshotSlot().value as CatalogueSnapshots<CatalogueMediaSnapshot>,
    restoreSnapshots: (next: CatalogueSnapshots<CatalogueMediaSnapshot>) => { snapshotSlot().value = next; },
    render: (sessionId: string) => {
      cursor = 0;
      effects = [];
      const tree = moduleExports.SharedVoteScreen({ route: { params: { watchlistId: 'list', sessionId } } });
      const scheduled = [...effects];
      return {
        tree,
        snapshotEffect: scheduled.find(effect => effect.create.toString().includes('retainCatalogueSnapshots'))?.create,
        commit: () => {
          for (const effect of scheduled) {
            slots[effect.index].cleanup?.();
            slots[effect.index].cleanup = effect.create();
          }
        },
      };
    },
  };
}

function voteData(id: string) {
  return {
    candidateMedia: { candidate: { title: null, posterUrl: null, genres: [] } },
    isOwner: false,
    session: {
      id, status: 'OPEN', closesAt: '2099-01-01T00:00:00.000Z', winningCandidateId: null,
      candidates: [{ id: 'candidate', contentType: 'movie', tmdbId: 1, voteCount: 0, userHasVoted: false }],
    },
  };
}

function renderedPosterLabels(node: any): string[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(renderedPosterLabels);
  if (typeof node !== 'object') return [];
  const label = node.props?.accessibilityLabel;
  return [
    ...(typeof label === 'string' && label.endsWith(' poster') ? [label] : []),
    ...renderedPosterLabels(node.props?.children),
  ];
}

function verifyVoteSnapshotRouteIsolation(screenSource = voteSource) {
  const screen = createVoteScreenHarness(screenSource);
  const hydrated = { title: 'Hydrated title', posterUrl: 'https://image.test/1.jpg', genres: ['Drama'] };
  screen.cached.set(1, hydrated);
  screen.data(voteData('A'));
  screen.render('A').commit();
  const loadedA = screen.render('A');
  loadedA.commit();
  screen.cached.clear();
  assert.deepEqual(renderedPosterLabels(screen.render('A').tree), ['Hydrated title poster'],
    'a matching session must keep its hydrated poster after provider eviction');

  screen.data(null);
  const waitingForB = screen.render('B');
  assert.deepEqual(renderedPosterLabels(waitingForB.tree), ['Unavailable candidate poster'],
    'route B must reject A snapshots before the previous effects are cleaned up');
  screen.cached.set(1, hydrated);
  waitingForB.commit();
  assert.equal(screen.snapshots().items.size, 0,
    'while B data is pending, the real snapshot effect must not seed A candidates under B scope');
  const scopeB = screen.snapshots().scope;
  loadedA.snapshotEffect!();
  screen.cached.clear();
  assert.deepEqual(renderedPosterLabels(screen.render('B').tree), ['Unavailable candidate poster'],
    'a delayed A effect must not expose its snapshots on route B');

  // Also exercise the fallback guard with a matching cache key but mismatched
  // owned session, as could occur with an already queued/restored snapshot.
  screen.restoreSnapshots({ scope: scopeB, items: new Map([['movie:1', hydrated]]) });
  assert.deepEqual(renderedPosterLabels(screen.render('B').tree), ['Unavailable candidate poster'],
    'a matching snapshot cache key alone must not bypass the actual session ID');

  screen.data(voteData('B'));
  screen.render('B').commit();
  screen.cached.set(1, { ...hydrated, title: 'Current B title' });
  screen.render('B').commit();
  screen.cached.clear();
  assert.deepEqual(renderedPosterLabels(screen.render('B').tree), ['Current B title poster'],
    'B must resume normal snapshot seeding and eviction fallback once its own data arrives');
}

verifyVoteSnapshotRouteIsolation();
const unguardedSeeding = voteSource.replace('const candidates = sessionMatchesRoute ? session?.candidates ?? [] : [];',
  'const candidates = session?.candidates ?? [];');
assert.notEqual(unguardedSeeding, voteSource);
assert.throws(() => verifyVoteSnapshotRouteIsolation(unguardedSeeding), /must not seed A candidates under B scope/,
  'the executable regression must fail when the pre-fix seeding behavior is restored');
const unguardedFallback = voteSource.replace('sessionMatchesRoute && candidateSnapshots.scope === cacheKey',
  'candidateSnapshots.scope === cacheKey');
assert.notEqual(unguardedFallback, voteSource);
assert.throws(() => verifyVoteSnapshotRouteIsolation(unguardedFallback), /must not bypass the actual session ID/,
  'the executable regression must fail when the pre-fix fallback behavior is restored');
console.log('Catalogue row snapshots, eviction, pruning and owner/dataset isolation QA passed.');
