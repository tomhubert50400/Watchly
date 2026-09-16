// @ts-expect-error QA runs in Node, outside the Expo type configuration.
import assert from 'node:assert/strict';
import { canReuseProgress, loadProgressEntries, ProgressCacheEntry } from './progressLoader';
import type { ProgressItem } from './progressModel';
import type { LibraryMediaItem } from './useLibraryData';

const sources = Array.from({ length: 69 }, (_, index) => ({ key: `series:${index}`, updatedAt: '2026-09-13T00:00:00Z' } as LibraryMediaItem));
const result = (media: LibraryMediaItem) => ({ media, error: null, remainingEpisodes: [] } as unknown as ProgressItem);

async function main() {
  let active = true;
  let calls = 0;
  const delivered: ProgressItem[] = [];
  const pending: Array<() => void> = [];
  let finished = false;
  const loading = loadProgressEntries(sources, {
    force: false, cached: () => undefined, isCurrent: () => active,
    load: (source) => { calls++; return new Promise((resolve) => pending.push(() => resolve(result(source)))); },
    onItem: (item) => { delivered.push(item); },
  }).then(() => { finished = true; });
  assert.equal(calls, 2, 'only two series may load concurrently, regardless of library size');
  pending[0]!();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(delivered.length, 1, 'the first card is delivered before the rest of the library');
  assert.equal(finished, false);
  assert.equal(calls, 3, 'one completed slot can start the next series');
  active = false;
  pending[1]!(); pending[2]!();
  await loading;
  assert.equal(calls, 3, 'leaving the screen must not start the remaining 66 series');
  assert.equal(delivered.length, 1, 'late results cannot update a departed screen');

  const cache = new Map<string, ProgressCacheEntry>(sources.map((source) => [source.key, { item: result(source), savedAt: Date.now() }]));
  calls = 0;
  const options = {
    force: false, cached: (key: string) => cache.get(key), isCurrent: () => true,
    load: async (source: LibraryMediaItem) => { calls++; return result(source); },
    onItem: () => undefined,
  };
  await loadProgressEntries(sources, options);
  assert.equal(calls, 0, 'returning to 69 fresh series must make no private API requests');
  await loadProgressEntries([{ ...sources[0]!, updatedAt: '2026-09-13T01:00:00Z' }, ...sources.slice(1)], options);
  assert.equal(calls, 1, 'watching an episode refreshes only its series');
  assert.equal(canReuseProgress({ item: result(sources[0]!), savedAt: 0 }, sources[0]!, 300001), false);
  assert.equal(canReuseProgress({ item: { ...result(sources[0]!), error: 'offline' }, savedAt: Date.now() }, sources[0]!), false);
  calls = 0;
  await loadProgressEntries(sources.slice(0, 2), { ...options, force: true });
  assert.equal(calls, 2, 'explicit refresh must bypass fresh entries');
  calls = 0;
  await loadProgressEntries(sources, { ...options, force: true, onlyKey: sources[35]!.key });
  assert.equal(calls, 1, 'retrying one card must not reload the other 68 series');
  assert.equal(canReuseProgress({ item: { ...result(sources[0]!), remainingEpisodes: undefined }, savedAt: Date.now() }, sources[0]!), false, 'older cache entries must prepare the local episode sequence');
  console.log('Progress progressive loading, cancellation and cache QA passed.');
}
void main();
