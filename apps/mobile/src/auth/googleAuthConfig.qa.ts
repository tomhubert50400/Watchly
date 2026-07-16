// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { googleNativeRedirectUri } from './googleAuthConfig';

assert.equal(
  googleNativeRedirectUri,
  'com.tom.tvapp.dev:/auth',
  'Google native auth must use the registered reverse-DNS scheme with a single slash',
);
assert.equal(
  googleNativeRedirectUri.includes('://'),
  false,
  'Google rejects the double-slash native redirect used by the previous auth flow',
);

console.log('Google auth config QA passed.');
