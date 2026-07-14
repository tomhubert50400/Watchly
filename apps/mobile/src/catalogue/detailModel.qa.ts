// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  formatFivePointRating,
  formatRuntime,
  getDetailRenderMode,
} from './detailModel';

assert.equal(formatRuntime(null), null);
assert.equal(formatRuntime(42), '42m');
assert.equal(formatRuntime(100), '1h 40m');
assert.equal(formatFivePointRating(8, 10), '4.0');
assert.equal(formatFivePointRating(4.5, 5), '4.5');

assert.equal(
  getDetailRenderMode({ hasData: false, hasError: false, isInitialLoading: true }),
  'loading',
);
assert.equal(
  getDetailRenderMode({ hasData: false, hasError: true, isInitialLoading: false }),
  'fullError',
);
assert.equal(
  getDetailRenderMode({ hasData: true, hasError: true, isInitialLoading: false }),
  'content',
);

console.log('Catalogue detail model QA passed.');