import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { getMissingGoogleClientConfig, googleClientIds } from './googleAuthConfig';

type WatchlyGoogleAuthModule = {
  signIn(webClientId: string): Promise<string | null>;
  clearSession(): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<WatchlyGoogleAuthModule>('WatchlyGoogleAuth');

export async function requestNativeGoogleIdToken() {
  if (!nativeModule) {
    throw new Error('Google sign-in requires the latest Watchly Android build.');
  }
  const missingConfig = getMissingGoogleClientConfig('android');
  if (missingConfig.length > 0 || !googleClientIds.webClientId) {
    throw new Error(`Google setup is incomplete: ${missingConfig.join(', ')}.`);
  }

  return nativeModule.signIn(googleClientIds.webClientId);
}

export async function clearNativeGoogleSession() {
  if (Platform.OS === 'android' && nativeModule) {
    await nativeModule.clearSession();
  }
}
