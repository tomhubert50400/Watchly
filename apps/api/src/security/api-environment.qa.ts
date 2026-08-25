import assert from 'node:assert/strict';
import { apiEnvironmentSchema } from '../app.module';

const completeConfiguration = {
  APP_ENV: 'staging',
  AUTH_APP_REDIRECT_URI: 'https://app.watchly.example/auth',
  AUTH_OAUTH_CALLBACK_BASE_URL: 'https://api.watchly.example',
  DATABASE_URL: 'postgresql://watchly:watchly@localhost:5432/watchly',
  DISCORD_OAUTH_CLIENT_ID: 'discord-client',
  DISCORD_OAUTH_CLIENT_SECRET: 'discord-secret',
  ERROR_TRACKING_DSN: 'https://public@example.com/1',
  FIREBASE_PROJECT_ID: 'watchly-staging',
  FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
  MICROSOFT_OAUTH_CLIENT_ID: 'microsoft-client',
  MONITORING_TEST_KEY: 'a'.repeat(32),
};

assert.equal(apiEnvironmentSchema.validate(completeConfiguration).error, undefined);
assert.equal(
  apiEnvironmentSchema.validate({
    APP_ENV: 'development',
    DATABASE_URL: completeConfiguration.DATABASE_URL,
    FIREBASE_PROJECT_ID: 'watchly-development',
  }).error,
  undefined,
  'development must continue to allow local Firebase-only auth',
);

for (const environment of ['staging', 'production']) {
  for (const requiredName of [
    'AUTH_APP_REDIRECT_URI',
    'AUTH_OAUTH_CALLBACK_BASE_URL',
    'DISCORD_OAUTH_CLIENT_ID',
    'DISCORD_OAUTH_CLIENT_SECRET',
    'MICROSOFT_OAUTH_CLIENT_ID',
  ] as const) {
    const configuration = { ...completeConfiguration, APP_ENV: environment };
    delete configuration[requiredName];
    const error = apiEnvironmentSchema.validate(configuration).error;

    assert(error, `${requiredName} must be required in ${environment}`);
    assert.match(error.message, new RegExp(requiredName));
  }
}

console.log('API auth environment QA passed.');
