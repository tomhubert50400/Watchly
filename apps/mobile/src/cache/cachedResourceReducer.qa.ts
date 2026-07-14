// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { parseCacheEnvelope, serializeCacheEnvelope } from './cacheEnvelope';
import {
  clearPrivateCacheForUser,
  getPrivateCacheKey,
  getPublicCacheKey,
  readPersistedCache,
  removePersistedCache,
  type PersistedCacheStorage,
  writePersistedCache,
} from './persistedCache';
import {
  cachedResourceReducer,
  createInitialCachedResourceState,
} from './cachedResourceReducer';
import { setMemoryResource } from './memoryResourceCache';
import { createCachedResourceStateFromMemory, createRequestVersionGuard } from './useCachedResource';

const initial = createInitialCachedResourceState<string[]>();
assert.deepEqual(initial, {
  data: null,
  error: null,
  isInitialLoading: false,
  isRefreshing: false,
  savedAt: null,
});

setMemoryResource('watchly:public:instant', ['instant'], '2026-07-11T00:00:00.000Z');
assert.deepEqual(createCachedResourceStateFromMemory<string[]>('watchly:public:instant'), {
  data: ['instant'],
  error: null,
  isInitialLoading: false,
  isRefreshing: false,
  savedAt: '2026-07-11T00:00:00.000Z',
});

const initialLoading = cachedResourceReducer(initial, { type: 'requestStarted' });
assert.equal(initialLoading.isInitialLoading, true);
assert.equal(initialLoading.isRefreshing, false);

const firstSuccess = cachedResourceReducer(initialLoading, {
  type: 'requestSucceeded',
  data: ['first'],
  savedAt: '2026-07-10T12:00:00.000Z',
});
assert.deepEqual(firstSuccess, {
  data: ['first'],
  error: null,
  isInitialLoading: false,
  isRefreshing: false,
  savedAt: '2026-07-10T12:00:00.000Z',
});

const refreshing = cachedResourceReducer(firstSuccess, { type: 'requestStarted' });
assert.equal(refreshing.isInitialLoading, false);
assert.equal(refreshing.isRefreshing, true);
assert.deepEqual(refreshing.data, ['first']);

const silentlyRevalidating = cachedResourceReducer(firstSuccess, { type: 'requestStarted', visible: false });
assert.equal(silentlyRevalidating.isInitialLoading, false, 'cached content must stay visible during background refresh');
assert.equal(silentlyRevalidating.isRefreshing, false, 'background refresh must not announce a loading state');
assert.deepEqual(silentlyRevalidating.data, ['first']);

const refreshed = cachedResourceReducer(refreshing, {
  type: 'requestSucceeded',
  data: ['second'],
  savedAt: '2026-07-10T12:01:00.000Z',
});
assert.deepEqual(refreshed.data, ['second']);
assert.equal(refreshed.error, null);
assert.equal(refreshed.isRefreshing, false);

const refreshFailed = cachedResourceReducer(refreshing, {
  type: 'requestFailed',
  error: 'Network unavailable',
});
assert.deepEqual(refreshFailed.data, ['first']);
assert.equal(refreshFailed.error, 'Network unavailable');
assert.equal(refreshFailed.isInitialLoading, false);
assert.equal(refreshFailed.isRefreshing, false);

const initialFailed = cachedResourceReducer(initialLoading, {
  type: 'requestFailed',
  error: 'Request failed',
});
assert.equal(initialFailed.data, null);
assert.equal(initialFailed.error, 'Request failed');
assert.equal(initialFailed.isInitialLoading, false);
assert.equal(initialFailed.isRefreshing, false);

const serialized = serializeCacheEnvelope({ title: 'Cached title' }, '2026-07-10T12:02:00.000Z');
assert.deepEqual(parseCacheEnvelope<{ title: string }>(serialized), {
  data: { title: 'Cached title' },
  savedAt: '2026-07-10T12:02:00.000Z',
  version: 1,
});
assert.equal(parseCacheEnvelope('{malformed'), null);
assert.equal(
  parseCacheEnvelope(JSON.stringify({ data: ['old'], savedAt: '2026-07-10T12:00:00.000Z', version: 2 })),
  null,
);
assert.equal(parseCacheEnvelope(JSON.stringify({ data: ['missing timestamp'], version: 1 })), null);
assert.equal(parseCacheEnvelope(JSON.stringify({ data: ['bad timestamp'], savedAt: 'not-a-date', version: 1 })), null);
assert.equal(parseCacheEnvelope(JSON.stringify({ savedAt: '2026-07-10T12:00:00.000Z', version: 1 })), null);

const requestVersions = createRequestVersionGuard();
const firstRequest = requestVersions.begin();
assert.equal(requestVersions.isCurrent(firstRequest), true);
const retryRequest = requestVersions.begin();
assert.equal(requestVersions.isCurrent(firstRequest), false);
assert.equal(requestVersions.isCurrent(retryRequest), true);
requestVersions.invalidate();
assert.equal(requestVersions.isCurrent(retryRequest), false);

class MemoryStorage implements PersistedCacheStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }

  async getAllKeys() {
    return [...this.values.keys()];
  }

  async multiRemove(keys: readonly string[]) {
    keys.forEach((key) => this.values.delete(key));
  }
}

async function testPersistedCache() {
  const storage = new MemoryStorage();
  const privateKey = getPrivateCacheKey('user-a', 'library');
  const otherPrivateKey = getPrivateCacheKey('user-b', 'library');
  const publicKey = getPublicCacheKey('trending');

  assert.equal(privateKey, 'watchly:user:user-a:library');
  assert.equal(publicKey, 'watchly:public:trending');

  await writePersistedCache(privateKey, ['cached'], storage, '2026-07-10T12:03:00.000Z');
  await writePersistedCache(otherPrivateKey, ['other'], storage, '2026-07-10T12:03:00.000Z');
  await writePersistedCache(publicKey, ['public'], storage, '2026-07-10T12:03:00.000Z');
  assert.deepEqual(await readPersistedCache<string[]>(privateKey, storage), {
    data: ['cached'],
    savedAt: '2026-07-10T12:03:00.000Z',
    version: 1,
  });

  storage.values.set(getPublicCacheKey('broken'), '{broken');
  assert.equal(await readPersistedCache(getPublicCacheKey('broken'), storage), null);
  assert.equal(storage.values.has(getPublicCacheKey('broken')), false);

  await clearPrivateCacheForUser('user-a', storage);
  assert.equal(storage.values.has(privateKey), false);
  assert.equal(storage.values.has(otherPrivateKey), true);
  assert.equal(storage.values.has(publicKey), true);

  await removePersistedCache(publicKey, storage);
  assert.equal(storage.values.has(publicKey), false);

  await assert.rejects(
    writePersistedCache(getPrivateCacheKey('user-a', 'unsafe'), { firebaseIdToken: 'secret' }, storage),
    /authentication tokens/i,
  );
  await assert.rejects(
    writePersistedCache(getPublicCacheKey('not-json'), { value: undefined }, storage),
    /JSON-safe/i,
  );
  await assert.rejects(
    writePersistedCache(getPublicCacheKey('not-finite'), { value: Number.POSITIVE_INFINITY }, storage),
    /JSON-safe/i,
  );
}

void testPersistedCache()
  .then(() => console.log('Cached resource reducer QA passed.'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
