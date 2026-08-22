import { publicEnv } from '../config/publicEnv';

export const googleClientIds = {
  androidClientId: publicEnv.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: publicEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: publicEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export function getMissingGoogleClientConfig(platform: string): string[] {
  const config = platform === 'ios'
    ? ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', googleClientIds.iosClientId] as const
    : platform === 'android'
      ? ['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', googleClientIds.androidClientId] as const
      : platform === 'web'
        ? ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', googleClientIds.webClientId] as const
        : null;

  if (!config) return [];

  const [key, clientId] = config;
  if (!clientId) return [key];

  return googleClientBelongsToFirebaseProject(
    clientId,
    publicEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
  ) ? [] : [`${key} (Firebase project mismatch)`];
}

export function googleClientBelongsToFirebaseProject(
  googleClientId: string,
  firebaseAppId: string | undefined,
) {
  const firebaseProjectNumber = firebaseAppId?.match(/^1:(\d+):/)?.[1];
  if (!firebaseProjectNumber) return true;

  return googleClientId.startsWith(`${firebaseProjectNumber}-`);
}
