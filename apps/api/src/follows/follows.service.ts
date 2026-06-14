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
import { PrivacyVisibility } from '../generated/prisma/enums';

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
    await this.assertFollowAllowed(followerId, targetUserId);

    const follow = await this.prisma.userFollow.upsert({
      create: {
        followedUserId: targetUserId,
        followerId,
      },
      update: {},
      where: {
        followerId_followedUserId: {
          followedUserId: targetUserId,
          followerId,
        },
      },
    });

    return {
      followedAt: follow.createdAt.toISOString(),
      following: true,
      userId: targetUserId,
    };
  }

  async unfollowUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const followerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    await this.prisma.userFollow.deleteMany({
      where: {
        followedUserId: targetUserId,
        followerId,
      },
    });

    return {
      followedAt: null,
      following: false,
      userId: targetUserId,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getFollowStateByUserIds(followerId: string, followedUserId: string) {
    const follow = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followedUserId: {
          followedUserId,
          followerId,
        },
      },
    });

    return {
      followedAt: follow?.createdAt.toISOString() ?? null,
      following: Boolean(follow),
      userId: followedUserId,
    };
  }

  private async assertFollowAllowed(followerId: string, followedUserId: string) {
    const user = await this.prisma.user.findUnique({
      include: {
        privacySettings: true,
      },
      where: {
        id: followedUserId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.privacySettings?.profileVisibility === PrivacyVisibility.PRIVATE) {
      throw new ForbiddenException('This profile is private.');
    }

    const block = await this.prisma.userBlock.findFirst({
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
    });

    if (block) {
      throw new ForbiddenException('This profile is unavailable.');
    }
  }
}

function assertNotSelf(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new BadRequestException('Users cannot follow themselves.');
  }
}
