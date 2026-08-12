// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';
import {
  createMobileMonitoringProbeError,
  getMobileMonitoringProbeStorageKey,
  getNativeCrashProbeStorageKey,
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
assert.equal(
  getNativeCrashProbeStorageKey('p0.1 native'),
  'watchly:native-crash-probe:p0.1%20native',
);

const probeError = createMobileMonitoringProbeError();
assert.equal(probeError.name, 'WatchlyMobileMonitoringProbeError');
assert.equal(probeError.message, 'Watchly staging mobile monitoring probe');

const errorTrackingSource = readFileSync(new URL('errorTracking.ts', import.meta.url), 'utf8');
assert.match(
  errorTrackingSource,
  /onReady:\s*\(\)\s*=>\s*\{\s*void runNativeCrashMonitoringProbe\(\)\.catch\(\(\) => undefined\);\s*\}/,
);

console.log('Mobile error tracking QA passed.');
