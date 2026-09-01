import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AuditAction } from '../generated/prisma/enums';
import { AvatarStorageService } from '../media/avatar-storage.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_QUERY_LENGTH = 80;

@Injectable()
export class BlocksService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvatarStorageService) private readonly avatarStorage: AvatarStorageService,
  ) {}

  async listBlockedUsers(
    identity: AuthenticatedIdentity,
    cursorValue?: string,
    limitValue?: string,
    queryValue?: string,
  ) {
    const blockerId = await this.getUserId(identity);
    const cursor = parseCursor(cursorValue);
    const pageSize = parsePageSize(limitValue);
    const query = parseSearchQuery(queryValue);
    const blocks = await this.prisma.withConnectionRetry(() =>
      this.prisma.userBlock.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          blockedUser: {
            select: {
              avatarObjectKey: true,
              displayName: true,
              handle: true,
              id: true,
            },
          },
          createdAt: true,
          id: true,
        },
        take: pageSize + 1,
        where: {
          ...(cursor || query ? {
            AND: [
              ...(cursor ? [{
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }] : []),
              ...(query ? [{
                blockedUser: {
                  OR: [
                    { displayName: { contains: query, mode: 'insensitive' as const } },
                    { handle: { contains: query, mode: 'insensitive' as const } },
                  ],
                },
              }] : []),
            ],
          } : {}),
          blockerId,
        },
      }),
    );
    const page = blocks.slice(0, pageSize);
    const lastBlock = page.at(-1);

    return {
      items: page.map((block) => ({
        avatarUrl: this.avatarStorage.getPublicUrl(block.blockedUser.avatarObjectKey),
        blockedAt: block.createdAt.toISOString(),
        displayName: block.blockedUser.displayName?.trim()
          || block.blockedUser.handle
          || 'Watchly member',
        handle: block.blockedUser.handle,
        userId: block.blockedUser.id,
      })),
      nextCursor: blocks.length > pageSize && lastBlock
        ? encodeCursor(lastBlock.createdAt, lastBlock.id)
        : null,
    };
  }

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

    const block = await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
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
      }),
    );

    return {
      blocked: true,
      blockedAt: block.createdAt.toISOString(),
      userId: targetUserId,
    };
  }

  async unblockUser(identity: AuthenticatedIdentity, targetUserId: string) {
    const blockerId = await this.getUserId(identity);

    assertUuid(targetUserId);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
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
      }),
    );

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
    const block = await this.prisma.withConnectionRetry(
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
    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: userId,
      },
      }),
    );

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

function parsePageSize(value?: string) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;

  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const pageSize = Number(value);
  if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new BadRequestException(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }

  return pageSize;
}

function parseSearchQuery(value?: string) {
  if (value === undefined) return null;

  const query = value.trim().replace(/^@+/, '');
  if (!query) return null;
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new BadRequestException(`query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.`);
  }

  return query;
}

function parseCursor(value?: string) {
  if (!value) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid cursor');

    const { createdAt: createdAtValue, id } = decoded as Record<string, unknown>;
    const createdAt = new Date(typeof createdAtValue === 'string' ? createdAtValue : '');
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (Number.isNaN(createdAt.getTime()) || typeof id !== 'string' || !uuidPattern.test(id)) {
      throw new Error('Invalid cursor');
    }

    return { createdAt, id };
  } catch {
    throw new BadRequestException('cursor is invalid.');
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64url');
}
