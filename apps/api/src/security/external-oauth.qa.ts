import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import {
  buildExternalAuthorizationUrl,
  getDiscordMobileRedirectUri,
  getExternalFirebaseUid,
  getExternalOAuthFailureReason,
  getExternalProviderSettings,
  hashOAuthSecret,
} from '../auth/external-oauth.provider';

const config = new ConfigService({
  DISCORD_OAUTH_CLIENT_ID: 'discord-client',
  DISCORD_OAUTH_CLIENT_SECRET: 'discord-secret',
});
const callbackUrl = 'https://api.trywatchly.com/auth/oauth/discord/callback';
const authorizationUrl = new URL(buildExternalAuthorizationUrl(
  getExternalProviderSettings(config, 'discord'),
  callbackUrl,
  'single-use-state',
));

assert.equal(authorizationUrl.origin, 'https://discord.com');
assert.equal(authorizationUrl.searchParams.get('client_id'), 'discord-client');
assert.equal(authorizationUrl.searchParams.get('redirect_uri'), callbackUrl);
assert.equal(authorizationUrl.searchParams.get('scope'), 'identify email');
assert.equal(authorizationUrl.searchParams.get('state'), 'single-use-state');
assert.equal(
  getDiscordMobileRedirectUri('1539925787333890090'),
  'discord-1539925787333890090:/authorize/callback',
);
assert(!authorizationUrl.toString().includes('discord-secret'), 'OAuth secrets must never enter authorize URLs');
assert.equal(hashOAuthSecret('ticket').length, 64);
assert.equal(
  getExternalFirebaseUid('discord', 'provider-user'),
  getExternalFirebaseUid('discord', 'provider-user'),
  'the same external subject must always resolve to the same Firebase UID',
);
assert.equal(
  getExternalFirebaseUid('microsoft', 'provider-user'),
  getExternalFirebaseUid('microsoft', 'provider-user'),
  'the same Microsoft subject must always resolve to the same Firebase UID',
);
assert.equal(
  getExternalOAuthFailureReason({
    error: 'invalid_grant',
    error_description: 'Invalid "code" in request.',
  }),
  'invalid_code',
);
assert.equal(
  getExternalOAuthFailureReason({
    error: 'invalid_grant',
    error_description: 'Invalid code_verifier in request.',
  }),
  'invalid_code_verifier',
);
assert.equal(
  getExternalOAuthFailureReason({
    error: 'invalid_grant',
    error_description: 'Invalid redirect_uri in request.',
  }),
  'invalid_redirect_uri',
);
assert.equal(getExternalOAuthFailureReason({ error: 'invalid_client' }), 'invalid_client');
assert.equal(getExternalOAuthFailureReason({ error: 'invalid_grant' }), 'invalid_grant');
assert.equal(getExternalOAuthFailureReason({ error: 'unexpected' }), 'provider_error');
const providerSource = readFileSync(
  resolve(process.cwd(), 'src/auth/external-oauth.provider.ts'),
  'utf8',
);
assert(!providerSource.includes("searchParams.set('access_token'"), 'access tokens must stay out of URLs');
assert(providerSource.includes('Authorization: `Bearer ${accessToken}`'));
assert(providerSource.includes('code_verifier: codeVerifier'));
assert(!providerSource.toLowerCase().includes('facebook'));

const controllerSource = readFileSync(
  resolve(process.cwd(), 'src/auth/auth.controller.ts'),
  'utf8',
);
assert(controllerSource.includes("@Post('oauth/discord/mobile')"));
assert(controllerSource.includes('/^[A-Za-z0-9._~-]{43,128}$/'));

console.log('External OAuth QA passed.');
