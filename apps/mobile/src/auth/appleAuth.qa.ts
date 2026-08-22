// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const appConfig = JSON.parse(
  readFileSync(new URL('../../app.json', import.meta.url), 'utf8'),
) as { expo: { ios?: { usesAppleSignIn?: boolean }; plugins?: unknown[] } };
const appleLogo = readFileSync(new URL('../../assets/apple-signin-logo-black-44.png', import.meta.url));
const easConfig = JSON.parse(
  readFileSync(new URL('../../eas.json', import.meta.url), 'utf8'),
) as {
  build: Record<string, {
    developmentClient?: boolean;
    env?: Record<string, string>;
    extends?: string;
  }>;
};
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
  /function AppleSignInButton/,
  'Apple sign-in must use the dedicated compliant button presentation',
);
assert.match(authCardSource, /apple-signin-logo-black-44\.png/);
assert(appleLogo.length > 0, 'the official Apple sign-in logo asset must be present');
assert.doesNotMatch(authCardSource, /AppleAuthentication\.AppleAuthenticationButton/);
assert.match(authCardSource, /appleButton: \{[^}]*height: 50/);
assert.match(authCardSource, /appleButtonBorder: \{[^}]*borderWidth: 1/);
assert.match(authCardSource, /appleButtonLabel: \{[^}]*fontSize: 14/);
assert.match(authCardSource, /AppleAuthenticationScope\.EMAIL/);
assert.match(authCardSource, /AppleAuthenticationScope\.FULL_NAME/);
assert.match(firebaseSource, /new OAuthProvider\('apple\.com'\)/);
assert.match(firebaseSource, /rawNonce/);
assert.match(firebaseSource, /linkWithCredential/);
assert.match(firebaseSource, /reauthenticateWithCredential/);
assert.match(firebaseSource, /accounts:revokeToken/);
assert.match(firebaseSource, /tokenType: 'CODE'/);
assert.match(settingsSource, /linkApple/);
assert.match(settingsSource, /AppleAuthenticationButton/);
assert.match(settingsSource, /authorizationCode/);
assert.match(settingsSource, /reauthenticateAndRevokeApple/);

const stagingDevelopmentProfile = easConfig.build['staging-development'];
assert.equal(stagingDevelopmentProfile.extends, 'staging');
assert.equal(stagingDevelopmentProfile.developmentClient, true);
assert.equal(stagingDevelopmentProfile.env?.APP_VARIANT, 'staging');
assert.equal(stagingDevelopmentProfile.env?.EXPO_PUBLIC_APP_ENV, 'staging');
assert.equal(stagingDevelopmentProfile.env?.WATCHLY_DEV_CLIENT, 'true');

const previousVariant = process.env.APP_VARIANT;
const previousPublicEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
const previousDevClient = process.env.WATCHLY_DEV_CLIENT;
process.env.APP_VARIANT = 'staging';
process.env.EXPO_PUBLIC_APP_ENV = 'staging';
process.env.WATCHLY_DEV_CLIENT = 'true';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configureApp = require('../../app.config.js');
const stagingDevelopmentConfig = configureApp({
  config: {
    ios: {
      bundleIdentifier: 'com.tom.tvapp.dev',
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
        NSLocalNetworkUsageDescription: 'Watchly connects to Metro during development.',
      },
    },
  },
});

restoreEnvironment('APP_VARIANT', previousVariant);
restoreEnvironment('EXPO_PUBLIC_APP_ENV', previousPublicEnvironment);
restoreEnvironment('WATCHLY_DEV_CLIENT', previousDevClient);

assert.equal(
  stagingDevelopmentConfig.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking,
  true,
);
assert.match(
  stagingDevelopmentConfig.ios.infoPlist.NSLocalNetworkUsageDescription,
  /Metro/,
);

console.log('Apple auth QA passed.');

function restoreEnvironment(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
