// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const appConfig = JSON.parse(
  readFileSync(new URL('../../app.json', import.meta.url), 'utf8'),
) as { expo: { ios?: { usesAppleSignIn?: boolean }; plugins?: unknown[] } };
const authCardSource = readFileSync(new URL('./ProfileAuthCard.tsx', import.meta.url), 'utf8');
const firebaseSource = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');

assert.equal(appConfig.expo.ios?.usesAppleSignIn, true, 'the iOS build must enable the Apple Sign-In entitlement');
assert(
  appConfig.expo.plugins?.includes('expo-apple-authentication'),
  'the native Apple authentication config plugin must be enabled',
);
assert.match(
  authCardSource,
  /AppleAuthenticationButton/,
  'Apple sign-in must use the official Apple button component',
);
assert.match(authCardSource, /AppleAuthenticationScope\.EMAIL/);
assert.match(authCardSource, /AppleAuthenticationScope\.FULL_NAME/);
assert.match(firebaseSource, /new OAuthProvider\('apple\.com'\)/);
assert.match(firebaseSource, /rawNonce/);
assert.match(firebaseSource, /linkWithCredential/);
assert.match(settingsSource, /linkApple/);
assert.match(settingsSource, /AppleAuthenticationButton/);

console.log('Apple auth QA passed.');
