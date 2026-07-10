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

  async listOwnOpinions(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    const movieRatings = await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          take: PROFILE_OPINION_LIMIT,
          where: {
            userId,
          },
        }),
    );
    const episodeRatings = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeRating.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          take: PROFILE_OPINION_LIMIT,
          where: {
            userId,
          },
        }),
    );
    const movieReviews = await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieReview.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          take: PROFILE_OPINION_LIMIT,
          where: {
            userId,
          },
        }),
    );
    const episodeReviews = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeReview.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          take: PROFILE_OPINION_LIMIT,
          where: {
            userId,
          },
        }),
    );
    const movieReviewTmdbIds = new Set(movieReviews.map((review) => review.tmdbId));
    const episodeReviewKeys = new Set(episodeReviews.map(getEpisodeOpinionKey));
    const movieRatingByTmdbId = new Map(
      movieRatings.map((rating) => [rating.tmdbId, rating.scoreHalfSteps / 2]),
    );
    const episodeRatingByKey = new Map(
      episodeRatings.map((rating) => [getEpisodeOpinionKey(rating), rating.scoreHalfSteps / 2]),
    );
    const items = [
      ...movieRatings
        .filter((rating) => !movieReviewTmdbIds.has(rating.tmdbId))
        .map(toMovieRatingOpinion),
      ...episodeRatings
        .filter((rating) => !episodeReviewKeys.has(getEpisodeOpinionKey(rating)))
        .map(toEpisodeRatingOpinion),
      ...movieReviews.flatMap((review) => {
        const score = movieRatingByTmdbId.get(review.tmdbId);

        return score === undefined ? [] : [toMovieReviewOpinion(review, score)];
      }),
      ...episodeReviews.flatMap((review) => {
        const score = episodeRatingByKey.get(getEpisodeOpinionKey(review));

        return score === undefined ? [] : [toEpisodeReviewOpinion(review, score)];
      }),
    ]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, PROFILE_OPINION_LIMIT);

    return { items, stats: await this.getProfileStats(userId) };
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
    const existingIdentity = await this.prisma.withConnectionRetry(
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

    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.create({
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
      }),
    );

    await this.ensurePublicTestProfile(user.id, viewerId);

    return this.getPublicProfileByUserId(user.id, true);
  }

  async updateProfile(identity: AuthenticatedIdentity, input: UpdateProfileDto) {
    if (!hasOwn(input, 'displayName')) {
      throw new BadRequestException('displayName is required.');
    }

    const userId = await this.getUserId(identity);
    const displayName = normalizeDisplayName(input.displayName);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
      data: {
        displayName,
      },
      where: {
        id: userId,
      },
      }),
    );

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

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
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
      }),
    );

    return this.getProfileByUserId(userId);
  }

  async completeOnboarding(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
      data: {
        onboardingCompleted: true,
      },
      where: {
        id: userId,
      },
      }),
    );

    return {
      displayName: user.displayName,
      id: user.id,
      onboardingCompleted: user.onboardingCompleted,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getProfileByUserId(userId: string) {
    const { privacySettings, user } = await this.prisma.withConnectionRetry(async () => {
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

      return { privacySettings, user };
    });

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
    const user = await this.prisma.withConnectionRetry(
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
      stats: await this.getProfileStats(user.id),
    };
  }

  private async getProfileStats(userId: string) {
    const [
      movieReviews,
      episodeReviews,
      movieRatings,
      episodeRatings,
      followersCount,
      followingCount,
    ] =
      await this.prisma.withConnectionRetry(() =>
        this.prisma.$transaction([
          this.prisma.userMovieReview.count({ where: { userId } }),
          this.prisma.userEpisodeReview.count({ where: { userId } }),
          this.prisma.userMovieRating.count({ where: { userId } }),
          this.prisma.userEpisodeRating.count({ where: { userId } }),
          this.prisma.userFollow.count({ where: { followedUserId: userId } }),
          this.prisma.userFollow.count({ where: { followerId: userId } }),
        ]),
      );

    return {
      followersCount,
      followingCount,
      postsCount: movieRatings + episodeRatings,
      reviewsCount: movieReviews + episodeReviews,
    };
  }

  private async ensurePublicTestProfile(userId: string, viewerId: string) {
    await this.prisma.withConnectionRetry(
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

    await this.prisma.withConnectionRetry(
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

    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.userMovieRating.upsert({
            create: {
              scoreHalfSteps: 8,
              tmdbId: DEV_TEST_REVIEW_TMDB_ID,
              userId,
            },
            update: {
              scoreHalfSteps: 8,
            },
            where: {
              userId_tmdbId: {
                tmdbId: DEV_TEST_REVIEW_TMDB_ID,
                userId,
              },
            },
          });
          await tx.userMovieReview.upsert({
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
          });
        }),
    );
  }

  private async assertNotBlockedByEitherUser(viewerId: string, targetUserId: string) {
    const block = await this.prisma.withConnectionRetry(() =>
      this.prisma.userBlock.findFirst({
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
      }),
    );

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

type MovieRatingOpinionRecord = {
  id: string;
  scoreHalfSteps: number;
  tmdbId: number;
  updatedAt: Date;
};

type EpisodeRatingOpinionRecord = {
  episodeNumber: number;
  id: string;
  scoreHalfSteps: number;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

type MovieReviewOpinionRecord = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: Date;
};

type EpisodeReviewOpinionRecord = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

function toMovieRatingOpinion(rating: MovieRatingOpinionRecord) {
  return {
    content: {
      contentType: 'movie' as const,
      tmdbId: rating.tmdbId,
    },
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    type: 'movieRating' as const,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toEpisodeRatingOpinion(rating: EpisodeRatingOpinionRecord) {
  return {
    content: {
      contentType: 'episode' as const,
      episodeNumber: rating.episodeNumber,
      seasonNumber: rating.seasonNumber,
      seriesTmdbId: rating.seriesTmdbId,
    },
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    type: 'episodeRating' as const,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toMovieReviewOpinion(review: MovieReviewOpinionRecord, score: number) {
  return {
    body: review.body,
    content: {
      contentType: 'movie' as const,
      tmdbId: review.tmdbId,
    },
    id: review.id,
    score,
    type: 'movieReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toEpisodeReviewOpinion(review: EpisodeReviewOpinionRecord, score: number) {
  return {
    body: review.body,
    content: {
      contentType: 'episode' as const,
      episodeNumber: review.episodeNumber,
      seasonNumber: review.seasonNumber,
      seriesTmdbId: review.seriesTmdbId,
    },
    id: review.id,
    score,
    type: 'episodeReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function getEpisodeOpinionKey(
  item: Pick<EpisodeRatingOpinionRecord | EpisodeReviewOpinionRecord, 'episodeNumber' | 'seasonNumber' | 'seriesTmdbId'>,
) {
  return `${item.seriesTmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
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
const PROFILE_OPINION_LIMIT = 50;
