// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { PrivacyVisibility } from '../generated/prisma/enums';
import { FeedService } from './feed.service';

type Review = {
  id: string;
  moderationHiddenAt: Date | null;
  userId: string;
  user: {
    privacySettings: {
      profileVisibility: PrivacyVisibility;
      reviewsVisibility: PrivacyVisibility;
    } | null;
    suspendedAt: Date | null;
    suspendedUntil: Date | null;
  };
};

async function run() {
  const movieLikes = new Set<string>();
  const episodeLikes = new Set<string>();
  let blocked = false;
  let moderationHiddenAt: Date | null = null;
  let movieListWhere: unknown;
  let episodeListWhere: unknown;
  let reviewVisibility: PrivacyVisibility = PrivacyVisibility.PUBLIC;
  let suspendedAt: Date | null = null;
  let suspendedUntil: Date | null = null;
  const review = (id: string): Review => ({
    id,
    moderationHiddenAt,
    userId: 'author',
    user: {
      privacySettings: {
        profileVisibility: PrivacyVisibility.PUBLIC,
        reviewsVisibility: reviewVisibility,
      },
      suspendedAt,
      suspendedUntil,
    },
  });
  const createLikeDelegate = (likes: Set<string>) => ({
    count: async ({ where }: { where: { reviewId: string } }) =>
      [...likes].filter((key) => key.endsWith(`:${where.reviewId}`)).length,
    deleteMany: async ({ where }: { where: { reviewId: string; userId: string } }) => {
      const deleted = likes.delete(`${where.userId}:${where.reviewId}`);
      return { count: deleted ? 1 : 0 };
    },
    upsert: async ({
      create,
      where,
    }: {
      create: { reviewId: string; userId: string };
      where: { userId_reviewId: { reviewId: string; userId: string } };
    }) => {
      assert.deepEqual(create, where.userId_reviewId);
      likes.add(`${create.userId}:${create.reviewId}`);
      return { id: 'like' };
    },
  });
  const prisma = {
    episodeReviewLike: createLikeDelegate(episodeLikes),
    movieReviewLike: createLikeDelegate(movieLikes),
    userBlock: {
      findFirst: async () => blocked ? { id: 'block' } : null,
      findMany: async () => [],
    },
    userEpisodeReview: {
      findMany: async ({ where }: { where: unknown }) => {
        episodeListWhere = where;
        return [];
      },
      findUnique: async ({ where }: { where: { id: string } }) => review(where.id),
    },
    userEpisodeRating: {
      findMany: async () => [],
    },
    userFollow: {
      findMany: async () => [{
        followedUser: {
          privacySettings: {
            profileVisibility: PrivacyVisibility.PUBLIC,
            reviewsVisibility: PrivacyVisibility.PUBLIC,
          },
          suspendedAt: null,
          suspendedUntil: null,
        },
        followedUserId: 'author',
      }],
    },
    userMovieReview: {
      findMany: async ({ where }: { where: unknown }) => {
        movieListWhere = where;
        return [];
      },
      findUnique: async ({ where }: { where: { id: string } }) => review(where.id),
    },
    userMovieRating: {
      findMany: async () => [],
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new FeedService(
    { getOrCreateUser: async () => ({ id: 'viewer' }) } as never,
    prisma as never,
    { getPublicUrl: () => null } as never,
  );
  const identity = { firebaseUid: 'viewer' } as never;

  assert.deepEqual(await service.listFeed(identity), { items: [] });
  assert.deepEqual(movieListWhere, {
    moderationHiddenAt: null,
    userId: { in: ['author'] },
  });
  assert.deepEqual(episodeListWhere, {
    moderationHiddenAt: null,
    userId: { in: ['author'] },
  });

  assert.deepEqual(await service.likeMovieReview(identity, 'movie-review'), {
    likeCount: 1,
    likedByViewer: true,
  });
  assert.deepEqual(await service.likeMovieReview(identity, 'movie-review'), {
    likeCount: 1,
    likedByViewer: true,
  });
  assert.deepEqual(await service.unlikeMovieReview(identity, 'movie-review'), {
    likeCount: 0,
    likedByViewer: false,
  });
  assert.deepEqual(await service.unlikeMovieReview(identity, 'movie-review'), {
    likeCount: 0,
    likedByViewer: false,
  });
  assert.deepEqual(await service.likeEpisodeReview(identity, 'episode-review'), {
    likeCount: 1,
    likedByViewer: true,
  });

  reviewVisibility = PrivacyVisibility.PRIVATE;
  await assert.rejects(
    () => service.likeMovieReview(identity, 'private-review'),
    NotFoundException,
  );

  reviewVisibility = PrivacyVisibility.PUBLIC;
  moderationHiddenAt = new Date('2026-08-13T12:00:00.000Z');
  await assert.rejects(
    () => service.likeMovieReview(identity, 'hidden-review'),
    NotFoundException,
  );

  moderationHiddenAt = null;
  suspendedAt = new Date('2026-08-13T12:00:00.000Z');
  suspendedUntil = null;
  await assert.rejects(
    () => service.likeEpisodeReview(identity, 'suspended-author-review'),
    NotFoundException,
  );

  suspendedAt = null;
  suspendedUntil = null;
  blocked = true;
  await assert.rejects(
    () => service.likeEpisodeReview(identity, 'blocked-review'),
    NotFoundException,
  );

  console.log('Feed likes QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
