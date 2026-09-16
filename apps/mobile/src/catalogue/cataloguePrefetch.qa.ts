// Node types are intentionally excluded from the Expo runtime config.
// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { ensureSeasonDetails, getEpisodeResourceKey, getSeasonResourceKey } from './cataloguePrefetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearMemoryResourceCache, setMemoryResource } from '../cache/memoryResourceCache';
import { writePersistedCache } from '../cache/persistedCache';
import { browseQuery, browseResourceKey, collectionFilters } from '../api/discover';

assert.equal(getSeasonResourceKey(1399, 2), 'watchly:public:catalogue:series:1399:season:2:v2');
assert.equal(
  getEpisodeResourceKey(1399, 2, 3),
  'watchly:public:catalogue:series:1399:season:2:episode:3:v2',
);
assert.throws(() => getSeasonResourceKey(0, 1), /positive/);
assert.throws(() => getEpisodeResourceKey(1, -1, 1), /non-negative/);

assert.equal(browseResourceKey(collectionFilters('2000s')), browseResourceKey({ decade: 2000 }), 'A collection shortcut and its editable filters must share cached results.');
assert.equal(browseResourceKey({ mood: 'funny', decade: 2000 }), browseResourceKey({ decade: 2000, mood: 'funny' }), 'Filter order must not create duplicate preload requests.');
assert.notEqual(browseResourceKey({ decade: 1990 }), browseResourceKey({ decade: 2000 }));
assert.equal(browseQuery({ awards: false }), browseQuery({}));
assert.deepEqual(collectionFilters('animation'), { genre: 'animation' });
assert.deepEqual(collectionFilters('award-winners'), { awards: true });

async function verifySeasonRequests() {
  const stored = new Map<string, string>();
  const originalGet = AsyncStorage.getItem;
  const originalSet = AsyncStorage.setItem;
  const originalFetch = globalThis.fetch;
  const starts: number[] = [];
  let fail = false;
  try {
    AsyncStorage.getItem = async (key) => stored.get(key) ?? null;
    AsyncStorage.setItem = async (key, value) => { stored.set(key, value); };
    globalThis.fetch = async () => {
      starts.push(Date.now());
      return new Response(JSON.stringify(fail ? { message: 'Too many requests' } : { item: { episodes: [] } }), { status: fail ? 429 : 200 });
    };
    clearMemoryResourceCache();
    await Promise.all([ensureSeasonDetails(1, 1), ensureSeasonDetails(1, 1), ensureSeasonDetails(1, 2)]);
    assert.equal(starts.length, 2, 'concurrent callers must share each season request');
    assert.ok(starts[1]! - starts[0]! >= 700, 'different cold seasons must not burst into the API');
    for (let index = 0; index < 130; index++) setMemoryResource(`eviction:${index}`, {}, new Date().toISOString());
    await ensureSeasonDetails(1, 1);
    assert.equal(starts.length, 2, 'evicting a season from memory must reuse the persisted copy');
    clearMemoryResourceCache();
    await ensureSeasonDetails(1, 2);
    assert.equal(starts.length, 2, 'reloading the app must reuse fresh persisted seasons');
    await writePersistedCache(getSeasonResourceKey(1, 3), { item: { episodes: [] } }, undefined, new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString());
    await ensureSeasonDetails(1, 3);
    assert.equal(starts.length, 3, 'expired seasons must still refresh for newly aired episodes');
    fail = true;
    await assert.rejects(ensureSeasonDetails(1, 4), { status: 429 });
    assert.equal(stored.has(getSeasonResourceKey(1, 4)), false, '429 responses must never be cached');
    fail = false;
    await ensureSeasonDetails(1, 4);
    assert.equal(starts.length, 5, 'a failed request must leave the queue usable');
    console.log('Catalogue prefetch cache, eviction, reload and request pacing QA passed.');
  } finally {
    AsyncStorage.getItem = originalGet;
    AsyncStorage.setItem = originalSet;
    globalThis.fetch = originalFetch;
    clearMemoryResourceCache();
  }
}
void verifySeasonRequests();
