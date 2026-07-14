// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { createTrackingStateMemoryCache } from './trackingStateMemoryCache';

const cache = createTrackingStateMemoryCache<string>(2);
cache.set('user-a', 'movie', 1, 'first');
cache.set('user-a', 'movie', 2, 'second');
cache.get('user-a', 'movie', 1);
cache.set('user-a', 'movie', 3, 'third');
assert.equal(cache.has('user-a', 'movie', 2), false, 'least-recently-used tracking state must be evicted at the bound');
assert.equal(cache.has('user-a', 'movie', 1), true);
assert.equal(cache.size(), 2);
cache.clearUser('user-a');
assert.equal(cache.size(), 0, 'sign-out must remove process-lifetime tracking state for that owner');

console.log('Tracking state memory cache QA passed.');
