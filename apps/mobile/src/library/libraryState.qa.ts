// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  replaceOwnedData,
  rollbackAlertValue,
  rollbackRemovedList,
  updateOwnedData,
} from './libraryState';

type Data = {
  items: Array<{ hasReleaseAlert: boolean; key: string; title: string }>;
  lists: Array<{ key: string; name: string }>;
};

const dataA: Data = { items: [{ hasReleaseAlert: false, key: 'movie:1', title: 'A' }], lists: [] };
const staleA = { data: dataA, ownerId: 'user-a' };
assert.equal(
  replaceOwnedData(null, 'user-b', staleA.ownerId, staleA.data),
  null,
  'resource data from A must never be retagged as B',
);

const dataB: Data = { items: [], lists: [{ key: 'personal:b', name: 'B' }] };
const ownedB = replaceOwnedData(null, 'user-b', 'user-b', dataB);
assert.deepEqual(ownedB, { data: dataB, ownerId: 'user-b' });
assert.equal(replaceOwnedData(ownedB, 'user-b', 'user-a', dataA), ownedB);
assert.equal(updateOwnedData(ownedB, 'user-a', () => dataA), ownedB, 'an A completion cannot mutate B state');

const refreshedAfterOptimisticAlert: Data = {
  items: [
    { hasReleaseAlert: true, key: 'movie:1', title: 'fresh title' },
    { hasReleaseAlert: false, key: 'movie:2', title: 'refresh-only' },
  ],
  lists: [{ key: 'personal:fresh', name: 'Fresh list' }],
};
assert.deepEqual(rollbackAlertValue(refreshedAfterOptimisticAlert, 'movie:1', true, false), {
  items: [
    { hasReleaseAlert: false, key: 'movie:1', title: 'fresh title' },
    { hasReleaseAlert: false, key: 'movie:2', title: 'refresh-only' },
  ],
  lists: [{ key: 'personal:fresh', name: 'Fresh list' }],
});
const alertAlreadyRefreshed = { ...refreshedAfterOptimisticAlert, items: [{ hasReleaseAlert: false, key: 'movie:1', title: 'fresh title' }] };
assert.equal(rollbackAlertValue(alertAlreadyRefreshed, 'movie:1', true, false), alertAlreadyRefreshed);

const removed = { key: 'personal:removed', name: 'Removed' };
assert.deepEqual(rollbackRemovedList(refreshedAfterOptimisticAlert, removed, 0), {
  ...refreshedAfterOptimisticAlert,
  lists: [removed, ...refreshedAfterOptimisticAlert.lists],
});
const refreshAlreadyRestored = { ...refreshedAfterOptimisticAlert, lists: [{ key: removed.key, name: 'Refreshed name' }] };
assert.equal(rollbackRemovedList(refreshAlreadyRestored, removed, 0), refreshAlreadyRestored);

console.log('Library owner state QA passed.');