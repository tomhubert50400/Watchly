import { publicEnv } from '../config/publicEnv';

export const googleNativeRedirectUri = 'com.tom.tvapp.dev:/auth';

export const googleClientIds = {
  androidClientId: publicEnv.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: publicEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: publicEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export function getMissingGoogleClientConfig(platform: string): string[] {
  if (platform === 'ios' && !googleClientIds.iosClientId) {
    return ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'];
  }

  if (platform === 'android' && !googleClientIds.androidClientId) {
    return ['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'];
  }

  if (platform === 'web' && !googleClientIds.webClientId) {
    return ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'];
  }

  return [];
}
