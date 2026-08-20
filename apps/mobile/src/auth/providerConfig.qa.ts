// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { authProviders } from './providerConfig';

assert.deepEqual(
  authProviders.map((provider) => provider.name),
  ['Google', 'Apple', 'Microsoft', 'Discord', 'Facebook'],
  'the visitor profile must keep every approved provider visible and ordered',
);
assert.deepEqual(
  authProviders.filter((provider) => provider.isWired).map((provider) => provider.name),
  ['Google', 'Apple', 'Microsoft'],
  'only genuinely connected providers may be marked wired',
);
assert.deepEqual(
  authProviders.filter((provider) => provider.presentation === 'primary').map((provider) => provider.name),
  ['Google', 'Apple'],
  'Google and Apple remain the two full-width actions',
);

console.log('Profile provider config QA passed.');
