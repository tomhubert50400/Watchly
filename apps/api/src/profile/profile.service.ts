import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  AuthProvider,
  PrivacyVisibility,
  SharedWatchlistVisibility,
} from '../generated/prisma/enums';
import { assertUuid } from '../blocks/blocks.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { withPrismaConnectionRetry } from '../database/prisma-retry';
import { PrismaService } from '../database/prisma.service';
import {
  PrivacyVisibilityValue,
  SharedWatchlistVisibilityValue,
  UpdatePrivacySettingsDto,
  UpdateProfileDto,
} from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getProfile(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getProfileByUserId(userId);
  }

  async getOwnPublicProfilePreview(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getPublicProfileByUserId(userId, false);
  }

  async getPublicProfile(identity: AuthenticatedIdentity, targetUserId: string) {
    assertUuid(targetUserId);

    const viewerId = await this.getUserId(identity);

    return this.getPublicProfileByUserId(targetUserId, viewerId === targetUserId, viewerId);
  }

  async getOrCreateDevTestUser(identity: AuthenticatedIdentity) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev test profile is disabled.');
    }

    const viewerId = await this.getUserId(identity);

    const identityKey = {
      provider: AuthProvider.GOOGLE,
      providerUserId: '__dev_block_test_profile__',
    };
    const existingIdentity = await withPrismaConnectionRetry(
      () =>
        this.prisma.authIdentity.findUnique({
          include: {
            user: {
              include: {
                privacySettings: true,
              },
            },
          },
          where: {
            provider_providerUserId: identityKey,
          },
        }),
    );

    if (existingIdentity) {
      await this.ensurePublicTestProfile(existingIdentity.user.id, viewerId);

      return this.getPublicProfileByUserId(existingIdentity.user.id, true);
    }

    const user = await this.prisma.user.create({
      data: {
        authIdentities: {
          create: identityKey,
        },
        displayName: 'Test profile',
        privacySettings: {
          create: {
            profileVisibility: PrivacyVisibility.PUBLIC,
            reviewsVisibility: PrivacyVisibility.PUBLIC,
          },
        },
      },
    });

    await this.ensurePublicTestProfile(user.id, viewerId);

    return this.getPublicProfileByUserId(user.id, true);
  }

  async updateProfile(identity: AuthenticatedIdentity, input: UpdateProfileDto) {
    if (!hasOwn(input, 'displayName')) {
      throw new BadRequestException('displayName is required.');
    }

    const userId = await this.getUserId(identity);
    const displayName = normalizeDisplayName(input.displayName);

    await this.prisma.user.update({
      data: {
        displayName,
      },
      where: {
        id: userId,
      },
    });

    return this.getProfileByUserId(userId);
  }

  async updatePrivacy(identity: AuthenticatedIdentity, input: UpdatePrivacySettingsDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Provide at least one privacy setting.');
    }

    const userId = await this.getUserId(identity);
    const profileVisibility = input.profileVisibility
      ? toPrivacyVisibility(input.profileVisibility)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.privacySettings.upsert({
        create: {
          episodeProgressVisibility: input.episodeProgressVisibility
            ? toPrivacyVisibility(input.episodeProgressVisibility)
            : undefined,
          profileVisibility,
          ratingsVisibility: input.ratingsVisibility
            ? toPrivacyVisibility(input.ratingsVisibility)
            : undefined,
          reviewsVisibility: profileVisibility,
          sharedWatchlistVisibility: input.sharedWatchlistVisibility
            ? toSharedWatchlistVisibility(input.sharedWatchlistVisibility)
            : undefined,
          userId,
          viewingHistoryVisibility: input.viewingHistoryVisibility
            ? toPrivacyVisibility(input.viewingHistoryVisibility)
            : undefined,
        },
        update: {
          ...(input.episodeProgressVisibility
            ? { episodeProgressVisibility: toPrivacyVisibility(input.episodeProgressVisibility) }
            : {}),
          ...(profileVisibility
            ? { profileVisibility, reviewsVisibility: profileVisibility }
            : {}),
          ...(input.ratingsVisibility
            ? { ratingsVisibility: toPrivacyVisibility(input.ratingsVisibility) }
            : {}),
          ...(input.sharedWatchlistVisibility
            ? {
                sharedWatchlistVisibility: toSharedWatchlistVisibility(
                  input.sharedWatchlistVisibility,
                ),
              }
            : {}),
          ...(input.viewingHistoryVisibility
            ? { viewingHistoryVisibility: toPrivacyVisibility(input.viewingHistoryVisibility) }
            : {}),
        },
        where: {
          userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.PRIVACY_UPDATED,
          actorUserId: userId,
          metadata: {
            changedFields: getPrivacyAuditFields(input),
          },
        },
      });
    });

    return this.getProfileByUserId(userId);
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getProfileByUserId(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      include: {
        privacySettings: true,
      },
      where: {
        id: userId,
      },
    });

    const privacySettings =
      user.privacySettings ??
      (await this.prisma.privacySettings.create({
        data: {
          userId,
        },
      }));

    return {
      displayName: user.displayName,
      id: user.id,
      privacy: {
        episodeProgressVisibility: fromPrivacyVisibility(
          privacySettings.episodeProgressVisibility,
        ),
        profileVisibility: fromPrivacyVisibility(privacySettings.profileVisibility),
        ratingsVisibility: fromPrivacyVisibility(privacySettings.ratingsVisibility),
        reviewsFollowProfileVisibility: true,
        sharedWatchlistVisibility: fromSharedWatchlistVisibility(
          privacySettings.sharedWatchlistVisibility,
        ),
        viewingHistoryVisibility: fromPrivacyVisibility(
          privacySettings.viewingHistoryVisibility,
        ),
      },
    };
  }

  private async getPublicProfileByUserId(
    userId: string,
    allowOwnerPrivateView: boolean,
    viewerId?: string,
  ) {
    const user = await withPrismaConnectionRetry(
      () =>
        this.prisma.user.findUnique({
          include: {
            privacySettings: true,
          },
          where: {
            id: userId,
          },
        }),
    );

    if (!user) {
      throw new NotFoundException('Profile not found.');
    }

    if (
      !allowOwnerPrivateView &&
      user.privacySettings?.profileVisibility === PrivacyVisibility.PRIVATE
    ) {
      throw new ForbiddenException('This profile is private.');
    }

    if (!allowOwnerPrivateView && viewerId) {
      await this.assertNotBlockedByEitherUser(viewerId, userId);
    }

    return {
      displayName: user.displayName,
      id: user.id,
      profileVisibility: fromPrivacyVisibility(
        user.privacySettings?.profileVisibility ?? PrivacyVisibility.PUBLIC,
      ),
    };
  }

  private async ensurePublicTestProfile(userId: string, viewerId: string) {
    await withPrismaConnectionRetry(
      () =>
        this.prisma.user.update({
          data: {
            displayName: 'Test profile',
            privacySettings: {
              upsert: {
                create: {
                  profileVisibility: PrivacyVisibility.PUBLIC,
                  reviewsVisibility: PrivacyVisibility.PUBLIC,
                },
                update: {
                  profileVisibility: PrivacyVisibility.PUBLIC,
                  reviewsVisibility: PrivacyVisibility.PUBLIC,
                },
              },
            },
          },
          where: {
            id: userId,
          },
        }),
    );

    await withPrismaConnectionRetry(
      () =>
        this.prisma.userBlock.deleteMany({
          where: {
            OR: [
              {
                blockedUserId: userId,
                blockerId: viewerId,
              },
              {
                blockedUserId: viewerId,
                blockerId: userId,
              },
            ],
          },
        }),
    );

    await withPrismaConnectionRetry(
      () =>
        this.prisma.userMovieReview.upsert({
          create: {
            body: DEV_TEST_REVIEW_BODY,
            tmdbId: DEV_TEST_REVIEW_TMDB_ID,
            userId,
          },
          update: {
            body: DEV_TEST_REVIEW_BODY,
          },
          where: {
            userId_tmdbId: {
              tmdbId: DEV_TEST_REVIEW_TMDB_ID,
              userId,
            },
          },
        }),
    );
  }

  private async assertNotBlockedByEitherUser(viewerId: string, targetUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          {
            blockedUserId: targetUserId,
            blockerId: viewerId,
          },
          {
            blockedUserId: viewerId,
            blockerId: targetUserId,
          },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('This profile is unavailable.');
    }
  }
}

function normalizeDisplayName(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const displayName = value.trim();

  return displayName.length > 0 ? displayName : null;
}

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toPrivacyVisibility(value: PrivacyVisibilityValue) {
  return value === 'public' ? PrivacyVisibility.PUBLIC : PrivacyVisibility.PRIVATE;
}

function fromPrivacyVisibility(value: PrivacyVisibility): PrivacyVisibilityValue {
  return value === PrivacyVisibility.PUBLIC ? 'public' : 'private';
}

function toSharedWatchlistVisibility(value: SharedWatchlistVisibilityValue) {
  return value === 'members'
    ? SharedWatchlistVisibility.MEMBERS
    : SharedWatchlistVisibility.PRIVATE;
}

function fromSharedWatchlistVisibility(
  value: SharedWatchlistVisibility,
): SharedWatchlistVisibilityValue {
  return value === SharedWatchlistVisibility.MEMBERS ? 'members' : 'private';
}

function getPrivacyAuditFields(input: UpdatePrivacySettingsDto) {
  const fields = Object.keys(input);

  if (hasOwn(input, 'profileVisibility')) {
    fields.push('reviewsVisibility');
  }

  return Array.from(new Set(fields)).sort();
}

const DEV_TEST_REVIEW_TMDB_ID = 603;
const DEV_TEST_REVIEW_BODY =
  'Dev feed test review. This public written review should appear in Feed.';
