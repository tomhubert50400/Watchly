// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  createRequestCoalescer,
  loadProgressively,
  takeHydrationItems,
} from './requestBoundaries';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function run() {
  const twenty = Array.from({ length: 20 }, (_, index) => index);
  assert.deepEqual(takeHydrationItems(twenty, 12), twenty.slice(0, 12));

  let calls = 0;
  const load = createRequestCoalescer(async (key: string) => {
    calls += 1;
    await Promise.resolve();
    return `poster:${key}`;
  });
  const values = await Promise.all([load('movie:1'), load('movie:1'), load('series:2')]);
  assert.deepEqual(values, ['poster:movie:1', 'poster:movie:1', 'poster:series:2']);
  assert.equal(calls, 2, 'duplicate media hydration must share one request');

  const pending = new Map([
    ['personal:a', deferred<string>()],
    ['personal:b', deferred<string>()],
    ['shared:c', deferred<string>()],
  ]);
  const started: string[] = [];
  const loaded: string[] = [];
  const progressiveLoad = loadProgressively({
    concurrency: 2,
    items: [...pending.keys()],
    load: async (key) => {
      started.push(key);
      return pending.get(key)!.promise;
    },
    onLoaded: (value) => loaded.push(value),
  });

  await flushMicrotasks();
  assert.deepEqual(started, ['personal:a', 'personal:b']);

  pending.get('personal:a')!.resolve('preview:a');
  await flushMicrotasks();
  assert.deepEqual(loaded, ['preview:a'], 'a completed preview must render before slower peers');
  assert.deepEqual(started, ['personal:a', 'personal:b', 'shared:c']);

  pending.get('shared:c')!.resolve('preview:c');
  pending.get('personal:b')!.resolve('preview:b');
  await progressiveLoad;
  assert.deepEqual(loaded.sort(), ['preview:a', 'preview:b', 'preview:c']);

  console.log('Request boundaries QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
