import {
  exchangeCodeAsync,
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
} from 'expo-auth-session';
import Constants from 'expo-constants';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { publicEnv } from '../config/publicEnv';

const discovery = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

export type MicrosoftTokens = {
  accessToken: string | null;
  idToken: string | null;
};

export function useMicrosoftAuth() {
  const clientId = publicEnv.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
  const redirectUri = getMicrosoftRedirectUri();
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: clientId ?? 'missing-microsoft-client-id',
      extraParams: { prompt: 'select_account' },
      redirectUri,
      responseType: ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  const authenticate = useCallback(async (): Promise<MicrosoftTokens | null> => {
    if (!clientId) {
      throw new Error('Microsoft setup is incomplete: EXPO_PUBLIC_MICROSOFT_CLIENT_ID.');
    }
    if (!request?.codeVerifier) {
      throw new Error('Microsoft sign-in is not ready yet.');
    }

    const response = await promptAsync();
    if (response.type === 'cancel' || response.type === 'dismiss') return null;
    if (response.type !== 'success' || typeof response.params.code !== 'string') {
      throw new Error('Microsoft sign-in was rejected.');
    }

    const tokens = await exchangeCodeAsync(
      {
        clientId,
        code: response.params.code,
        extraParams: { code_verifier: request.codeVerifier },
        redirectUri,
      },
      discovery,
    );

    if (!tokens.accessToken && !tokens.idToken) {
      throw new Error('Microsoft did not return an authentication token.');
    }

    return {
      accessToken: tokens.accessToken ?? null,
      idToken: tokens.idToken ?? null,
    };
  }, [clientId, promptAsync, redirectUri, request?.codeVerifier]);

  return {
    authenticate,
    isConfigured: Boolean(clientId),
    isReady: Boolean(request),
  };
}

function getMicrosoftRedirectUri() {
  if (Platform.OS === 'web') return makeRedirectUri({ path: 'auth/microsoft' });

  const applicationId = Platform.OS === 'android'
    ? Constants.expoConfig?.android?.package
    : Constants.expoConfig?.ios?.bundleIdentifier;

  return makeRedirectUri({
    path: 'auth',
    scheme: applicationId ? `msauth.${applicationId}` : 'tvapp',
  });
}
