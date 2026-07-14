// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { createRequestCoalescer, takeHydrationItems } from './requestBoundaries';

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

  console.log('Request boundaries QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
