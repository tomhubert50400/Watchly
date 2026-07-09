import assert from 'node:assert/strict';
import { verifyFirebaseIdToken } from '../auth/firebase-token-verifier.service';

async function main() {
  let receivedCheckRevoked: boolean | undefined;
  const firebaseAuth = {
    verifyIdToken: async (_token: string, checkRevoked?: boolean) => {
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
  assert.equal(
    receivedCheckRevoked,
    true,
    'Firebase ID tokens must be checked for revocation and disabled users.',
  );

  console.log('Auth token verifier QA passed.');
}

void main();
