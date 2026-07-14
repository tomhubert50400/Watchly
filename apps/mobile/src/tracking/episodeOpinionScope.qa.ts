// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { buildEpisodeOpinionResourceKey } from './episodeOpinionScope';

const first = buildEpisodeOpinionResourceKey('user-a', 1399, 1, 1);
assert.notEqual(
  first,
  buildEpisodeOpinionResourceKey('user-a', 1399, 1, 2),
  'episodes with the same display label must not share request identity',
);
assert.notEqual(
  first,
  buildEpisodeOpinionResourceKey('user-b', 1399, 1, 1),
  'episode opinion request identity must be owner-scoped',
);
assert.equal(first, 'user-a:series:1399:season:1:episode:1');

console.log('Episode opinion scope QA passed.');
