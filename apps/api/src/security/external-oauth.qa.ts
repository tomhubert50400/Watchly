import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import {
  buildExternalAuthorizationUrl,
  getExternalFirebaseUid,
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
assert(!authorizationUrl.toString().includes('discord-secret'), 'OAuth secrets must never enter authorize URLs');
assert.equal(hashOAuthSecret('ticket').length, 64);
assert.equal(
  getExternalFirebaseUid('discord', 'provider-user'),
  getExternalFirebaseUid('discord', 'provider-user'),
  'the same external subject must always resolve to the same Firebase UID',
);
const providerSource = readFileSync(
  resolve(process.cwd(), 'src/auth/external-oauth.provider.ts'),
  'utf8',
);
assert(!providerSource.includes("searchParams.set('access_token'"), 'access tokens must stay out of URLs');
assert(providerSource.includes('Authorization: `Bearer ${accessToken}`'));
assert(!providerSource.toLowerCase().includes('facebook'));

console.log('External OAuth QA passed.');
