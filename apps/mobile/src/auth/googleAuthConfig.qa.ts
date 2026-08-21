// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const authCardSource = readFileSync(new URL('./ProfileAuthCard.tsx', import.meta.url), 'utf8');

assert.equal(
  authCardSource.includes('redirectUri: googleNativeRedirectUri'),
  false,
  'Google auth must derive its native redirect from the installed application ID',
);

const previousVariant = process.env.APP_VARIANT;
const previousPublicEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
process.env.APP_VARIANT = 'staging';
process.env.EXPO_PUBLIC_APP_ENV = 'staging';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configureApp = require('../../app.config.js');
const stagingConfig = configureApp({
  config: {
    android: { package: 'com.tom.tvapp.dev' },
    ios: { bundleIdentifier: 'com.tom.tvapp.dev' },
    scheme: ['tvapp', 'com.tom.tvapp.dev'],
  },
});

if (previousVariant === undefined) delete process.env.APP_VARIANT;
else process.env.APP_VARIANT = previousVariant;
if (previousPublicEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
else process.env.EXPO_PUBLIC_APP_ENV = previousPublicEnvironment;

assert.deepEqual(
  stagingConfig.scheme,
  [
    'tvapp',
    'com.tom.tvapp.staging',
    'msauth.com.tom.tvapp.staging',
    'discord-1539925787333890090',
  ],
  'The staging build must register its OAuth redirect schemes',
);

console.log('Google auth config QA passed.');
