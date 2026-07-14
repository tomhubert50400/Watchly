// Node types are intentionally excluded from the Expo runtime config.
// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import {
  clearMemoryResourceCache,
  createMemoryResourceCache,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
} from './memoryResourceCache';

async function run() {
  const cache = createMemoryResourceCache(2);
  cache.set('a', { value: 1 }, '2026-07-11T00:00:00.000Z');
  assert.deepEqual(cache.get<{ value: number }>('a')?.data, { value: 1 }, 'memory data must be readable synchronously');
  cache.set('b', { value: 2 }, '2026-07-11T00:00:01.000Z');
  cache.get('a');
  cache.set('c', { value: 3 }, '2026-07-11T00:00:02.000Z');
  assert.equal(cache.get('b'), null, 'least recently used entries must be evicted');
  assert.ok(cache.get('a'), 'recently read entries must remain cached');
  assert.ok(cache.get('c'), 'new entries must remain cached');
  assert.equal(isMemoryResourceFresh('2026-07-11T12:00:00.000Z', 300_000, Date.parse('2026-07-11T12:04:59.000Z')), true);
  assert.equal(isMemoryResourceFresh('2026-07-11T12:00:00.000Z', 300_000, Date.parse('2026-07-11T12:05:00.000Z')), false);
  assert.equal(isMemoryResourceFresh('invalid', 300_000, Date.now()), false);
  assert.equal(isMemoryResourceFresh('2026-07-11T12:00:00.000Z', 0, Date.parse('2026-07-11T12:00:00.000Z')), false);

  cache.set('watchly:user:user-a:library', ['private-a'], '2026-07-11T00:00:03.000Z');
  cache.set('watchly:user:user-b:library', ['private-b'], '2026-07-11T00:00:04.000Z');
  cache.deleteWithPrefix('watchly:user:user-a:');
  assert.equal(cache.get('watchly:user:user-a:library'), null, 'signed-out user data must leave memory');
  assert.ok(cache.get('watchly:user:user-b:library'), 'other user scopes must remain isolated');

  clearMemoryResourceCache();
  let requestCount = 0;
  let resolveRequest!: (value: { value: number }) => void;
  const loader = () => {
    requestCount += 1;
    return new Promise<{ value: number }>((resolve) => { resolveRequest = resolve; });
  };
  const first = getOrCreateResourceRequest('shared', loader);
  const second = getOrCreateResourceRequest('shared', loader);
  assert.equal(first, second, 'concurrent requests for the same resource must share one promise');
  assert.equal(requestCount, 1, 'the loader must run once while a request is in flight');
  resolveRequest({ value: 4 });
  assert.deepEqual(await first, { value: 4 });
  await Promise.resolve();
  const third = getOrCreateResourceRequest('shared', loader);
  assert.notEqual(third, first, 'a completed request must not remain pinned in flight');
  assert.equal(requestCount, 2);
  resolveRequest({ value: 5 });
  await third;

  console.log('Memory resource cache QA passed.');
}

void run();
