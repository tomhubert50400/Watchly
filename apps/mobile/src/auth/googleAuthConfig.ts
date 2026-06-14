import { Platform } from 'react-native';
import { publicEnv } from '../config/publicEnv';

export const authRedirectScheme = 'tvapp';

export const googleClientIds = {
  androidClientId: publicEnv.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: publicEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: publicEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export function getMissingGoogleClientConfig(): string[] {
  if (Platform.OS === 'ios' && !googleClientIds.iosClientId) {
    return ['EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'];
  }

  if (Platform.OS === 'android' && !googleClientIds.androidClientId) {
    return ['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'];
  }

  if (Platform.OS === 'web' && !googleClientIds.webClientId) {
    return ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'];
  }

  return [];
}
