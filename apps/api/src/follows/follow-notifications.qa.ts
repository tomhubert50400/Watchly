import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowStatus, PrivacyVisibility } from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from './follows.service';

const followerId = '11111111-1111-4111-8111-111111111111';
const followedUserId = '22222222-2222-4222-8222-222222222222';
let ownerId = followerId;
let visibility: PrivacyVisibility = PrivacyVisibility.PUBLIC;
let blocked = false;
let failNotification = false;
let sequence = 0;
type Follow = {
  id: string; followerId: string; followedUserId: string; status: FollowStatus;
  createdAt: Date;
};
let follow: Follow | null = null;
const notifications = new Map<string, any>();
let inboxWhere: any;
const prisma: any = {
  withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  $transaction: async (operation: (tx: unknown) => Promise<unknown>) => {
    const previous = follow ? { ...follow } : null;
    try { return await operation(prisma); } catch (error) { follow = previous; throw error; }
  },
  user: {
    findUnique: async () => ({ privacySettings: { profileVisibility: visibility } }),
    findUniqueOrThrow: async ({ where }: any) => {
      assert.equal(where.id, followerId);
      return { displayName: ' Maya ', handle: 'maya' };
    },
  },
  userBlock: { findFirst: async () => blocked ? {} : null },
  userFollow: {
    upsert: async ({ create, update }: any) => {
      follow = follow ? { ...follow, ...update } : {
        ...create, id: `follow-${++sequence}`, createdAt: new Date(),
      };
      return follow;
    },
    deleteMany: async () => { follow = null; return { count: 1 }; },
    updateMany: async ({ data, where }: any) => {
      if (!follow || follow.status !== where.status || follow.followedUserId !== where.followedUserId || follow.followerId !== where.followerId) return { count: 0 };
      follow = { ...follow, ...data };
      return { count: 1 };
    },
    findUniqueOrThrow: async () => follow ?? assert.fail('Missing follow'),
  },
  notification: {
    createMany: async ({ data, skipDuplicates }: any) => {
      if (failNotification) throw new Error('Notification write failed');
      assert.equal(skipDuplicates, true);
      for (const row of data) {
        const key = `${row.userId}:${row.dedupeKey}`;
        if (!notifications.has(key)) notifications.set(key, {
          ...row, id: key, createdAt: new Date(), readAt: null, contentType: null,
          episodeNumber: null, releasedAt: null, releaseType: null, seasonNumber: null,
          sharedWatchlistId: null, tmdbId: null, votingSessionId: null,
        });
      }
    },
    findMany: async ({ where }: any) => {
      if (where.kind === 'SHARED_LIST_INVITE') return [];
      inboxWhere = where;
      return [...notifications.values()].filter((row) => row.userId === where.userId);
    },
  },
};
const auth = { getOrCreateUser: async () => ({ id: ownerId }) };
const service = new FollowsService(auth as never, prisma);
const inbox = new NotificationsService(auth as never, prisma, {} as never, {} as never, {} as never);
const identity = {} as never;

async function run() {
  assert.equal((await service.followUser(identity, followedUserId)).status, 'following');
  const first = [...notifications.values()][0];
  assert.equal(first.userId, followedUserId);
  assert.equal(first.actorUserId, followerId);
  assert.equal(first.body, 'Maya started following you.');
  assert.equal(first.kind, 'FOLLOW');
  assert.deepEqual(first.routeMetadata, { route: 'PublicProfile', userId: followerId });
  first.readAt = new Date();
  await Promise.all([service.followUser(identity, followedUserId), service.followUser(identity, followedUserId)]);
  assert.equal(notifications.size, 1, 'Repeated follows must not duplicate or reset the alert');
  assert.ok(first.readAt);
  await service.unfollowUser(identity, followedUserId);
  await service.followUser(identity, followedUserId);
  assert.equal(notifications.size, 2, 'A new follow after unfollow is a new event');

  await service.unfollowUser(identity, followedUserId);
  notifications.clear();
  visibility = PrivacyVisibility.PRIVATE;
  assert.equal((await service.followUser(identity, followedUserId)).status, 'pending');
  assert.equal(notifications.size, 0, 'Pending requests keep the existing approval flow');
  await assert.rejects(service.acceptRequest(identity, followerId), NotFoundException);
  ownerId = followedUserId;
  failNotification = true;
  await assert.rejects(service.acceptRequest(identity, followerId), /Notification write failed/);
  assert.equal((follow as Follow | null)?.status, FollowStatus.PENDING, 'Approval and alert must commit together');
  failNotification = false;
  await service.acceptRequest(identity, followerId);
  assert.equal(notifications.size, 1);
  await assert.rejects(service.acceptRequest(identity, followerId), NotFoundException);
  const response = await inbox.list(identity);
  assert.equal(response.items[0]?.kind, 'follow');
  assert.equal(response.items[0]?.type, 'follow');
  assert.equal(response.items[0]?.actorUserId, followerId);
  assert.deepEqual(inboxWhere.OR, [
    { kind: { not: 'FOLLOW' } },
    { actor: { blockedUsers: { none: { blockedUserId: followedUserId } }, blockedBy: { none: { blockerId: followedUserId } } } },
  ], 'Follow alerts exclude blocked or deleted actors');
  ownerId = followerId;
  assert.equal((await inbox.list(identity)).items.length, 0, 'Alerts belong only to the followed account');

  await service.unfollowUser(identity, followedUserId);
  notifications.clear();
  await service.followUser(identity, followedUserId);
  ownerId = followedUserId;
  await service.rejectRequest(identity, followerId);
  assert.equal(notifications.size, 0, 'Declining a request never creates a follower alert');
  ownerId = followerId;
  await assert.rejects(service.followUser(identity, followerId), BadRequestException);
  blocked = true;
  await assert.rejects(service.followUser(identity, followedUserId), ForbiddenException);
  assert.equal(notifications.size, 0);
  blocked = false;
  visibility = PrivacyVisibility.PUBLIC;
  failNotification = true;
  await assert.rejects(service.followUser(identity, followedUserId), /Notification write failed/);
  assert.equal(follow, null, 'Follow and alert must commit together');
  console.log('Follow notifications QA passed.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
