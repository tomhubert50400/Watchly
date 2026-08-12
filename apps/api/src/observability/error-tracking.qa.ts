import assert from 'node:assert/strict';
import { isMonitoringKeyValid } from './monitoring-key';
import { sanitizeErrorEvent } from './error-tracking';

const event = sanitizeErrorEvent({
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

const key = 'a'.repeat(32);
assert(isMonitoringKeyValid(key, key));
assert(!isMonitoringKeyValid('b'.repeat(32), key));
assert(!isMonitoringKeyValid('short', key));
assert(!isMonitoringKeyValid(undefined, key));

console.log('Error tracking QA passed.');
