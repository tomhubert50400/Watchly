import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

async function run() {
  let suspendedAt: Date | null = null;
  let suspendedUntil: Date | null = null;
  const prisma = {
    user: {
      findUnique: async () => ({ suspendedAt, suspendedUntil }),
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new AuthService(prisma as never);
  const identity = {
    emailVerified: false,
    firebaseUid: 'firebase-user-1',
    provider: 'GOOGLE',
    providerUserId: 'google-subject-1',
  } as never;

  await service.assertActiveIdentity(identity);

  suspendedAt = new Date('2026-08-13T12:00:00.000Z');
  await assert.rejects(
    () => service.assertActiveIdentity(identity),
    (error: unknown) =>
      error instanceof ForbiddenException && error.getResponse() !== null,
  );

  suspendedUntil = new Date('2020-08-13T12:00:00.000Z');
  await service.assertActiveIdentity(identity);

  console.log('Auth suspension QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
