// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const contextSource = readFileSync(new URL('./AuthSessionContext.tsx', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');

for (const provider of ['Google', 'Apple']) {
  assert.match(firebaseSource, new RegExp(`linkWith${provider}`));
}
for (const provider of ['Google', 'Apple', 'Microsoft', 'Discord']) {
  assert.match(settingsSource, new RegExp(provider));
  assert.match(
    settingsSource,
    new RegExp(`ConnectedProviderRow[^>]*name="${provider}"`),
    `${provider} must use the shared connected-provider presentation`,
  );
}
assert.doesNotMatch(settingsSource, /Facebook|FACEBOOK/);
assert.doesNotMatch(settingsSource, /(Google|Microsoft|Discord) connected/);
assert.match(settingsSource, /function ConnectedProviderRow/);
assert.match(settingsSource, /Connected to this Watchly account\./);
assert.match(settingsSource, /connectedPillText}>Connected</);
assert.match(contextSource, /ACCOUNT_LINK_REQUIRED/);
assert.match(contextSource, /completeExternalOAuthLink/);
assert.match(contextSource, /createMicrosoftOAuthTicket/);
assert.match(contextSource, /linkWithPendingFirebaseCredential/);
assert.match(firebaseSource, /auth\/account-exists-with-different-credential/);
assert.doesNotMatch(
  contextSource,
  /AsyncStorage/,
  'pending native provider credentials must remain in memory',
);

console.log('Account linking mobile QA passed.');
