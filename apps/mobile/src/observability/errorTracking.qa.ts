// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';
import {
  createMobileMonitoringProbeError,
  getMobileMonitoringProbeStorageKey,
  resolveMobileMonitoringProbeId,
} from './mobileMonitoringProbe';

const event = sanitizeMobileErrorEvent({
  request: {
    cookies: 'session=secret',
    data: { password: 'secret' },
    headers: { authorization: 'Bearer secret' },
    query_string: 'token=secret',
    url: 'https://watchly.example/path?token=secret',
  },
  user: { email: 'private@example.com' },
});

assert.deepEqual(event, {
  request: {
    url: 'https://watchly.example/path',
  },
});

assert.equal(resolveMobileMonitoringProbeId('production', 'p0.1'), null);
assert.equal(resolveMobileMonitoringProbeId('staging', '  p0.1  '), 'p0.1');
assert.equal(resolveMobileMonitoringProbeId('staging', '   '), null);
assert.equal(
  getMobileMonitoringProbeStorageKey('p0.1 mobile'),
  'watchly:monitoring-probe:p0.1%20mobile',
);

const probeError = createMobileMonitoringProbeError();
assert.equal(probeError.name, 'WatchlyMobileMonitoringProbeError');
assert.equal(probeError.message, 'Watchly staging mobile monitoring probe');

console.log('Mobile error tracking QA passed.');
