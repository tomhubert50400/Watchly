import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { withPrismaConnectionRetry } from '../database/prisma-retry';
import { PrismaService } from '../database/prisma.service';
import { AuditAction } from '../generated/prisma/enums';

@Injectable()
export class BlocksService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getBlockState(identity: AuthenticatedIdentity, targetUserId: string) {
    const blockerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    return this.getBlockStateByUserIds(blockerId, targetUserId);
  }

  async blockUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const blockerId = await this.getUserId(identity);

    assertUuid(targetUserId);
    assertNotSelf(blockerId, targetUserId);
    await this.assertUserExists(targetUserId);

    const block = await this.prisma.$transaction(async (tx) => {
      const createdBlock = await tx.userBlock.upsert({
        create: {
          blockedUserId: targetUserId,
          blockerId,
        },
        update: {},
        where: {
          blockerId_blockedUserId: {
            blockedUserId: targetUserId,
            blockerId,
          },
        },
      });

      await tx.userFollow.deleteMany({
        where: {
          OR: [
            {
              followedUserId: targetUserId,
              followerId: blockerId,
            },
            {
              followedUserId: blockerId,
              followerId: targetUserId,
            },
          ],
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.USER_BLOCKED,
          actorUserId: blockerId,
          targetUserId,
        },
      });

      return createdBlock;
    });

    return {
      blocked: true,
      blockedAt: block.createdAt.toISOString(),
      userId: targetUserId,
    };
  }

  async unblockUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const blockerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userBlock.deleteMany({
        where: {
          blockedUserId: targetUserId,
          blockerId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.USER_UNBLOCKED,
          actorUserId: blockerId,
          targetUserId,
        },
      });
    });

    return {
      blocked: false,
      blockedAt: null,
      userId: targetUserId,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getBlockStateByUserIds(blockerId: string, blockedUserId: string) {
    const block = await withPrismaConnectionRetry(
      () =>
        this.prisma.userBlock.findUnique({
          where: {
            blockerId_blockedUserId: {
              blockedUserId,
              blockerId,
            },
          },
        }),
    );

    return {
      blocked: Boolean(block),
      blockedAt: block?.createdAt.toISOString() ?? null,
      userId: blockedUserId,
    };
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }
  }
}

export function assertUuid(value: string) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new BadRequestException('userId must be a valid UUID.');
  }
}

function assertNotSelf(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new BadRequestException('Users cannot block themselves.');
  }
}
