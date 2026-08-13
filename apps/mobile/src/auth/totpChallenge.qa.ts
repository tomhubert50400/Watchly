// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  getTotpErrorMessage,
  isValidTotpCode,
  normalizeTotpCode,
  selectTotpFactor,
} from './totpChallenge';

const factor = selectTotpFactor([
  { displayName: 'Phone', factorId: 'phone', uid: 'phone-id' },
  { displayName: 'Watchly Control', factorId: 'totp', uid: 'totp-id' },
]);

assert.deepEqual(factor, {
  displayName: 'Watchly Control',
  factorId: 'totp',
  uid: 'totp-id',
});
assert.equal(selectTotpFactor([]), null);

assert.equal(normalizeTotpCode(' 12a-34 567 '), '123456');
assert.equal(isValidTotpCode('123456'), true);
assert.equal(isValidTotpCode('12345'), false);
assert.equal(isValidTotpCode('12345a'), false);

assert.equal(
  getTotpErrorMessage({ code: 'auth/invalid-verification-code' }),
  'That code is not valid. Check your authenticator and try again.',
);
assert.equal(
  getTotpErrorMessage({ code: 'auth/invalid-multi-factor-session' }),
  'This verification request expired. Sign in with Google again.',
);
assert.equal(getTotpErrorMessage(new Error('network')), 'Could not verify that code. Try again.');

console.log('TOTP challenge QA passed.');
