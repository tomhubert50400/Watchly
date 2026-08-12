// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';

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

console.log('Mobile error tracking QA passed.');
