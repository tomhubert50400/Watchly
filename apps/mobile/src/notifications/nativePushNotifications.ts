import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getPushPreferences,
  registerPushDevice,
  revokePushDevice,
  updatePushPreferences,
} from '../api/push';

const PUSH_TOKEN_KEY = '@watchly/push/expo-token';
const PUSH_PROMPT_KEY_PREFIX = '@watchly/push/prompted';

export type SystemPushPermission = 'denied' | 'granted' | 'unavailable' | 'undetermined';
export type ReleasePushSetupResult = {
  message?: string;
  status: 'denied' | 'disabled' | 'enabled' | 'unavailable';
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export async function getSystemPushPermission(): Promise<SystemPushPermission> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable';
  try {
    return (await Notifications.getPermissionsAsync()).status;
  } catch {
    return 'unavailable';
  }
}

export async function maybeEnableReleasePushFromAlert(
  apiToken: string,
  userId: string,
): Promise<ReleasePushSetupResult> {
  const preferences = await getPushPreferences(apiToken);
  if (preferences.pushEnabled) return synchronizeEnabledPush(apiToken);

  const prompted = await AsyncStorage.getItem(getPromptKey(userId));
  if (prompted === 'true') return { status: 'disabled' };

  return enablePushFromSettings(apiToken, userId);
}

export async function enablePushFromSettings(
  apiToken: string,
  userId: string,
): Promise<ReleasePushSetupResult> {
  await configureAndroidChannel();
  const existingPermission = await getSystemPushPermission();
  let permission = existingPermission;

  if (existingPermission === 'undetermined') {
    permission = (await Notifications.requestPermissionsAsync()).status;
    await AsyncStorage.setItem(getPromptKey(userId), 'true');
  } else {
    await AsyncStorage.setItem(getPromptKey(userId), 'true');
  }

  if (permission !== 'granted') {
    await updatePushPreferences(apiToken, { pushEnabled: false });
    return {
      message: permission === 'denied'
        ? 'System notifications are blocked. You can enable them in device settings.'
        : 'System notifications are unavailable in this build.',
      status: permission === 'denied' ? 'denied' : 'unavailable',
    };
  }

  const expoPushToken = await getExpoPushToken();
  await registerPushDevice(apiToken, expoPushToken, Platform.OS as 'android' | 'ios');
  await updatePushPreferences(apiToken, { pushEnabled: true });
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
  return { status: 'enabled' };
}

export async function enableAllPushFromOnboarding(
  apiToken: string,
  userId: string,
): Promise<ReleasePushSetupResult> {
  const result = await enablePushFromSettings(apiToken, userId);

  if (result.status === 'enabled') {
    await updatePushPreferences(apiToken, {
      pushEnabled: true,
      releasePushEnabled: true,
    });
  }

  return result;
}

export async function disablePushFromSettings(apiToken: string) {
  const preferences = await updatePushPreferences(apiToken, { pushEnabled: false });
  await revokeStoredPushDevice(apiToken).catch(() => false);
  return preferences;
}

export async function synchronizeExistingPushRegistration(apiToken: string) {
  const preferences = await getPushPreferences(apiToken);
  if (!preferences.pushEnabled) return { status: 'disabled' as const };
  return synchronizeEnabledPush(apiToken);
}

export async function revokeStoredPushDevice(apiToken: string) {
  const expoPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!expoPushToken) return false;

  try {
    await revokePushDevice(apiToken, expoPushToken);
    return true;
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}

async function synchronizeEnabledPush(apiToken: string): Promise<ReleasePushSetupResult> {
  const permission = await getSystemPushPermission();
  if (permission !== 'granted') {
    await updatePushPreferences(apiToken, { pushEnabled: false });
    await revokeStoredPushDevice(apiToken).catch(() => false);
    return {
      message: permission === 'denied'
        ? 'System notifications are blocked in device settings.'
        : 'System notifications are unavailable in this build.',
      status: permission === 'denied' ? 'denied' : 'unavailable',
    };
  }

  await configureAndroidChannel();
  const expoPushToken = await getExpoPushToken();
  await registerPushDevice(apiToken, expoPushToken, Platform.OS as 'android' | 'ios');
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
  return { status: 'enabled' };
}

async function getExpoPushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    throw new Error('This Watchly build is missing its push notification project ID.');
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('release-alerts', {
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#D43A5C',
    name: 'Release alerts',
    vibrationPattern: [0, 200, 120, 200],
  });
}

function getPromptKey(userId: string) {
  return `${PUSH_PROMPT_KEY_PREFIX}:${userId}`;
}
