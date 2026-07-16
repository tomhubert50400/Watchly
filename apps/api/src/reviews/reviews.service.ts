import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PrivacyVisibility } from '../generated/prisma/enums';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getMovieReview(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);
    const review = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userMovieReview.findUnique({
          where: {
            userId_tmdbId: {
              tmdbId,
              userId,
            },
          },
        }),
    );

    return review ? toApiMovieReview(review) : null;
  }

  async upsertMovieReview(identity: AuthenticatedIdentity, tmdbId: number, body: string) {
    const userId = await this.getUserId(identity);
    const reviewBody = normalizeBody(body);
    await this.assertMovieRatingExists(userId, tmdbId);

    const review = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userMovieReview.upsert({
          create: {
            body: reviewBody,
            tmdbId,
            userId,
          },
          update: {
            body: reviewBody,
          },
          where: {
            userId_tmdbId: {
              tmdbId,
              userId,
            },
          },
        }),
    );

    return toApiMovieReview(review);
  }

  async deleteMovieReview(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userMovieReview.deleteMany({
          where: {
            tmdbId,
            userId,
          },
        }),
    );
  }

  async getEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);
    const review = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userEpisodeReview.findUnique({
          where: {
            userId_seriesTmdbId_seasonNumber_episodeNumber: {
              episodeNumber,
              seasonNumber,
              seriesTmdbId,
              userId,
            },
          },
        }),
    );

    return review ? toApiEpisodeReview(review) : null;
  }

  async upsertEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    body: string,
  ) {
    const userId = await this.getUserId(identity);
    const reviewBody = normalizeBody(body);
    await this.assertEpisodeRatingExists(userId, seriesTmdbId, seasonNumber, episodeNumber);

    const review = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userEpisodeReview.upsert({
          create: {
            body: reviewBody,
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
          update: {
            body: reviewBody,
          },
          where: {
            userId_seriesTmdbId_seasonNumber_episodeNumber: {
              episodeNumber,
              seasonNumber,
              seriesTmdbId,
              userId,
            },
          },
        }),
    );

    return toApiEpisodeReview(review);
  }

  async deleteEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userEpisodeReview.deleteMany({
          where: {
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
        }),
    );
  }

  async getEpisodeCommunity(
    identity: AuthenticatedIdentity | null,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const viewerId = identity ? await this.getUserId(identity) : null;

    return this.prisma.withConnectionRetry(async () => {
      const blocks = viewerId
        ? await this.prisma.userBlock.findMany({
            where: {
              OR: [
                { blockedUserId: viewerId },
                { blockerId: viewerId },
              ],
            },
          })
        : [];
      const blockedUserIds = blocks.map((block) =>
        block.blockerId === viewerId ? block.blockedUserId : block.blockerId,
      );
      const episodeKey = { episodeNumber, seasonNumber, seriesTmdbId };
      const visibleUserFilter = blockedUserIds.length > 0
        ? { userId: { notIn: blockedUserIds } }
        : {};
      const [ratingSummary, reviews] = await Promise.all([
        this.prisma.userEpisodeRating.aggregate({
          _avg: { scoreHalfSteps: true },
          _count: { scoreHalfSteps: true },
          where: {
            ...episodeKey,
            ...visibleUserFilter,
            OR: [
              {
                user: {
                  privacySettings: {
                    ratingsVisibility: PrivacyVisibility.PUBLIC,
                  },
                },
              },
              {
                user: {
                  episodeReviews: { some: episodeKey },
                  privacySettings: {
                    reviewsVisibility: PrivacyVisibility.PUBLIC,
                  },
                },
              },
            ],
            user: {
              privacySettings: {
                profileVisibility: PrivacyVisibility.PUBLIC,
              },
            },
          },
        }),
        this.prisma.userEpisodeReview.findMany({
          include: {
            user: {
              select: {
                displayName: true,
                id: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: EPISODE_COMMUNITY_REVIEW_LIMIT,
          where: {
            ...episodeKey,
            ...visibleUserFilter,
            user: {
              privacySettings: {
                profileVisibility: PrivacyVisibility.PUBLIC,
                reviewsVisibility: PrivacyVisibility.PUBLIC,
              },
            },
          },
        }),
      ]);
      const reviewRatings = reviews.length > 0
        ? await this.prisma.userEpisodeRating.findMany({
            select: {
              scoreHalfSteps: true,
              userId: true,
            },
            where: {
              ...episodeKey,
              userId: { in: reviews.map((review) => review.userId) },
            },
          })
        : [];
      const ratingByUserId = new Map(
        reviewRatings.map((rating) => [rating.userId, rating.scoreHalfSteps / 2]),
      );

      return {
        averageScore: toAverageScore(ratingSummary._avg.scoreHalfSteps),
        ratingCount: ratingSummary._count.scoreHalfSteps,
        reviews: reviews.flatMap((review) => {
          const score = ratingByUserId.get(review.userId);

          return score === undefined
            ? []
            : [{
                author: {
                  displayName: review.user.displayName,
                  id: review.user.id,
                },
                body: review.body,
                id: review.id,
                score,
                updatedAt: review.updatedAt.toISOString(),
              }];
        }),
      };
    });
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async assertMovieRatingExists(userId: string, tmdbId: number) {
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.findUnique({
        select: {
          id: true,
        },
        where: {
          userId_tmdbId: {
            tmdbId,
            userId,
          },
        },
      }),
    );

    if (!rating) {
      throw new BadRequestException('Add a rating before writing a review.');
    }
  }

  private async assertEpisodeRatingExists(
    userId: string,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeRating.findUnique({
        select: {
          id: true,
        },
        where: {
          userId_seriesTmdbId_seasonNumber_episodeNumber: {
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
        },
      }),
    );

    if (!rating) {
      throw new BadRequestException('Add a rating before writing a review.');
    }
  }
}

type UserMovieReviewRecord = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: Date;
};

type UserEpisodeReviewRecord = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

function normalizeBody(body: string) {
  const normalized = body.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('Review body cannot be empty.');
  }

  if (normalized.length > 5000) {
    throw new BadRequestException('Review body must be 5000 characters or fewer.');
  }

  return normalized;
}

function toApiMovieReview(review: UserMovieReviewRecord) {
  return {
    body: review.body,
    id: review.id,
    tmdbId: review.tmdbId,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toApiEpisodeReview(review: UserEpisodeReviewRecord) {
  return {
    body: review.body,
    episodeNumber: review.episodeNumber,
    id: review.id,
    seasonNumber: review.seasonNumber,
    seriesTmdbId: review.seriesTmdbId,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toAverageScore(averageHalfSteps: number | null) {
  return averageHalfSteps === null ? null : Math.round((averageHalfSteps / 2) * 10) / 10;
}

const EPISODE_COMMUNITY_REVIEW_LIMIT = 3;
