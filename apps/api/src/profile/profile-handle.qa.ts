// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProfileService } from './profile.service';

type StoredUser = {
  displayName: string;
  handle: string | null;
  id: string;
  onboardingCompleted: boolean;
};

async function run() {
  const storedUser: StoredUser = {
    displayName: 'Handle tester',
    handle: null,
    id: 'viewer-id',
    onboardingCompleted: false,
  };
  const transactionClient = {
    dataImport: {
      findMany: async () => [],
    },
    user: {
      findUniqueOrThrow: async () => ({
        displayName: storedUser.displayName,
        handle: storedUser.handle,
        onboardingCompleted: storedUser.onboardingCompleted,
      }),
      update: async ({ data }: { data: { displayName?: string | null; onboardingCompleted?: boolean } }) => {
        if (data.displayName) storedUser.displayName = data.displayName;
        if (data.onboardingCompleted !== undefined) storedUser.onboardingCompleted = data.onboardingCompleted;
        return { ...storedUser };
      },
      updateMany: async ({ data }: { data: { handle: string } }) => {
        if (storedUser.handle) return { count: 0 };
        storedUser.handle = data.handle;
        return { count: 1 };
      },
    },
    userContentState: {
      upsert: async () => ({}),
    },
  };
  const prisma = {
    $transaction: async (operation: (tx: typeof transactionClient) => Promise<unknown>) => (
      operation(transactionClient)
    ),
    user: {
      findUnique: async ({ where }: { where: { handle: string } }) => {
        if (where.handle === 'taken_handle') return { id: 'other-user' };
        if (where.handle === storedUser.handle) return { id: storedUser.id };
        return null;
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = createService(prisma);
  const identity = { providerUserId: 'viewer' } as never;

  assert.deepEqual(await service.completeOnboarding(identity, {
    displayName: 'Handle tester',
    handle: '@Cinema_Fan',
    tasteItems: [{ contentType: 'movie', tmdbId: 603 }],
  }), {
    displayName: 'Handle tester',
    handle: 'cinema_fan',
    id: 'viewer-id',
    onboardingCompleted: true,
  });
  assert.equal(storedUser.handle, 'cinema_fan', 'handles must be stored without @ and lowercase');
  assert.deepEqual(await service.getHandleAvailability(identity, '@Cinema_Fan'), {
    available: true,
    handle: 'cinema_fan',
  });
  assert.deepEqual(await service.getHandleAvailability(identity, 'taken_handle'), {
    available: false,
    handle: 'taken_handle',
  });
  await service.completeOnboarding(identity, 'cinema_fan');
  await assert.rejects(
    () => service.completeOnboarding(identity, 'another_handle'),
    BadRequestException,
    'a claimed handle must be immutable',
  );
  await assert.rejects(
    () => createService({
      $transaction: async () => {
        throw { code: 'P2002' };
      },
      withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
    }).completeOnboarding(identity, 'taken_handle'),
    ConflictException,
    'unique handle conflicts must return a clear conflict response',
  );

  for (const invalid of ['ab', 'with space', 'punctuation!', 'a'.repeat(21)]) {
    await assert.rejects(
      () => service.completeOnboarding(identity, invalid),
      BadRequestException,
      `invalid handle must be rejected: ${invalid}`,
    );
  }

  console.log('Profile handle QA passed.');
}

function createService(prisma: object) {
  return new ProfileService(
    { getOrCreateUser: async () => ({ id: 'viewer-id' }) } as never,
    { get: () => undefined } as never,
    prisma as never,
    { getPublicUrl: () => null } as never,
  );
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
