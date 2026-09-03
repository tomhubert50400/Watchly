import assert from 'node:assert/strict';
import {
  getUserDataRevision,
  notifyUserDataChanged,
  subscribeToUserData,
} from './userDataEvents';

const opinionsBefore = getUserDataRevision(['opinions']);
const progressBefore = getUserDataRevision(['episodeProgress']);
let opinionNotifications = 0;
let combinedNotifications = 0;
const unsubscribeOpinions = subscribeToUserData(['opinions'], () => {
  opinionNotifications += 1;
});
const unsubscribeCombined = subscribeToUserData(['opinions', 'episodeProgress'], () => {
  combinedNotifications += 1;
});

notifyUserDataChanged('opinions');
assert.notEqual(getUserDataRevision(['opinions']), opinionsBefore);
assert.equal(getUserDataRevision(['episodeProgress']), progressBefore);
assert.equal(opinionNotifications, 1);
assert.equal(combinedNotifications, 1);

notifyUserDataChanged('opinions', 'episodeProgress', 'opinions');
assert.equal(opinionNotifications, 2);
assert.equal(combinedNotifications, 2, 'A combined subscriber should run once per mutation batch.');

unsubscribeOpinions();
unsubscribeCombined();
notifyUserDataChanged('opinions');
assert.equal(opinionNotifications, 2);
assert.equal(combinedNotifications, 2);

console.log('user data event QA passed');
