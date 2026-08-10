// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  getReleaseAlertControlPresentation,
  getReleaseAlertControlSession,
} from './releaseAlertControlState';

const initialSession = getReleaseAlertControlSession({
  contentType: 'movie',
  firebaseIdToken: 'token-a',
  tmdbId: 550,
  userId: 'user-a',
});
const refreshedTokenSession = getReleaseAlertControlSession({
  contentType: 'movie',
  firebaseIdToken: 'token-b',
  tmdbId: 550,
  userId: 'user-a',
});
assert.deepEqual(
  refreshedTokenSession,
  initialSession,
  'refreshing the Firebase token must not restart the release-alert control session',
);
assert.notEqual(
  getReleaseAlertControlSession({
    contentType: 'movie',
    firebaseIdToken: 'token-b',
    tmdbId: 551,
    userId: 'user-a',
  }).requestScope,
  initialSession.requestScope,
  'changing the title must start a new release-alert control session',
);

assert.deepEqual(
  getReleaseAlertControlPresentation('error', null),
  {
    accessibilityLabel: 'Release alert unavailable. Retry',
    action: 'retry',
    disabled: false,
    enabled: false,
  },
  'a failed load must be an explicit retry state, not a valid disabled alert state',
);
assert.deepEqual(
  getReleaseAlertControlPresentation('loading', null),
  {
    accessibilityLabel: 'Loading release alert',
    action: 'none',
    disabled: true,
    enabled: false,
  },
);
assert.equal(
  getReleaseAlertControlPresentation('ready', { enabled: true }).accessibilityLabel,
  'Disable release alert',
);

console.log('Release alert control state QA passed.');
