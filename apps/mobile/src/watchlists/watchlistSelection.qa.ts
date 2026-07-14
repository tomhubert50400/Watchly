// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  autoSelectCreatedWatchlist,
  buildSelectionDiff,
  buildSelectionLabel,
  rollbackSelection,
} from './watchlistSelection';

function keys(...values: string[]) {
  return new Set(values);
}

assert.equal(buildSelectionLabel(keys(), keys('personal:a')), 'Add to 1 list');
assert.equal(
  buildSelectionLabel(keys(), keys('personal:a', 'shared:b', 'shared:c')),
  'Add to 3 lists',
);
assert.equal(buildSelectionLabel(keys('personal:a'), keys('personal:a', 'shared:b')), 'Save changes');
assert.equal(buildSelectionLabel(keys('shared:b'), keys()), 'Save changes');
assert.equal(buildSelectionLabel(keys(), keys()), 'Save changes');

assert.deepEqual(buildSelectionDiff(keys('personal:a', 'shared:b'), keys('shared:b', 'personal:c')), {
  addedKeys: ['personal:c'],
  removedKeys: ['personal:a'],
});

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
