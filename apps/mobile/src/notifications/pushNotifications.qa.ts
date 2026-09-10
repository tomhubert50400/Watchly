// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const appConfig = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const alertSource = readFileSync(new URL('./ReleaseAlertControl.tsx', import.meta.url), 'utf8');
const nativeSource = readFileSync(new URL('./nativePushNotifications.ts', import.meta.url), 'utf8');
const observerSource = readFileSync(new URL('./PushNavigationObserver.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../onboarding/OnboardingScreen.tsx', import.meta.url), 'utf8');
const registrationSyncSource = readFileSync(new URL('./PushRegistrationSync.tsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');

assert.ok(
  appConfig.expo.plugins.some((plugin: unknown) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications'
  ),
  'The native notification config plugin must be part of the Watchly build.',
);
assert.ok(
  nativeSource.includes('enableAllPushFromOnboarding') &&
    nativeSource.includes('releasePushEnabled: true') &&
    onboardingSource.includes('iPhone Settings &gt; Notifications &gt; Watchly') &&
    onboardingSource.includes('Linking.openSettings()') &&
    onboardingSource.includes('Continue without') &&
    onboardingSource.includes('every current and future Watchly update'),
  'Onboarding must enable every current functional category and explain both refusal recovery paths.',
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
