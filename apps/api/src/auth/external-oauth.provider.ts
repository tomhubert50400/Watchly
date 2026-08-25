import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AuthProvider } from '../generated/prisma/enums';

const EXTERNAL_PROVIDER_TIMEOUT_MS = 10_000;

export type ExternalOAuthProvider = 'discord';
export type OAuthTicketProvider = ExternalOAuthProvider | 'microsoft';

export type ExternalProviderIdentity = {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoUrl: string | null;
  provider: AuthProvider;
  providerUserId: string;
};

type ProviderSettings = {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  tokenEndpoint: string;
  userEndpoint: string;
};

export function parseExternalOAuthProvider(value: string): ExternalOAuthProvider | null {
  return value === 'discord' ? value : null;
}

export function toAuthProvider(provider: OAuthTicketProvider) {
  switch (provider) {
    case 'discord':
      return AuthProvider.DISCORD;
    case 'microsoft':
      return AuthProvider.MICROSOFT;
  }
}

export function buildExternalAuthorizationUrl(
  settings: ProviderSettings,
  callbackUrl: string,
  state: string,
) {
  const url = new URL(settings.authorizationEndpoint);

  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', settings.scopes.join(' '));
  url.searchParams.set('state', state);

  return url.toString();
}

export async function exchangeExternalAuthorizationCode(
  config: ConfigService,
  provider: ExternalOAuthProvider,
  code: string,
  callbackUrl: string,
  codeVerifier?: string,
): Promise<ExternalProviderIdentity> {
  const settings = getExternalProviderSettings(config, provider);
  const token = await requestAccessToken(settings, code, callbackUrl, codeVerifier);

  return requestDiscordIdentity(settings.userEndpoint, token);
}

export function getDiscordMobileRedirectUri(clientId: string) {
  return `discord-${clientId}:/authorize/callback`;
}

export function getExternalProviderSettings(
  config: ConfigService,
  _provider: ExternalOAuthProvider,
): ProviderSettings {
  return requireProviderSettings({
    authorizationEndpoint: 'https://discord.com/oauth2/authorize',
    clientId: config.get<string>('DISCORD_OAUTH_CLIENT_ID'),
    clientSecret: config.get<string>('DISCORD_OAUTH_CLIENT_SECRET'),
    scopes: ['identify', 'email'],
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    userEndpoint: 'https://discord.com/api/users/@me',
  });
}

export function hashOAuthSecret(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function getExternalFirebaseUid(provider: OAuthTicketProvider, providerUserId: string) {
  return `watchly:${provider}:${hashOAuthSecret(providerUserId)}`;
}

export function getExternalOAuthFailureReason(payload: {
  error?: unknown;
  error_description?: unknown;
}) {
  const description = typeof payload.error_description === 'string'
    ? payload.error_description.toLowerCase()
    : '';

  if (description.includes('code_verifier')) return 'invalid_code_verifier';
  if (description.includes('redirect_uri')) return 'invalid_redirect_uri';
  if (description.includes('"code"')) return 'invalid_code';
  if (payload.error === 'invalid_client') return 'invalid_client';
  if (payload.error === 'invalid_grant') return 'invalid_grant';

  return 'provider_error';
}

async function requestAccessToken(
  settings: ProviderSettings,
  code: string,
  callbackUrl: string,
  codeVerifier?: string,
) {
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl,
    ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
  });
  const response = await fetchExternalProvider(settings.tokenEndpoint, {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const payload = await readJson(response) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
  };

  if (!response.ok || typeof payload.access_token !== 'string') {
    const reason = getExternalOAuthFailureReason(payload);
    throw new ServiceUnavailableException(
      `The external sign-in provider rejected the callback (${reason}).`,
    );
  }

  return payload.access_token;
}

async function requestDiscordIdentity(endpoint: string, accessToken: string) {
  const response = await fetchExternalProvider(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await readJson(response) as {
    avatar?: unknown;
    email?: unknown;
    global_name?: unknown;
    id?: unknown;
    username?: unknown;
    verified?: unknown;
  };

  if (!response.ok || typeof payload.id !== 'string') {
    throw new ServiceUnavailableException('Discord did not return a valid identity.');
  }

  return {
    displayName: typeof payload.global_name === 'string'
      ? payload.global_name
      : typeof payload.username === 'string' ? payload.username : null,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.verified === true,
    photoUrl: typeof payload.avatar === 'string'
      ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
      : null,
    provider: AuthProvider.DISCORD,
    providerUserId: payload.id,
  } satisfies ExternalProviderIdentity;
}

function requireProviderSettings(settings: {
  authorizationEndpoint: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  scopes: string[];
  tokenEndpoint: string;
  userEndpoint: string;
}): ProviderSettings {
  if (!settings.clientId?.trim() || !settings.clientSecret?.trim()) {
    throw new ServiceUnavailableException('This sign-in provider is not configured yet.');
  }

  return {
    ...settings,
    clientId: settings.clientId.trim(),
    clientSecret: settings.clientSecret.trim(),
  };
}

async function fetchExternalProvider(input: string, init: RequestInit) {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(EXTERNAL_PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new ServiceUnavailableException('The external sign-in provider could not be reached.');
  }
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new ServiceUnavailableException('The external sign-in provider returned an invalid response.');
  }
}
