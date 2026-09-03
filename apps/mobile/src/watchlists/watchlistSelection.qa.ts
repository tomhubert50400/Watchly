// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  autoSelectCreatedWatchlist,
  rollbackSelection,
} from './watchlistSelection';

function keys(...values: string[]) {
  return new Set(values);
}

assert.deepEqual(
  [...autoSelectCreatedWatchlist(keys('personal:a'), 'shared:new')].sort(),
  ['personal:a', 'shared:new'],
);

const initial = keys('personal:a', 'shared:b');
const rolledBack = rollbackSelection(initial);
assert.deepEqual([...rolledBack].sort(), ['personal:a', 'shared:b']);
rolledBack.delete('personal:a');
assert.equal(initial.has('personal:a'), true, 'rollback must return an independent initial snapshot');

console.log('Watchlist selection QA passed.');
