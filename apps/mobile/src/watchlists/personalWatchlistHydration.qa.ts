// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import type { PersonalWatchlistItem } from '../api/watchlists';
import type { SharedWatchlistItem } from '../api/sharedWatchlists';
import {
  hydratePersonalWatchlistItems,
  hydrateWatchlistItems,
  getWatchlistItemLoadingState,
  type HydratedPersonalWatchlistItem,
} from './personalWatchlistHydration';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function makeItems(count: number): PersonalWatchlistItem[] {
  return Array.from({ length: count }, (_, index) => ({
    contentType: index % 2 === 0 ? 'movie' : 'series',
    createdAt: '2026-10-02T00:00:00.000Z',
    id: `item-${index}`,
    sectionId: index % 3 === 0 ? 'section-a' : null,
    tmdbId: index + 1,
  }));
}

function metadata(item: PersonalWatchlistItem) {
  const key = `${item.contentType}:${item.tmdbId}`;
  return { backdropUrl: `backdrop:${key}`, posterUrl: `poster:${key}`, title: `Title ${key}` };
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function run() {
  const items = makeItems(500);
  const firstBatch = deferred<void>();
  const tail = deferred<void>();
  const tailStarted = deferred<void>();
  const started: string[] = [];
  const snapshots: HydratedPersonalWatchlistItem[][] = [];
  const preservedSnapshots: { items: HydratedPersonalWatchlistItem[]; serialized: string }[] = [];
  let active = 0;
  let peak = 0;
  let finished = false;
  const hydration = hydratePersonalWatchlistItems({
    backgroundItemId: items[497].id,
    isCurrent: () => true,
    items,
    load: async (item) => {
      started.push(item.id);
      active += 1;
      peak = Math.max(peak, active);
      await firstBatch.promise;
      if (item.id === items[499].id) {
        tailStarted.resolve();
        await tail.promise;
      }
      active -= 1;
      return metadata(item);
    },
    onProgress: (snapshot) => {
      snapshots.push(snapshot);
      if (snapshots.length <= 2 || snapshots.length === 14) {
        preservedSnapshots.push({ items: snapshot, serialized: JSON.stringify(snapshot) });
      }
    },
  }).then((result) => { finished = true; return result; });

  await flushMicrotasks();
  assert.equal(started.length, 3, 'large lists must start only three concurrent metadata requests');
  assert.equal(started[0], items[497].id, 'the selected background must be hydrated first');
  assert.equal(snapshots[0].length, 500, 'the first snapshot must retain the entire list');
  assert(snapshots[0].every((item) => item.title === 'Loading title'));
  firstBatch.resolve();
  await tailStarted.promise;
  await flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(finished, false, 'the deferred last title must still be loading');
  assert(snapshots.some((snapshot) => snapshot[13].title === metadata(items[13]).title),
    'titles beyond the old twelve-item boundary must appear before all requests finish');
  assert.equal(peak, 3, 'hydration must remain bounded throughout all 500 titles');
  tail.resolve();
  const result = await hydration;
  assert(snapshots.length < 10, 'fast metadata completions must be batched instead of publishing 500 full grids');
  assert.deepEqual(snapshots.at(-1), result, 'the final snapshot must publish every title without waiting for the progress timer');
  assert.equal(started.length, 500, 'every movie and series must receive metadata');
  assert.equal(new Set(started).size, 500, 'each item must be requested only once');
  assert.deepEqual(result, items.map((item) => ({ ...item, ...metadata(item) })));
  assert.equal(new Set(snapshots).size, snapshots.length, 'progress must publish new array snapshots');
  for (const snapshot of preservedSnapshots) {
    assert.equal(JSON.stringify(snapshot.items), snapshot.serialized,
      'later completions must not mutate arrays or items already published');
  }

  const previousItems: HydratedPersonalWatchlistItem[] = [
    { ...items[0], ...metadata(items[0]) },
    { ...items[1], tmdbId: items[0].tmdbId, ...metadata({ ...items[1], tmdbId: items[0].tmdbId }) },
  ];
  const freshItems = previousItems.slice().reverse().map((item, index) => ({
    contentType: item.contentType,
    createdAt: '2026-10-02T01:00:00.000Z',
    id: `replacement-${index}`,
    sectionId: 'new-section',
    tmdbId: item.tmdbId,
  }));
  let refreshCalls = 0;
  const refreshed = await hydratePersonalWatchlistItems({
    isCurrent: () => true,
    items: freshItems,
    load: async () => { refreshCalls += 1; throw new Error('offline'); },
    onProgress: () => undefined,
    previousItems,
  });
  assert.equal(refreshCalls, 0, 'known metadata must survive refresh without redundant requests');
  assert.deepEqual(refreshed, freshItems.map((item) => ({ ...item, ...metadata(item) })),
    'reuse must match both content type and TMDB id while retaining fresh ids, sections and order');

  const legacyItems = makeItems(4);
  const legacyTitles = ['TMDB 1', 'Loading title', 'Title unavailable', 'Title'];
  let retries = 0;
  const recovered = await hydratePersonalWatchlistItems({
    isCurrent: () => true,
    items: legacyItems,
    load: async (item) => { retries += 1; return metadata(item); },
    onProgress: () => undefined,
    previousItems: legacyItems.map((item, index) => ({
      ...item, backdropUrl: null, posterUrl: null, title: legacyTitles[index],
    })),
  });
  assert.equal(retries, 4, 'legacy placeholders and failed titles must be retried');
  assert.deepEqual(recovered, legacyItems.map((item) => ({ ...item, ...metadata(item) })));

  const failedItems = makeItems(17);
  const failedResult = await hydratePersonalWatchlistItems({
    isCurrent: () => true,
    items: failedItems,
    load: async (item) => {
      if (item.id === failedItems[2].id) throw new Error('metadata unavailable');
      return metadata(item);
    },
    onProgress: () => undefined,
  });
  assert.deepEqual(failedResult[2], {
    ...failedItems[2], backdropUrl: null, posterUrl: null, title: 'Title unavailable',
  });
  assert.deepEqual(failedResult[16], { ...failedItems[16], ...metadata(failedItems[16]) },
    'one failed lookup must not prevent later titles from loading');
  assert.equal(getWatchlistItemLoadingState({ title: 'Title' }), 'loading');
  assert.equal(getWatchlistItemLoadingState(failedResult[2]), 'error');
  assert.equal(getWatchlistItemLoadingState(failedResult[16]), 'ready');
  const retriedIds: string[] = [];
  const retried = await hydratePersonalWatchlistItems({
    items: failedItems, previousItems: failedResult, isCurrent: () => true, onProgress: () => undefined,
    load: async item => { retriedIds.push(item.id); return metadata(item); },
  });
  assert.deepEqual(retriedIds, [failedItems[2].id], 'Retry missing titles must only request failed metadata');
  assert(retried.every(item => getWatchlistItemLoadingState(item) === 'ready'));

  const cancelledBatch = deferred<void>();
  let current = true;
  let cancelledCalls = 0;
  let cancelledPublications = 0;
  const cancelledHydration = hydratePersonalWatchlistItems({
    isCurrent: () => current,
    items: makeItems(30),
    load: async (item) => {
      cancelledCalls += 1;
      await cancelledBatch.promise;
      return metadata(item);
    },
    onProgress: () => { cancelledPublications += 1; },
  });
  await flushMicrotasks();
  assert.equal(cancelledCalls, 3);
  const publicationsBeforeCancellation = cancelledPublications;
  current = false;
  cancelledBatch.resolve();
  await cancelledHydration.catch(() => undefined);
  assert.equal(cancelledCalls, 3, 'superseded requests must not schedule more metadata lookups');
  assert.equal(cancelledPublications, publicationsBeforeCancellation,
    'an account change, new refresh or screen close must stop all further publications');

  const sharedItems: SharedWatchlistItem[] = makeItems(20).map(({ sectionId: _sectionId, ...item }) => item);
  let sharedLoads = 0;
  const sharedResult = await hydrateWatchlistItems({
    items: sharedItems,
    previousItems: sharedItems.map((item) => ({ ...item, backdropUrl: null, posterUrl: null, title: null })),
    isCurrent: () => true,
    load: async (item) => {
      sharedLoads += 1;
      return { backdropUrl: `backdrop:${item.tmdbId}`, posterUrl: `poster:${item.tmdbId}`, title: `Shared ${item.tmdbId}` };
    },
    onProgress: () => undefined,
  });
  assert.equal(sharedLoads, 20, 'legacy null titles in shared caches must hydrate beyond twelve entries');
  assert.equal(sharedResult[19].title, 'Shared 20');
  assert.deepEqual(sharedResult.map(({ backdropUrl: _backdropUrl, posterUrl: _posterUrl, title: _title, ...item }) => item), sharedItems,
    'shared metadata hydration must retain every candidate identity and original order');

  console.log('Watchlist hydration QA passed: 500 titles, shared legacy metadata, bounded progressive loads, retained metadata, retry and cancellation.');
}

const timeout = setTimeout(() => {
  console.error('Personal watchlist hydration QA timed out before completing all titles.');
  process.exitCode = 1;
}, 10_000);

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => clearTimeout(timeout));
