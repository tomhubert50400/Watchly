// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  formatDetailDate,
  formatFivePointRating,
  formatMoney,
  formatRuntime,
  getDistinctOriginalTitle,
  getDetailRenderMode,
} from './detailModel';

assert.equal(formatDetailDate(null), null);
assert.equal(formatDetailDate('invalid'), null);
assert.equal(formatDetailDate('2026-05-13'), 'May 13, 2026');
assert.equal(formatRuntime(null), null);
assert.equal(formatRuntime(42), '42m');
assert.equal(formatRuntime(100), '1h 40m');
assert.equal(formatFivePointRating(8, 10), '4.0');
assert.equal(formatFivePointRating(4.5, 5), '4.5');
assert.equal(formatMoney(null), null);
assert.equal(formatMoney(0), null);
assert.equal(formatMoney(63000000), '$63M');
assert.equal(formatMoney(1200000000), '$1.2B');
assert.equal(getDistinctOriginalTitle('The Matrix', 'The Matrix'), null);
assert.equal(getDistinctOriginalTitle('Le fabuleux destin', 'Amelie'), 'Le fabuleux destin');

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
