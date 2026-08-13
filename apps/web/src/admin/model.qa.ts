import assert from 'node:assert/strict';
import { getEnforcementAction, getModerationActions, getPersonLabel } from './model';

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
assert.equal(getEnforcementAction('profile', 'active')?.action, 'suspendUser');
assert.equal(getEnforcementAction('profile', 'suspended')?.action, 'reactivateUser');
assert.equal(getEnforcementAction('movieReview', 'visible')?.action, 'hideContent');
assert.equal(getEnforcementAction('episodeReview', 'hidden')?.action, 'restoreContent');
assert.equal(getEnforcementAction('movieReview', 'unavailable'), null);

console.log('Admin model QA passed.');
