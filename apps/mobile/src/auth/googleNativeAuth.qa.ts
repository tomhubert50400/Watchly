// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getMissingGoogleClientConfig, googleClientIds } from './googleAuthConfig';
import { publicEnv } from '../config/publicEnv';

const source = readFileSync(new URL('./googleNativeAuth.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function loadNativeAuth(platform: string, nativeModule: unknown) {
  const exports: Record<string, () => Promise<unknown>> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === 'expo') return { requireOptionalNativeModule: () => nativeModule };
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === './googleAuthConfig') return { getMissingGoogleClientConfig, googleClientIds };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

async function verify() {
  const savedIds = { ...googleClientIds };
  const projectNumber = publicEnv.EXPO_PUBLIC_FIREBASE_APP_ID?.split(':')[1];
  const webClientId = `${projectNumber}-web.apps.googleusercontent.com`;
  let result: string | null = 'google-id-token';
  let clearCount = 0;
  const nativeModule = {
    signIn: async (clientId: string) => {
      assert.equal(clientId, webClientId, 'native Google must request a token for the Firebase web client');
      return result;
    },
    clearSession: async () => { clearCount += 1; },
  };

  try {
    googleClientIds.androidClientId = undefined;
    googleClientIds.webClientId = webClientId;
    assert.deepEqual(getMissingGoogleClientConfig('android'), [], 'native Android uses the web audience, not a browser Android client');
    const auth = loadNativeAuth('android', nativeModule);
    assert.equal(await auth.requestNativeGoogleIdToken(), 'google-id-token');
    result = null;
    assert.equal(await auth.requestNativeGoogleIdToken(), null, 'closing the native chooser must cancel without signing in');
    await auth.clearNativeGoogleSession();
    assert.equal(clearCount, 1);
    await loadNativeAuth('ios', nativeModule).clearNativeGoogleSession();
    assert.equal(clearCount, 1, 'iOS must keep its existing session flow');
    await loadNativeAuth('android', null).clearNativeGoogleSession();
    await assert.rejects(loadNativeAuth('android', null).requestNativeGoogleIdToken(), /latest Watchly Android build/);
    googleClientIds.webClientId = undefined;
    assert.deepEqual(getMissingGoogleClientConfig('android'), ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID']);
    await assert.rejects(auth.requestNativeGoogleIdToken(), /EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID/);
    googleClientIds.webClientId = 'wrong-project.apps.googleusercontent.com';
    await assert.rejects(auth.requestNativeGoogleIdToken(), /Firebase project mismatch/);
    assert.deepEqual(getMissingGoogleClientConfig('ios'), [], 'Android configuration must not disable iOS');
  } finally {
    Object.assign(googleClientIds, savedIds);
  }

  for (const file of ['./ProfileAuthCard.tsx', '../profile/SettingsScreen.tsx']) {
    const consumer = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(consumer, /Platform\.OS === 'android'[\s\S]*await requestNativeGoogleIdToken\(\)/);
  }
  const moduleConfig = JSON.parse(readFileSync(new URL('../../modules/watchly-google-auth/expo-module.config.json', import.meta.url), 'utf8'));
  assert.deepEqual(moduleConfig.platforms, ['android']);
  const nativeSource = readFileSync(new URL('../../modules/watchly-google-auth/android/src/main/java/expo/modules/watchlygoogleauth/WatchlyGoogleAuthModule.kt', import.meta.url), 'utf8');
  assert.match(nativeSource, /GetSignInWithGoogleOption\.Builder\(webClientId\)/);
  assert.match(nativeSource, /GetCredentialCancellationException\) \{\s*null/);
  assert.match(nativeSource, /TYPE_GOOGLE_ID_TOKEN_CREDENTIAL/);
  assert.doesNotMatch(nativeSource, /Log\.|println|clientSecret/);
  console.log('Native Google Android auth QA passed.');
}

void verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
