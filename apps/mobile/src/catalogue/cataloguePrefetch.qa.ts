// Node types are intentionally excluded from the Expo runtime config.
// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { getEpisodeResourceKey, getSeasonResourceKey } from './cataloguePrefetch';
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

console.log('Catalogue prefetch QA passed.');
