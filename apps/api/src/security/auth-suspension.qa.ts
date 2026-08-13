import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

async function run() {
  let suspendedAt: Date | null = null;
  const prisma = {
    authIdentity: {
      findUnique: async () => ({ user: { suspendedAt } }),
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new AuthService(prisma as never);
  const identity = {
    provider: 'GOOGLE',
    providerUserId: 'firebase-user-1',
  } as never;

  await service.assertActiveIdentity(identity);

  suspendedAt = new Date('2026-08-13T12:00:00.000Z');
  await assert.rejects(
    () => service.assertActiveIdentity(identity),
    (error: unknown) =>
      error instanceof ForbiddenException && error.message === 'This account is suspended.',
  );

  console.log('Auth suspension QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
