// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FollowStatus, PrivacyVisibility } from '../generated/prisma/enums';
import { ProfileService } from './profile.service';

async function run() {
  const viewerId = '11111111-1111-4111-8111-111111111111';
  const targetUserId = '22222222-2222-4222-8222-222222222222';
  let profileVisibility: 'PRIVATE' | 'PUBLIC' = PrivacyVisibility.PUBLIC;
  let blockRows: Array<{ blockerId: string }> = [];
  let acceptedFollow = { id: 'accepted-follow' } as { id: string } | null;
  let connectionArgs: { where: Record<string, unknown> } | null = null;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: targetUserId,
        privacySettings: { profileVisibility },
      }),
    },
    userBlock: {
      findMany: async () => blockRows,
    },
    userFollow: {
      findFirst: async () => acceptedFollow,
      findMany: async (args: { select: Record<string, unknown>; where: Record<string, unknown> }) => {
        connectionArgs = args;

        return 'follower' in args.select
          ? [{
              follower: {
                avatarObjectKey: 'avatars/maya.jpg',
                displayName: 'Maya Chen',
                handle: 'maya_chen',
                id: '33333333-3333-4333-8333-333333333333',
              },
            }]
          : [{
              followedUser: {
                avatarObjectKey: null,
                displayName: null,
                handle: 'noah_w',
                id: '44444444-4444-4444-8444-444444444444',
              },
            }];
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new ProfileService(
    { getOrCreateUser: async () => ({ id: viewerId }) } as never,
    { get: () => undefined } as never,
    prisma as never,
    {
      getPublicUrl: (objectKey: string | null) => objectKey
        ? `https://images.watchly.test/${objectKey}`
        : null,
    } as never,
  );
  const identity = { providerUserId: 'viewer' } as never;

  assert.deepEqual(await service.listProfileFollowers(identity, targetUserId), {
    items: [{
      avatarUrl: 'https://images.watchly.test/avatars/maya.jpg',
      displayName: 'Maya Chen',
      handle: 'maya_chen',
      id: '33333333-3333-4333-8333-333333333333',
    }],
  });
  assert.deepEqual((connectionArgs as { where: Record<string, unknown> } | null)?.where, {
    followedUserId: targetUserId,
    follower: {
      blockedUsers: { none: { blockedUserId: viewerId } },
      handle: { not: null },
      onboardingCompleted: true,
      suspendedAt: null,
    },
    status: FollowStatus.ACCEPTED,
  }, 'followers must be accepted, onboarded, navigable, and must not have blocked the viewer');

  assert.deepEqual(await service.listProfileFollowing(identity, targetUserId), {
    items: [{
      avatarUrl: null,
      displayName: 'noah_w',
      handle: 'noah_w',
      id: '44444444-4444-4444-8444-444444444444',
    }],
  });
  assert.deepEqual((connectionArgs as { where: Record<string, unknown> } | null)?.where, {
    followedUser: {
      blockedUsers: { none: { blockedUserId: viewerId } },
      handle: { not: null },
      onboardingCompleted: true,
      suspendedAt: null,
    },
    followerId: targetUserId,
    status: FollowStatus.ACCEPTED,
  });

  profileVisibility = PrivacyVisibility.PRIVATE;
  await assert.doesNotReject(
    () => service.listProfileFollowers(identity, targetUserId),
    'an accepted follower must be allowed to open a private profile connection list',
  );

  acceptedFollow = null;
  await assert.rejects(
    () => service.listProfileFollowers(identity, targetUserId),
    ForbiddenException,
  );

  profileVisibility = PrivacyVisibility.PUBLIC;
  blockRows = [{ blockerId: targetUserId }];
  await assert.rejects(
    () => service.listProfileFollowing(identity, targetUserId),
    ForbiddenException,
  );

  console.log('Profile connections QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
