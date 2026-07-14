// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { getReleaseAlertControlPresentation } from './releaseAlertControlState';

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
