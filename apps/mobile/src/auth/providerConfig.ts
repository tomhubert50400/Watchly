import type { AppEnvironment } from '../config/appEnvironment';
import { appEnvironment } from '../config/publicEnv';

export type AuthProviderConfig = {
  id: 'apple' | 'discord' | 'google' | 'microsoft';
  isWired: boolean;
  name: 'Apple' | 'Discord' | 'Google' | 'Microsoft';
  presentation: 'primary' | 'secondary';
};

export function getAuthProviders(environment: AppEnvironment): readonly AuthProviderConfig[] {
  const externalProvidersAreWired = environment !== 'development';

  return [
    { id: 'google', isWired: true, name: 'Google', presentation: 'primary' },
    { id: 'apple', isWired: true, name: 'Apple', presentation: 'primary' },
    {
      id: 'microsoft',
      isWired: externalProvidersAreWired,
      name: 'Microsoft',
      presentation: 'secondary',
    },
    {
      id: 'discord',
      isWired: externalProvidersAreWired,
      name: 'Discord',
      presentation: 'secondary',
    },
  ];
}

export const authProviders = getAuthProviders(appEnvironment);
