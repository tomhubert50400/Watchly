// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { authProviders, getAuthProviders } from './providerConfig';

assert.deepEqual(
  authProviders.map((provider) => provider.name),
  ['Google', 'Apple', 'Microsoft', 'Discord'],
  'the visitor profile must keep every approved provider visible and ordered',
);
assert.deepEqual(
  authProviders.filter((provider) => provider.isWired).map((provider) => provider.name),
  ['Google', 'Apple'],
  'local development must not advertise providers that require the staging token signer',
);
assert.deepEqual(
  getAuthProviders('staging').filter((provider) => provider.isWired).map((provider) => provider.name),
  ['Google', 'Apple', 'Microsoft', 'Discord'],
  'the validated staging environment must expose every approved provider',
);
assert.deepEqual(
  authProviders.filter((provider) => provider.presentation === 'primary').map((provider) => provider.name),
  ['Google', 'Apple'],
  'Google and Apple remain the two full-width actions',
);

console.log('Profile provider config QA passed.');
