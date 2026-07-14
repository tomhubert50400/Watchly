// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { resolveContinueWatchingLayout } from './continueWatchingLayout';

assert.deepEqual(resolveContinueWatchingLayout(1), {
  artworkMinHeight: 146,
  cardWidth: 266,
  metaNumberOfLines: 1,
  titleNumberOfLines: 1,
});

assert.deepEqual(resolveContinueWatchingLayout(2), {
  artworkMinHeight: 210,
  cardWidth: 300,
  metaNumberOfLines: 2,
  titleNumberOfLines: 2,
});

assert.deepEqual(resolveContinueWatchingLayout(3.2), {
  artworkMinHeight: 280,
  cardWidth: 320,
  metaNumberOfLines: 2,
  titleNumberOfLines: 2,
});

console.log('Continue Watching Dynamic Type layout QA passed.');
