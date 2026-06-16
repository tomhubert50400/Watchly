import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PrivacyVisibility } from '../generated/prisma/enums';

type FeedAuthor = {
  displayName: string | null;
  id: string;
};

type FeedMovieReview = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: Date;
  user: FeedAuthor;
};

type FeedEpisodeReview = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
  user: FeedAuthor;
};

@Injectable()
export class FeedService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

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
            user: {
              select: {
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
            userId: {
              in: authorIds,
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
          orderBy: {
            updatedAt: 'desc',
          },
          take: FEED_LIMIT,
          where: {
            userId: {
              in: authorIds,
            },
          },
        }),
      ]);

      const items = [
        ...movieReviews.map(toMovieFeedItem),
        ...episodeReviews.map(toEpisodeFeedItem),
      ]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, FEED_LIMIT);

      return { items };
    });
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
          follow.followedUser.privacySettings?.profileVisibility === PrivacyVisibility.PUBLIC &&
          follow.followedUser.privacySettings.reviewsVisibility === PrivacyVisibility.PUBLIC,
      )
      .map((follow) => follow.followedUserId);
  }
}

const FEED_LIMIT = 30;

function toMovieFeedItem(review: FeedMovieReview) {
  return {
    author: toAuthor(review.user),
    body: review.body,
    content: {
      contentType: 'movie' as const,
      tmdbId: review.tmdbId,
    },
    id: review.id,
    type: 'movieReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toEpisodeFeedItem(review: FeedEpisodeReview) {
  return {
    author: toAuthor(review.user),
    body: review.body,
    content: {
      contentType: 'episode' as const,
      episodeNumber: review.episodeNumber,
      seasonNumber: review.seasonNumber,
      seriesTmdbId: review.seriesTmdbId,
    },
    id: review.id,
    type: 'episodeReview' as const,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toAuthor(author: FeedAuthor) {
  return {
    displayName: author.displayName,
    id: author.id,
  };
}
