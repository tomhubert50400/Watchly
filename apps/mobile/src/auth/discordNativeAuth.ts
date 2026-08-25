import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { appEnvironment, publicEnv } from '../config/publicEnv';

const stagingDiscordApplicationId = '1539925787333890090';

export const DISCORD_APPLICATION_ID = publicEnv.EXPO_PUBLIC_DISCORD_APPLICATION_ID
  ?? (appEnvironment === 'production' ? null : stagingDiscordApplicationId);

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
  if (!DISCORD_APPLICATION_ID) {
    throw new Error('Discord setup is incomplete: EXPO_PUBLIC_DISCORD_APPLICATION_ID.');
  }

  return nativeModule.authorize(DISCORD_APPLICATION_ID);
}
