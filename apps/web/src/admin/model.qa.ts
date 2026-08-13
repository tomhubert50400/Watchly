import assert from 'node:assert/strict';
import { getModerationActions, getPersonLabel } from './model';

assert.deepEqual(
  getModerationActions('new').map((action) => action.status),
  ['inProgress', 'resolved', 'rejected'],
);
assert.deepEqual(
  getModerationActions('resolved').map((action) => action.status),
  ['inProgress'],
);
assert.equal(getPersonLabel({ displayName: 'Ada', handle: 'ada' }), 'Ada (@ada)');
assert.equal(getPersonLabel({ displayName: null, handle: null }), 'Unnamed member');

console.log('Admin model QA passed.');
