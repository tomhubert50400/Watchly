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
          identities: {},
          sign_in_provider: 'google.com',
        },
        iat: 0,
        iss: 'https://securetoken.google.com/security-qa',
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
      name: 'Watchly UI Review', sub: 'ui-review-user', uid: 'ui-review-user',
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
  assert.equal(emulatorIdentity.providerUserId, 'ui-review-user');

  console.log('Auth token verifier QA passed.');
}

void main();
