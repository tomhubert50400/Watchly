// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';

type SearchArgs = {
  orderBy: unknown;
  select: unknown;
  take: number;
  where: unknown;
};

async function run() {
  let searchArgs: SearchArgs | null = null;
  const prisma = {
    user: {
      findMany: async (args: NonNullable<typeof searchArgs>) => {
        searchArgs = args;

        return [
          {
            avatarObjectKey: 'avatars/alice.jpg',
            displayName: 'Alice Kim',
            handle: 'alice_kim',
            id: '11111111-1111-4111-8111-111111111111',
          },
          {
            avatarObjectKey: null,
            displayName: 'Al Morgan',
            handle: 'al_morgan',
            id: '22222222-2222-4222-8222-222222222222',
          },
        ];
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new ProfileService(
    { getOrCreateUser: async () => ({ id: 'viewer-id' }) } as never,
    { get: () => undefined } as never,
    prisma as never,
    {
      getPublicUrl: (objectKey: string | null) => objectKey ? `https://images.watchly.test/${objectKey}` : null,
    } as never,
  );
  const identity = { providerUserId: 'viewer' } as never;

  assert.deepEqual(await service.searchProfiles(identity, '  AL  '), {
    items: [
      {
        avatarUrl: 'https://images.watchly.test/avatars/alice.jpg',
        displayName: 'Alice Kim',
        handle: 'alice_kim',
        id: '11111111-1111-4111-8111-111111111111',
      },
      {
        avatarUrl: null,
        displayName: 'Al Morgan',
        handle: 'al_morgan',
        id: '22222222-2222-4222-8222-222222222222',
      },
    ],
  });
  const capturedSearchArgs = searchArgs as SearchArgs | null;

  assert.equal(capturedSearchArgs?.take, 20, 'profile search must keep the result list bounded');
  assert.deepEqual(capturedSearchArgs?.where, {
    blockedUsers: {
      none: {
        blockedUserId: 'viewer-id',
      },
    },
    handle: { not: null },
    onboardingCompleted: true,
    OR: [
      {
        displayName: {
          contains: 'AL',
          mode: 'insensitive',
        },
      },
      {
        handle: {
          contains: 'AL',
          mode: 'insensitive',
        },
      },
    ],
  }, 'profile search must include profiles blocked by the viewer while excluding members who blocked them');

  await service.searchProfiles(identity, '@AL');
  assert.deepEqual(
    (searchArgs as SearchArgs | null)?.where,
    capturedSearchArgs?.where,
    'profile search must treat handles with and without @ identically',
  );

  await assert.rejects(
    () => service.searchProfiles(identity, 'a'),
    BadRequestException,
  );
  await assert.rejects(
    () => service.searchProfiles(identity, '@a'),
    BadRequestException,
  );
  await assert.rejects(
    () => service.searchProfiles(identity, 'a'.repeat(81)),
    BadRequestException,
  );

  console.log('Profile search QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
