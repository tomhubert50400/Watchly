import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import {
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

  await verifyFirebaseIdToken(firebaseAuth, 'qa-token');
  assert.equal(receivedToken, 'qa-token', 'The original bearer token must be passed to Firebase.');
  assert.equal(
    receivedCheckRevoked,
    true,
    'Firebase ID tokens must be checked for revocation and disabled users.',
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

  console.log('Auth token verifier QA passed.');
}

void main();
