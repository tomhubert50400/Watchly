// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { clearMemoryResourceCache } from '../cache/memoryResourceCache';
import { loadCachedCatalogueResource } from './catalogueResourceCache';

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

  console.log('Catalogue resource cache QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
