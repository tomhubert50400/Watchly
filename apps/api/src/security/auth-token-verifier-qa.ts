import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { parseFirebaseServiceAccount } from '../auth/firebase-admin-app';
import {
  shouldCheckFirebaseTokenRevocation,
  verifyBearerTokenWithAuth,
  verifyFirebaseIdToken,
} from '../auth/firebase-token-verifier.service';

async function main() {
  let receivedToken: string | undefined;
  let receivedCheckRevoked: boolean | undefined;
  const firebaseAuth = {
    verifyIdToken: async (token: string, checkRevoked?: boolean) => {
      receivedToken = token;
      receivedCheckRevoked = checkRevoked;
      return {
        aud: 'security-qa',
        auth_time: 0,
        exp: 1,
        firebase: {
          identities: {
            'apple.com': ['apple-subject-qa'],
            'google.com': ['google-subject-qa'],
          },
          sign_in_provider: 'google.com',
        },
        iat: 0,
        iss: 'https://securetoken.google.com/security-qa',
        email: 'qa@example.com',
        email_verified: true,
        picture: 'https://example.com/avatar.jpg',
        sub: 'qa-user',
        uid: 'qa-user',
      };
    },
  };

  await verifyFirebaseIdToken(firebaseAuth, 'qa-token', true);
  assert.equal(receivedToken, 'qa-token', 'The original bearer token must be passed to Firebase.');
  assert.equal(
    receivedCheckRevoked,
    true,
    'Firebase ID tokens must be checked for revocation and disabled users.',
  );

  await verifyFirebaseIdToken(firebaseAuth, 'local-token', false);
  assert.equal(receivedToken, 'local-token');
  assert.equal(
    receivedCheckRevoked,
    false,
    'Local token verification must not require unavailable Firebase Admin credentials.',
  );
  assert.equal(
    shouldCheckFirebaseTokenRevocation('development', undefined, undefined),
    false,
    'Local development without Admin credentials must skip the remote revocation lookup.',
  );
  assert.equal(
    shouldCheckFirebaseTokenRevocation('development', undefined, 'firebase-admin.json'),
    true,
    'Local development with explicit Admin credentials must check revocation.',
  );
  assert.equal(
    shouldCheckFirebaseTokenRevocation('production', undefined, undefined),
    true,
    'Production must always check revoked and disabled Firebase users.',
  );
  assert.equal(
    shouldCheckFirebaseTokenRevocation('development', '127.0.0.1:9099', 'firebase-admin.json'),
    false,
    'The local Auth emulator must not perform a production revocation lookup.',
  );

  assert.deepEqual(
    parseFirebaseServiceAccount(
      JSON.stringify({
        client_email: 'watchly-auth@example.iam.gserviceaccount.com',
        private_key: 'private-key',
        project_id: 'watchly-staging',
      }),
      'watchly-staging',
    ),
    {
      clientEmail: 'watchly-auth@example.iam.gserviceaccount.com',
      privateKey: 'private-key',
      projectId: 'watchly-staging',
    },
    'Railway service account JSON must be parsed without changing credential fields.',
  );
  assert.throws(
    () => parseFirebaseServiceAccount('{', 'watchly-staging'),
    /must contain valid JSON/,
  );
  assert.throws(
    () => parseFirebaseServiceAccount(
      JSON.stringify({
        client_email: 'watchly-auth@example.iam.gserviceaccount.com',
        private_key: 'private-key',
        project_id: 'watchly-production',
      }),
      'watchly-staging',
    ),
    /does not match FIREBASE_PROJECT_ID/,
  );

  const rejected = await verifyBearerTokenWithAuth(
    {
      verifyIdToken: async () => {
        throw new Error('firebase rejection details must not escape');
      },
    },
    'rejected-token',
  ).then(
    () => null,
    (caught: unknown) => caught,
  );

  assert(rejected instanceof UnauthorizedException, 'Firebase verification failures must become HTTP 401.');
  assert.equal(rejected.getStatus(), 401);
  assert.equal(rejected.message, 'Invalid auth token.');

  const passwordAuth = {
    verifyIdToken: async () => ({
      aud: 'security-qa', auth_time: 0, exp: 1,
    firebase: { identities: {}, sign_in_provider: 'password' },
      iat: 0, iss: 'https://securetoken.google.com/security-qa',
      email: 'ui-review@watchly.test', name: 'Watchly UI Review', sub: 'ui-review-user', uid: 'ui-review-user',
    }),
  };
  const productionPasswordError = await verifyBearerTokenWithAuth(passwordAuth, 'password-token').then(
    () => null,
    (caught: unknown) => caught,
  );
  assert(
    productionPasswordError instanceof UnauthorizedException,
    'Password tokens must remain rejected by default.',
  );
  const emulatorIdentity = await verifyBearerTokenWithAuth(passwordAuth, 'password-token', {
    allowPasswordProvider: true,
  });
  assert.equal(emulatorIdentity.provider, 'GOOGLE');
  assert.equal(emulatorIdentity.firebaseUid, 'ui-review-user');
  assert.equal(emulatorIdentity.providerUserId, 'ui-review-user');
  assert.equal(emulatorIdentity.email, 'ui-review@watchly.test');
  assert.equal(emulatorIdentity.photoUrl, null);

  const oauthIdentity = await verifyBearerTokenWithAuth(firebaseAuth, 'qa-token');
  assert.equal(oauthIdentity.emailVerified, true);
  assert.equal(oauthIdentity.firebaseUid, 'qa-user');
  assert.equal(oauthIdentity.providerUserId, 'google-subject-qa');
  assert.deepEqual(oauthIdentity.linkedProviders, [
    { provider: 'APPLE', providerUserId: 'apple-subject-qa' },
    { provider: 'GOOGLE', providerUserId: 'google-subject-qa' },
  ]);
  assert.equal(oauthIdentity.photoUrl, 'https://example.com/avatar.jpg');

  for (const [signInProvider, expectedProvider] of [
    ['apple.com', 'APPLE'],
    ['facebook.com', 'FACEBOOK'],
    ['microsoft.com', 'MICROSOFT'],
  ] as const) {
    const identity = await verifyBearerTokenWithAuth({
      verifyIdToken: async () => ({
        aud: 'security-qa', auth_time: 0, exp: 1,
        firebase: { identities: { [signInProvider]: [`${expectedProvider.toLowerCase()}-subject`] }, sign_in_provider: signInProvider },
        iat: 0, iss: 'https://securetoken.google.com/security-qa', sub: 'linked-user', uid: 'linked-user',
      }),
    }, `${expectedProvider.toLowerCase()}-token`);

    assert.equal(identity.provider, expectedProvider);
    assert.equal(identity.providerUserId, `${expectedProvider.toLowerCase()}-subject`);
  }

  const discordIdentity = await verifyBearerTokenWithAuth({
    verifyIdToken: async () => ({
      aud: 'security-qa', auth_time: 0, exp: 1,
      firebase: { identities: {}, sign_in_provider: 'custom' },
      iat: 0, iss: 'https://securetoken.google.com/security-qa', sub: 'watchly-discord-user',
      uid: 'watchly-discord-user',
      watchlyDisplayName: 'Discord User',
      watchlyEmail: 'discord@example.com',
      watchlyEmailVerified: true,
      watchlyPhotoUrl: 'https://cdn.discordapp.com/avatar.png',
      watchlyProvider: 'DISCORD',
      watchlyProviderUserId: 'discord-subject',
    }),
  }, 'discord-custom-token');
  assert.equal(discordIdentity.provider, 'DISCORD');
  assert.equal(discordIdentity.providerUserId, 'discord-subject');
  assert.equal(discordIdentity.firebaseUid, 'watchly-discord-user');
  assert.equal(discordIdentity.emailVerified, true);
  assert.deepEqual(discordIdentity.linkedProviders, [
    { provider: 'DISCORD', providerUserId: 'discord-subject' },
  ]);

  await assert.rejects(
    () => verifyBearerTokenWithAuth({
      verifyIdToken: async () => ({
        aud: 'security-qa', auth_time: 0, exp: 1,
        firebase: { identities: {}, sign_in_provider: 'custom' },
        iat: 0, iss: 'https://securetoken.google.com/security-qa', sub: 'unknown-custom',
        uid: 'unknown-custom', watchlyProvider: 'UNKNOWN',
      }),
    }, 'unknown-custom-token'),
    UnauthorizedException,
  );

  console.log('Auth token verifier QA passed.');
}

void main();
