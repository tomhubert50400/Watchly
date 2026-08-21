import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AuthProvider } from '../generated/prisma/enums';

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
): Promise<ExternalProviderIdentity> {
  const settings = getExternalProviderSettings(config, provider);
  const token = await requestAccessToken(settings, code, callbackUrl);

  return requestDiscordIdentity(settings.userEndpoint, token);
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

async function requestAccessToken(
  settings: ProviderSettings,
  code: string,
  callbackUrl: string,
) {
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl,
  });
  const response = await fetch(settings.tokenEndpoint, {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  const payload = await readJson(response) as { access_token?: unknown };

  if (!response.ok || typeof payload.access_token !== 'string') {
    throw new ServiceUnavailableException('The external sign-in provider rejected the callback.');
  }

  return payload.access_token;
}

async function requestDiscordIdentity(endpoint: string, accessToken: string) {
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
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

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new ServiceUnavailableException('The external sign-in provider returned an invalid response.');
  }
}
