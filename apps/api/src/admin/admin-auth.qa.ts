import assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { verifyAdminBearerTokenWithAuth } from '../auth/firebase-token-verifier.service';

async function run() {
  let checkRevoked: boolean | undefined;
  const validToken = createToken();
  const auth = {
    verifyIdToken: async (_token: string, shouldCheckRevoked?: boolean) => {
      checkRevoked = shouldCheckRevoked;
      return validToken;
    },
  };

  assert.deepEqual(await verifyAdminBearerTokenWithAuth(auth as never, 'token'), {
    email: 'moderator@watchly.test',
    firebaseUid: 'firebase-admin-1',
    secondFactor: 'totp',
  });
  assert.equal(checkRevoked, true, 'Admin token revocation must be checked outside the emulator.');

  await assert.rejects(
    () => verifyAdminBearerTokenWithAuth({ verifyIdToken: async () => createToken({ admin: false }) } as never, 'token'),
    ForbiddenException,
  );
  await assert.rejects(
    () => verifyAdminBearerTokenWithAuth({ verifyIdToken: async () => createToken({ secondFactor: undefined }) } as never, 'token'),
    ForbiddenException,
  );
  await assert.rejects(
    () => verifyAdminBearerTokenWithAuth({ verifyIdToken: async () => createToken({ emailVerified: false }) } as never, 'token'),
    ForbiddenException,
  );
  await assert.rejects(
    () => verifyAdminBearerTokenWithAuth({ verifyIdToken: async () => { throw new Error('bad token'); } } as never, 'token'),
    UnauthorizedException,
  );

  console.log('Admin auth QA passed.');
}

function createToken(
  overrides: { admin?: boolean; emailVerified?: boolean; secondFactor?: string } = {},
): DecodedIdToken {
  return {
    admin: overrides.admin ?? true,
    email: 'moderator@watchly.test',
    email_verified: overrides.emailVerified ?? true,
    firebase: {
      identities: {},
      sign_in_provider: 'google.com',
      sign_in_second_factor: overrides.secondFactor === undefined && 'secondFactor' in overrides
        ? undefined
        : overrides.secondFactor ?? 'totp',
    },
    uid: 'firebase-admin-1',
  } as unknown as DecodedIdToken;
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
