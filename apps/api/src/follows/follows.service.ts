import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { assertUuid } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { FollowStatus, NotificationKind, PrivacyVisibility } from '../generated/prisma/enums';

@Injectable()
export class FollowsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getFollowState(identity: AuthenticatedIdentity, targetUserId: string) {
    const followerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    return this.getFollowStateByUserIds(followerId, targetUserId);
  }

  async followUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const followerId = await this.getUserId(identity);

    assertUuid(targetUserId);
    assertNotSelf(followerId, targetUserId);
    const requestedStatus = await this.getRequestedFollowStatus(followerId, targetUserId);

    const follow = await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const savedFollow = await tx.userFollow.upsert({
          create: {
            followedUserId: targetUserId,
            followerId,
            status: requestedStatus,
          },
          update: requestedStatus === FollowStatus.ACCEPTED
            ? { status: FollowStatus.ACCEPTED }
            : {},
          where: {
            followerId_followedUserId: {
              followedUserId: targetUserId,
              followerId,
            },
          },
        });
        if (savedFollow.status === FollowStatus.ACCEPTED) {
          await createFollowNotification(tx, savedFollow);
        }
        return savedFollow;
      }),
    );

    return toFollowState(targetUserId, follow);
  }

  async unfollowUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const followerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userFollow.deleteMany({
      where: {
        followedUserId: targetUserId,
        followerId,
      },
      }),
    );

    return toFollowState(targetUserId, null);
  }

  async listPendingRequests(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const requests = await this.prisma.withConnectionRetry(() =>
      this.prisma.userFollow.findMany({
        include: {
          follower: {
            select: {
              displayName: true,
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          followedUserId: userId,
          status: FollowStatus.PENDING,
        },
      }),
    );

    return {
      items: requests.map((request) => ({
        displayName: request.follower.displayName,
        requestedAt: request.createdAt.toISOString(),
        userId: request.follower.id,
      })),
    };
  }

  async acceptRequest(identity: AuthenticatedIdentity, followerId: string) {
    const followedUserId = await this.getUserId(identity);

    assertUuid(followerId);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const result = await tx.userFollow.updateMany({
          data: {
            status: FollowStatus.ACCEPTED,
          },
          where: {
            followedUserId,
            followerId,
            status: FollowStatus.PENDING,
          },
        });
        if (result.count === 0) {
          throw new NotFoundException('Follow request not found.');
        }
        const follow = await tx.userFollow.findUniqueOrThrow({
          where: { followerId_followedUserId: { followedUserId, followerId } },
        });
        await createFollowNotification(tx, follow);
      }),
    );

    return { accepted: true, userId: followerId };
  }

  async rejectRequest(identity: AuthenticatedIdentity, followerId: string) {
    const followedUserId = await this.getUserId(identity);

    assertUuid(followerId);

    const result = await this.prisma.withConnectionRetry(() =>
      this.prisma.userFollow.deleteMany({
        where: {
          followedUserId,
          followerId,
          status: FollowStatus.PENDING,
        },
      }),
    );

    if (result.count === 0) {
      throw new NotFoundException('Follow request not found.');
    }

    return { rejected: true, userId: followerId };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getFollowStateByUserIds(followerId: string, followedUserId: string) {
    const follow = await this.prisma.withConnectionRetry(() =>
      this.prisma.userFollow.findUnique({
      where: {
        followerId_followedUserId: {
          followedUserId,
          followerId,
        },
      },
      }),
    );

    return toFollowState(followedUserId, follow);
  }

  private async getRequestedFollowStatus(followerId: string, followedUserId: string) {
    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
      include: {
        privacySettings: true,
      },
      where: {
        id: followedUserId,
      },
      }),
    );

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const block = await this.prisma.withConnectionRetry(() =>
      this.prisma.userBlock.findFirst({
      where: {
        OR: [
          {
            blockedUserId: followedUserId,
            blockerId: followerId,
          },
          {
            blockedUserId: followerId,
            blockerId: followedUserId,
          },
        ],
      },
      }),
    );

    if (block) {
      throw new ForbiddenException('This profile is unavailable.');
    }

    return user.privacySettings?.profileVisibility === PrivacyVisibility.PRIVATE
      ? FollowStatus.PENDING
      : FollowStatus.ACCEPTED;
  }
}

async function createFollowNotification(
  tx: Prisma.TransactionClient,
  follow: {
    id: string;
    followedUserId: string;
    followerId: string;
  },
) {
  const follower = await tx.user.findUniqueOrThrow({
    where: { id: follow.followerId },
    select: { displayName: true, handle: true },
  });
  const name = follower.displayName?.trim() || follower.handle || 'A Watchly member';
  await tx.notification.createMany({
    data: [{
      actorUserId: follow.followerId,
      body: `${name} started following you.`,
      dedupeKey: `follow:${follow.id}`,
      kind: NotificationKind.FOLLOW,
      routeMetadata: { route: 'PublicProfile', userId: follow.followerId },
      title: 'New follower',
      userId: follow.followedUserId,
    }],
    skipDuplicates: true,
  });
}

function toFollowState(
  userId: string,
  follow: { createdAt: Date; status: FollowStatus } | null,
) {
  const status = follow?.status === FollowStatus.PENDING
    ? 'pending' as const
    : follow
      ? 'following' as const
      : 'none' as const;

  return {
    followedAt: follow?.createdAt.toISOString() ?? null,
    following: status === 'following',
    status,
    userId,
  };
}

function assertNotSelf(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new BadRequestException('Users cannot follow themselves.');
  }
}
