// Node types are intentionally excluded from the Expo runtime config.
// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { getEpisodeResourceKey, getSeasonResourceKey } from './cataloguePrefetch';

assert.equal(getSeasonResourceKey(1399, 2), 'watchly:public:catalogue:series:1399:season:2');
assert.equal(
  getEpisodeResourceKey(1399, 2, 3),
  'watchly:public:catalogue:series:1399:season:2:episode:3',
);
assert.throws(() => getSeasonResourceKey(0, 1), /positive/);
assert.throws(() => getEpisodeResourceKey(1, -1, 1), /non-negative/);

console.log('Catalogue prefetch QA passed.');
