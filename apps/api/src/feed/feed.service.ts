import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { FollowStatus, PrivacyVisibility } from '../generated/prisma/enums';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { isAccountSuspended } from '../moderation/account-suspension';
import { communityFeed } from './community-feed';

type FeedAuthor = {
  avatarObjectKey: string | null;
  displayName: string | null;
  id: string;
};

type FeedMovieReview = {
  _count: {
    likes: number;
  };
  body: string;
  id: string;
  likes: Array<{ id: string }>;
  tmdbId: number;
  updatedAt: Date;
  user: FeedAuthor;
  userId: string;
};

type FeedEpisodeReview = {
  _count: {
    likes: number;
  };
  body: string;
  episodeNumber: number;
  id: string;
  likes: Array<{ id: string }>;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
  user: FeedAuthor;
  userId: string;
};

type FeedMovieRating = {
  scoreHalfSteps: number;
  tmdbId: number;
  userId: string;
};

type FeedEpisodeRating = {
  episodeNumber: number;
  scoreHalfSteps: number;
  seasonNumber: number;
  seriesTmdbId: number;
  userId: string;
};

type VisibleReview = {
  moderationHiddenAt: Date | null;
  user: {
    privacySettings: {
      profileVisibility: PrivacyVisibility;
      reviewsVisibility: PrivacyVisibility;
    } | null;
    suspendedAt: Date | null;
    suspendedUntil: Date | null;
  };
  userId: string;
};

@Injectable()
export class FeedService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvatarStorageService) private readonly avatarStorage: AvatarStorageService,
  ) {}

  async listCommunity(identity: AuthenticatedIdentity, cursor?: string) {
    const viewer = await this.authService.getOrCreateUser(identity);
    return this.prisma.withConnectionRetry(() => communityFeed(this.prisma, this.avatarStorage, viewer.id, cursor));
  }

  async listFeed(identity: AuthenticatedIdentity) {
    const viewer = await this.authService.getOrCreateUser(identity);

    return this.prisma.withConnectionRetry(async () => {
      const authorIds = await this.getVisibleFollowedAuthorIds(viewer.id);

      if (authorIds.length === 0) {
        return { items: [] };
      }

      const [movieReviews, episodeReviews] = await Promise.all([
        this.prisma.userMovieReview.findMany({
          include: {
            _count: {
              select: {
                likes: true,
              },
            },
            likes: {
              select: {
                id: true,
              },
              where: {
                userId: viewer.id,
              },
            },
            user: {
              select: {
                avatarObjectKey: true,
                displayName: true,
                id: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: FEED_LIMIT,
          where: {
            moderationHiddenAt: null,
            userId: {
              in: authorIds,
            },
          },
        }),
        this.prisma.userEpisodeReview.findMany({
          include: {
            _count: {
              select: {
                likes: true,
              },
            },
            likes: {
              select: {
                id: true,
              },
              where: {
                userId: viewer.id,
              },
            },
            user: {
              select: {
                avatarObjectKey: true,
                displayName: true,
                id: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: FEED_LIMIT,
          where: {
            moderationHiddenAt: null,
            userId: {
              in: authorIds,
            },
          },
        }),
      ]);
      const [movieRatings, episodeRatings] = await Promise.all([
        this.prisma.userMovieRating.findMany({
          select: {
            scoreHalfSteps: true,
            tmdbId: true,
            userId: true,
          },
          where: {
            OR: movieReviews.map((review) => ({ tmdbId: review.tmdbId, userId: review.userId })),
          },
        }),
        this.prisma.userEpisodeRating.findMany({
          select: {
            episodeNumber: true,
            scoreHalfSteps: true,
            seasonNumber: true,
            seriesTmdbId: true,
            userId: true,
          },
          where: {
            OR: episodeReviews.map((review) => ({
              episodeNumber: review.episodeNumber,
              seasonNumber: review.seasonNumber,
              seriesTmdbId: review.seriesTmdbId,
              userId: review.userId,
            })),
          },
        }),
      ]);
      const movieScores = new Map(
        movieRatings.map((rating) => [getMovieRatingKey(rating), rating.scoreHalfSteps / 2]),
      );
      const episodeScores = new Map(
        episodeRatings.map((rating) => [getEpisodeRatingKey(rating), rating.scoreHalfSteps / 2]),
      );

      const items = [
        ...movieReviews.map((review) =>
          toMovieFeedItem(
            review,
            movieScores.get(getMovieRatingKey(review)) ?? null,
            this.avatarStorage,
          )),
        ...episodeReviews.map((review) =>
          toEpisodeFeedItem(
            review,
            episodeScores.get(getEpisodeRatingKey(review)) ?? null,
            this.avatarStorage,
          )),
      ]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, FEED_LIMIT);

      return { items };
    });
  }

  async likeMovieReview(identity: AuthenticatedIdentity, reviewId: string) {
    return this.setMovieReviewLike(identity, reviewId, true);
  }

  async unlikeMovieReview(identity: AuthenticatedIdentity, reviewId: string) {
    return this.setMovieReviewLike(identity, reviewId, false);
  }

  async likeEpisodeReview(identity: AuthenticatedIdentity, reviewId: string) {
    return this.setEpisodeReviewLike(identity, reviewId, true);
  }

  async unlikeEpisodeReview(identity: AuthenticatedIdentity, reviewId: string) {
    return this.setEpisodeReviewLike(identity, reviewId, false);
  }

  private async setMovieReviewLike(
    identity: AuthenticatedIdentity,
    reviewId: string,
    likedByViewer: boolean,
  ) {
    const viewer = await this.authService.getOrCreateUser(identity);

    return this.prisma.withConnectionRetry(async () => {
      const review = await this.prisma.userMovieReview.findUnique({
        include: {
          user: {
            include: {
              privacySettings: true,
            },
          },
        },
        where: { id: reviewId },
      });

      await this.assertReviewVisible(viewer.id, review);

      if (likedByViewer) {
        await this.prisma.movieReviewLike.upsert({
          create: { reviewId, userId: viewer.id },
          update: {},
          where: {
            userId_reviewId: { reviewId, userId: viewer.id },
          },
        });
      } else {
        await this.prisma.movieReviewLike.deleteMany({
          where: { reviewId, userId: viewer.id },
        });
      }

      return {
        likeCount: await this.prisma.movieReviewLike.count({ where: { reviewId } }),
        likedByViewer,
      };
    });
  }

  private async setEpisodeReviewLike(
    identity: AuthenticatedIdentity,
    reviewId: string,
    likedByViewer: boolean,
  ) {
    const viewer = await this.authService.getOrCreateUser(identity);

    return this.prisma.withConnectionRetry(async () => {
      const review = await this.prisma.userEpisodeReview.findUnique({
        include: {
          user: {
            include: {
              privacySettings: true,
            },
          },
        },
        where: { id: reviewId },
      });

      await this.assertReviewVisible(viewer.id, review);

      if (likedByViewer) {
        await this.prisma.episodeReviewLike.upsert({
          create: { reviewId, userId: viewer.id },
          update: {},
          where: {
            userId_reviewId: { reviewId, userId: viewer.id },
          },
        });
      } else {
        await this.prisma.episodeReviewLike.deleteMany({
          where: { reviewId, userId: viewer.id },
        });
      }

      return {
        likeCount: await this.prisma.episodeReviewLike.count({ where: { reviewId } }),
        likedByViewer,
      };
    });
  }

  private async assertReviewVisible(viewerId: string, review: VisibleReview | null) {
    if (
      !review ||
      review.moderationHiddenAt !== null ||
      isAccountSuspended(review.user) ||
      review.user.privacySettings?.profileVisibility !== PrivacyVisibility.PUBLIC ||
      review.user.privacySettings.reviewsVisibility !== PrivacyVisibility.PUBLIC
    ) {
      throw new NotFoundException('Review not found.');
    }

    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockedUserId: viewerId, blockerId: review.userId },
          { blockedUserId: review.userId, blockerId: viewerId },
        ],
      },
    });

    if (block) {
      throw new NotFoundException('Review not found.');
    }
  }

  private async getVisibleFollowedAuthorIds(viewerId: string) {
    const [follows, blocks] = await Promise.all([
      this.prisma.userFollow.findMany({
        include: {
          followedUser: {
            include: {
              privacySettings: true,
            },
          },
        },
        where: {
          followerId: viewerId,
          status: FollowStatus.ACCEPTED,
        },
      }),
      this.prisma.userBlock.findMany({
        where: {
          OR: [
            {
              blockedUserId: viewerId,
            },
            {
              blockerId: viewerId,
            },
          ],
        },
      }),
    ]);
    const blockedUserIds = new Set(
      blocks.map((block) => (block.blockerId === viewerId ? block.blockedUserId : block.blockerId)),
    );

    return follows
      .filter((follow) => !blockedUserIds.has(follow.followedUserId))
      .filter(
        (follow) =>
          !isAccountSuspended(follow.followedUser) &&
          follow.followedUser.privacySettings?.profileVisibility === PrivacyVisibility.PUBLIC &&
          follow.followedUser.privacySettings.reviewsVisibility === PrivacyVisibility.PUBLIC,
      )
      .map((follow) => follow.followedUserId);
  }
}

const FEED_LIMIT = 30;

function toMovieFeedItem(
  review: FeedMovieReview,
  score: number | null,
  avatarStorage: AvatarStorageService,
) {
  return {
    author: toAuthor(review.user, avatarStorage),
    body: review.body,
    content: {
      contentType: 'movie' as const,
      tmdbId: review.tmdbId,
    },
    id: review.id,
    likeCount: review._count.likes,
    likedByViewer: review.likes.length > 0,
    score,
    type: 'movieReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toEpisodeFeedItem(
  review: FeedEpisodeReview,
  score: number | null,
  avatarStorage: AvatarStorageService,
) {
  return {
    author: toAuthor(review.user, avatarStorage),
    body: review.body,
    content: {
      contentType: 'episode' as const,
      episodeNumber: review.episodeNumber,
      seasonNumber: review.seasonNumber,
      seriesTmdbId: review.seriesTmdbId,
    },
    id: review.id,
    likeCount: review._count.likes,
    likedByViewer: review.likes.length > 0,
    score,
    type: 'episodeReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toAuthor(author: FeedAuthor, avatarStorage: AvatarStorageService) {
  return {
    avatarUrl: avatarStorage.getPublicUrl(author.avatarObjectKey),
    displayName: author.displayName,
    id: author.id,
  };
}

function getMovieRatingKey(item: Pick<FeedMovieReview | FeedMovieRating, 'tmdbId' | 'userId'>) {
  return `${item.userId}:${item.tmdbId}`;
}

function getEpisodeRatingKey(
  item: Pick<FeedEpisodeReview | FeedEpisodeRating, 'episodeNumber' | 'seasonNumber' | 'seriesTmdbId' | 'userId'>,
) {
  return `${item.userId}:${item.seriesTmdbId}:${item.seasonNumber}:${item.episodeNumber}`;
}
