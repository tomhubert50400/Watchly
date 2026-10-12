// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under tsx/Node.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const appConfig = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const alertSource = readFileSync(new URL('./ReleaseAlertControl.tsx', import.meta.url), 'utf8');
const nativeSource = readFileSync(new URL('./nativePushNotifications.ts', import.meta.url), 'utf8');
const observerSource = readFileSync(new URL('./PushNavigationObserver.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../onboarding/OnboardingScreen.tsx', import.meta.url), 'utf8');
const registrationSyncSource = readFileSync(new URL('./PushRegistrationSync.tsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');
const dynamicConfigSource = readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');

for (const variant of ['development', 'staging', 'production']) {
  const module = { exports: null as unknown as (input: { config: typeof appConfig.expo }) => typeof appConfig.expo };
  runInNewContext(dynamicConfigSource, { module, process: { env: {
    APP_VARIANT: variant, EXPO_PUBLIC_APP_ENV: variant, EXPO_PUBLIC_DISCORD_APPLICATION_ID: '123456789',
  } } });
  const resolved = module.exports({ config: appConfig.expo });
  if (variant !== 'production') {
    assert.equal(resolved.android.googleServicesFile, undefined, 'Other environments must not register devices in production Firebase.');
    continue;
  }
  assert.equal(resolved.android.googleServicesFile, './google-services.production.json', 'Production Android must include native Firebase configuration for push registration.');
  const googleServices = JSON.parse(readFileSync(new URL(`../../${resolved.android.googleServicesFile}`, import.meta.url), 'utf8'));
  assert.equal(googleServices.project_info.project_id, 'watchly-production-zerqua');
  assert.equal(googleServices.project_info.project_number, '580389352237');
  assert.ok(googleServices.client.some((client: { client_info: { mobilesdk_app_id: string; android_client_info: { package_name: string } } }) =>
    client.client_info.android_client_info.package_name === resolved.android.package &&
    client.client_info.mobilesdk_app_id.startsWith('1:580389352237:android:')
  ), 'The native Firebase application must match the production Android package and sender.');
  assert.equal(googleServices.private_key, undefined, 'Private service account credentials must never be bundled in the app.');
}

assert.ok(
  appConfig.expo.plugins.some((plugin: unknown) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications'
  ),
  'The native notification config plugin must be part of the Watchly build.',
);
assert.ok(
  nativeSource.includes('enableAllPushFromOnboarding') &&
    nativeSource.includes('releasePushEnabled: true') &&
    onboardingSource.includes('iPhone Settings > Notifications > Watchly') &&
    onboardingSource.includes('Linking.openSettings()') &&
    onboardingSource.includes('Continue to Watchly') &&
    onboardingSource.includes('turn them on later in your device settings'),
  'Onboarding must enable notifications after acceptance and let users continue or open settings after refusal.',
);
assert.ok(
  alertSource.includes('maybeEnableReleasePushFromAlert') &&
    alertSource.indexOf('maybeEnableReleasePushFromAlert') < alertSource.indexOf('enableReleaseAlert(token'),
  'The first release-alert activation must request push permission before creating its notification.',
);
assert.ok(
  nativeSource.includes('Constants.expoConfig?.extra?.eas?.projectId') &&
    nativeSource.includes('registerPushDevice') &&
    nativeSource.includes('revokeStoredPushDevice'),
  'Push registration must use the EAS project ID and support backend revocation.',
);
assert.ok(
  observerSource.includes('getLastNotificationResponseAsync') &&
    observerSource.includes('addNotificationResponseReceivedListener') &&
    observerSource.includes("url.startsWith('tvapp://')"),
  'Cold and warm notification taps must accept only Watchly deep links.',
);
assert.ok(
  settingsSource.includes("navigation.navigate('NotificationPreferences')") &&
    appSource.includes('component={NotificationPreferencesScreen} name="NotificationPreferences"') &&
    appSource.includes('<PushRegistrationSync />'),
  'Settings and the app root must expose preference and token-renewal flows.',
);
assert.match(
  registrationSyncSource,
  /if \(synchronization\) return synchronization;/,
  'Concurrent push registration triggers must share one in-flight synchronization.',
);
assert.match(
  registrationSyncSource,
  /if \(!firebaseIdToken \|\| tokenKey === lastObservedToken\) return;/,
  'Repeated native token events must not start an endless registration loop.',
);

console.log('Push notification mobile QA passed.');

for (const flag of ['shouldPlaySound', 'shouldSetBadge', 'shouldShowBanner', 'shouldShowList']) {
  assert.ok(nativeSource.includes(flag + ': false'), 'Foreground notifications must be silent: ' + flag);
}

void (async () => {
  const opened: string[] = [];
  let receive!: (response: unknown) => Promise<void>;
  const notifications = {
    getLastNotificationResponseAsync: async () => null,
    clearLastNotificationResponseAsync: async () => {},
    addNotificationResponseReceivedListener: (callback: typeof receive) => { receive = callback; return { remove() {} }; },
    addNotificationReceivedListener: () => ({ remove() {} }),
  };
  const exported: any = {};
  runInNewContext(ts.transpileModule(observerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: exported, URL, require: (name: string) => name === 'react' ? { useEffect: (effect: Function) => effect() }
      : name === 'expo-notifications' ? notifications : name === 'react-native' ? { Linking: { openURL: async (url: string) => { opened.push(url); } } } : {},
  });
  exported.PushNavigationObserver();
  const tap = async (kind: string, url: string) => { receive({ notification: { request: { content: { data: { kind, url } } } } }); await Promise.resolve(); };
  await tap('shared_vote_update', 'tvapp://watchlists/shared/list?title=Movie%20night');
  assert.equal(new URL(opened[0]!).searchParams.get('view'), 'votes');
  assert.equal(new URL(opened[0]!).searchParams.get('title'), 'Movie night');
  await tap('release', 'tvapp://film/603');
  assert.equal(opened[1], 'tvapp://film/603');
  await tap('shared_vote_update', 'https://example.com');
  assert.equal(opened.length, 2);
})();
