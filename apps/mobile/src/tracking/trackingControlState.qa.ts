// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { buildTrackingMutation } from './trackingControlState';

const favoriteState = {
  favorite: true,
  status: 'watched' as const,
};

assert.equal(
  buildTrackingMutation({ isKnown: false, state: null }, 'watching'),
  null,
  'a failed initial load must not synthesize favorite=false and permit a destructive mutation',
);
assert.deepEqual(
  buildTrackingMutation({ isKnown: true, state: favoriteState }, 'watching'),
  { favorite: true, status: 'watching' },
  'a mutation from known state must preserve the loaded favorite flag',
);
assert.deepEqual(
  buildTrackingMutation({ isKnown: true, state: null }, 'watching'),
  { favorite: false, status: 'watching' },
  'a confirmed empty backend state may safely begin with favorite=false',
);

console.log('Tracking control state QA passed.');
