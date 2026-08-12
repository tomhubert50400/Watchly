import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  createRequestObservabilityMiddleware,
  getRequestPath,
} from './request-observability.middleware';
import { resolveRequestId, runWithRequestContext } from './request-context';
import { redactSensitiveText, StructuredLogger } from './structured-logger';

const validRequestId = 'watchly-request-123';
assert.equal(resolveRequestId(validRequestId), validRequestId);
assert.notEqual(resolveRequestId('bad\nrequest'), 'bad\nrequest');
assert.match(resolveRequestId(undefined), /^[0-9a-f-]{36}$/);

const redacted = redactSensitiveText(
  'postgresql://watchly:database-secret@db.internal/app token=secret-token Bearer secret-bearer',
);
assert(!redacted.includes('database-secret'));
assert(!redacted.includes('secret-token'));
assert(!redacted.includes('secret-bearer'));

const lines: string[] = [];
const logger = new StructuredLogger('staging', (line) => lines.push(line));
runWithRequestContext(validRequestId, () => {
  logger.log({ password: 'must-not-be-serialized' }, 'ObservabilityQa');
});

const applicationLog = JSON.parse(lines.shift() ?? '{}');
assert.equal(applicationLog.environment, 'staging');
assert.equal(applicationLog.requestId, validRequestId);
assert.equal(applicationLog.message, '[Object]');
assert(!JSON.stringify(applicationLog).includes('must-not-be-serialized'));

class FakeResponse extends EventEmitter {
  headers = new Map<string, string>();
  statusCode = 200;

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
}

const response = new FakeResponse();
let currentTime = 100;
let continued = false;
const middleware = createRequestObservabilityMiddleware(logger, () => currentTime);

middleware(
  {
    headers: { authorization: 'Bearer must-not-be-logged', 'x-request-id': validRequestId },
    method: 'GET',
    originalUrl: '/catalog/trending?token=must-not-be-logged',
  },
  response,
  () => {
    continued = true;
  },
);

currentTime = 142;
response.emit('finish');

assert(continued);
assert.equal(response.headers.get('X-Request-Id'), validRequestId);
assert.equal(getRequestPath({ originalUrl: '/health?secret=value' }), '/health');

const requestLog = JSON.parse(lines.shift() ?? '{}');
assert.equal(requestLog.durationMs, 42);
assert.equal(requestLog.event, 'http.request');
assert.equal(requestLog.path, '/catalog/trending');
assert.equal(requestLog.requestId, validRequestId);
assert.equal(requestLog.statusCode, 200);
assert(!JSON.stringify(requestLog).includes('must-not-be-logged'));

console.log('Observability QA passed.');
