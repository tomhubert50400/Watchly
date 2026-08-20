// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(new URL('../api/externalAuth.ts', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('./AuthSessionContext.tsx', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
const oauthSource = readFileSync(new URL('./externalOAuth.ts', import.meta.url), 'utf8');

assert.match(oauthSource, /openAuthSessionAsync/);
assert.match(apiSource, /\/auth\/oauth\/exchange/);
assert.match(apiSource, /\/auth\/oauth\/link/);
assert.match(firebaseSource, /signInWithCustomToken/);
assert.match(contextSource, /pendingAccountLinkRef/);
assert.doesNotMatch(apiSource, /facebook/i);
assert.doesNotMatch(oauthSource, /facebook/i);
assert.doesNotMatch(
  contextSource,
  /AsyncStorage/,
  'pending provider tickets must remain in memory and disappear when the app process exits',
);

console.log('External OAuth mobile QA passed.');
