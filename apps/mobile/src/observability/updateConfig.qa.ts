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
