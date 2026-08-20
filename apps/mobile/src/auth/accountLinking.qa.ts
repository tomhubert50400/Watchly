// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const contextSource = readFileSync(new URL('./AuthSessionContext.tsx', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');

for (const provider of ['Google', 'Apple', 'Microsoft']) {
  assert.match(firebaseSource, new RegExp(`linkWith${provider}`));
}
for (const provider of ['Google', 'Apple', 'Microsoft', 'Discord']) {
  assert.match(settingsSource, new RegExp(provider));
}
assert.doesNotMatch(settingsSource, /Facebook|FACEBOOK/);
assert.match(contextSource, /ACCOUNT_LINK_REQUIRED/);
assert.match(contextSource, /completeExternalOAuthLink/);
assert.match(contextSource, /linkWithPendingFirebaseCredential/);
assert.match(firebaseSource, /auth\/account-exists-with-different-credential/);
assert.doesNotMatch(
  contextSource,
  /AsyncStorage/,
  'pending native provider credentials must remain in memory',
);

console.log('Account linking mobile QA passed.');
