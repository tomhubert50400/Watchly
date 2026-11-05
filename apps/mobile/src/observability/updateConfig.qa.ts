// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const config = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo;
const profiles = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8')).build;
const dependencies = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).dependencies;
const source = readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');
for (const variant of ['staging', 'production']) {
  const module = { exports: null as unknown as (input: { config: typeof config }) => typeof config };
  runInNewContext(source, { module, process: { env: {
    APP_VARIANT: variant, EXPO_PUBLIC_APP_ENV: variant, EXPO_PUBLIC_DISCORD_APPLICATION_ID: '123456789',
  } } });
  const resolved = module.exports({ config });
  assert.equal(resolved.extra.appEnvironment, variant);
  assert.equal(resolved.ios.bundleIdentifier, variant === 'staging' ? 'com.tom.tvapp.staging' : 'com.trywatchly.app');
  assert.equal(resolved.runtimeVersion.policy, 'fingerprint', 'native changes must invalidate update compatibility');
  assert.equal(resolved.updates.url, `https://u.expo.dev/${resolved.extra.eas.projectId}`);
}
assert.ok(dependencies['expo-updates'], 'the next native build must contain the update client');
assert.equal(profiles.staging.channel, 'staging');
assert.equal(profiles.staging.environment, 'preview');
assert.equal(profiles.production.channel, 'production');
assert.equal(profiles.production.environment, 'production');
assert.equal(profiles.testflight.extends, 'production');
assert.equal(profiles.testflight.channel ?? profiles.production.channel, 'production');
console.log('Update configuration QA passed: native compatibility, app identities and isolated staging/production channels.');

const trackingCode = ts.transpileModule(readFileSync(new URL('./errorTracking.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const nativeUpdatesAvailable of [false, true]) {
  let updatesLoads = 0;
  let errorHandlerLoads = 0;
  const tracking: Record<string, Function> = {};
  const defaults = [
    { name: 'ReactNativeErrorHandlers', setup: () => { errorHandlerLoads++; } },
    { name: 'ExpoUpdatesListener', setup: () => {
      if (!nativeUpdatesAvailable) throw new Error("Cannot find native module 'ExpoUpdates'");
      updatesLoads++;
    } },
  ];
  const modules: Record<string, unknown> = {
    '@react-native-async-storage/async-storage': {},
    '@sentry/react-native': { init: (options: { integrations?: (integrations: typeof defaults) => typeof defaults }) => {
      (options.integrations?.(defaults) ?? defaults).forEach(integration => integration.setup());
    } },
    expo: { requireOptionalNativeModule: (name: string) => {
      assert.equal(name, 'ExpoUpdates');
      return nativeUpdatesAvailable ? {} : null;
    } },
    '../config/publicEnv': { appEnvironment: 'staging', publicEnv: { EXPO_PUBLIC_ERROR_TRACKING_DSN: 'https://public@example.test/1' } },
    './errorTrackingEvent': { sanitizeMobileErrorEvent: (event: unknown) => event },
    './mobileMonitoringProbe': { resolveMobileMonitoringProbeId: () => null },
  };
  runInNewContext(trackingCode, { exports: tracking, require: (name: string) => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  assert.doesNotThrow(() => tracking.initializeErrorTracking(), 'older development clients must start without ExpoUpdates');
  assert.equal(errorHandlerLoads, 1, 'native update compatibility must not disable error monitoring');
  assert.equal(updatesLoads, nativeUpdatesAvailable ? 1 : 0, 'compatible builds retain update monitoring');
}
console.log('Update startup QA passed: old development clients, native update builds and retained error monitoring.');

const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const authCardSource = readFileSync(new URL('../auth/ProfileAuthCard.tsx', import.meta.url), 'utf8');
const versionSource = readFileSync(new URL('../components/AndroidVersionLabel.tsx', import.meta.url), 'utf8');
assert.match(settingsSource.slice(settingsSource.indexOf('if (!firebaseIdToken) {\n    return'), settingsSource.indexOf("if (status === 'loading' && !savedSettings)")), /<AndroidVersionLabel\s*\/>/, 'signed-out settings must show the version without an account');
assert.match(authCardSource, /\{embedded \? null : <AndroidVersionLabel\s*\/>\}/, 'standalone sign-in shows the version, embedded cards leave it to their host so it never appears twice');
assert.doesNotMatch(versionSource, /useAuthSession|firebaseIdToken/, 'the version label must not depend on authentication');
const versionCode = ts.transpileModule(versionSource.slice(
  versionSource.indexOf('function getAndroidVersionLabel()'),
  versionSource.indexOf('const styles ='),
) + '\ngetAndroidVersionLabel();', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const application = { nativeApplicationVersion: '1.0.0', nativeBuildVersion: '6' };
const runningUpdate = {
  isEnabled: true, isEmbeddedLaunch: false,
  updateId: '01a133f5-76fc-7bf1-899c-5bd5f41fdda2',
  initialContext: { downloadedUpdate: { updateId: 'newer-but-not-running' } },
};
for (const test of [
  { dev: false, application, updates: runningUpdate, expected: 'APK 1.0.0 (6) · Update f41fdda2' },
  { dev: false, application, updates: { ...runningUpdate, isEmbeddedLaunch: true }, expected: 'APK 1.0.0 (6) · Original' },
  { dev: false, application, updates: { ...runningUpdate, isEnabled: false }, expected: 'APK 1.0.0 (6) · Original' },
  { dev: true, application, updates: runningUpdate, expected: 'APK 1.0.0 (6) · Development' },
  { dev: true, application: null, updates: null, expected: 'APK 2.0.0 · Development' },
]) {
  assert.equal(runInNewContext(versionCode, {
    __DEV__: test.dev,
    appConfig: { expo: { version: '2.0.0' } },
    requireOptionalNativeModule: (name: string) => name === 'ExpoApplication' ? test.application : test.updates,
  }), test.expected, 'settings must identify the installed APK and the running update, including embedded and development launches');
}
console.log('Settings version QA passed: native version, running update, embedded fallback and older development clients.');
