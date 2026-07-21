// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { PrivacyVisibility } from '../generated/prisma/enums';
import { FeedService } from './feed.service';

type Review = {
  id: string;
  userId: string;
  user: {
    privacySettings: {
      profileVisibility: PrivacyVisibility;
      reviewsVisibility: PrivacyVisibility;
    } | null;
  };
};

async function run() {
  const movieLikes = new Set<string>();
  const episodeLikes = new Set<string>();
  let blocked = false;
  let reviewVisibility: PrivacyVisibility = PrivacyVisibility.PUBLIC;
  const review = (id: string): Review => ({
    id,
    userId: 'author',
    user: {
      privacySettings: {
        profileVisibility: PrivacyVisibility.PUBLIC,
        reviewsVisibility: reviewVisibility,
      },
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
    },
    userEpisodeReview: {
      findUnique: async ({ where }: { where: { id: string } }) => review(where.id),
    },
    userMovieReview: {
      findUnique: async ({ where }: { where: { id: string } }) => review(where.id),
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new FeedService(
    { getOrCreateUser: async () => ({ id: 'viewer' }) } as never,
    prisma as never,
  );
  const identity = { firebaseUid: 'viewer' } as never;

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
