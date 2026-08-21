import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export const DISCORD_APPLICATION_ID = '1539925787333890090';

export type DiscordNativeAuthorization = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

type WatchlyDiscordAuthModule = {
  authorize(clientId: string): Promise<DiscordNativeAuthorization>;
};

const nativeModule = requireOptionalNativeModule<WatchlyDiscordAuthModule>('WatchlyDiscordAuth');

export function shouldUseNativeDiscordAuthorization() {
  return Platform.OS === 'ios';
}

export async function requestNativeDiscordAuthorization() {
  if (!nativeModule) {
    throw new Error('Discord sign-in requires the latest Watchly build.');
  }

  return nativeModule.authorize(DISCORD_APPLICATION_ID);
}
