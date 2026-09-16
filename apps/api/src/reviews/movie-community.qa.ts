import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { MovieCommunityController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

async function run() {
  const queries: Record<string, any> = {};
  let groups = [{ scoreHalfSteps: 1, _count: { _all: 1 } }, { scoreHalfSteps: 9, _count: { _all: 2 } }];
  const reviews = Array.from({ length: 7 }, (_, index) => ({
    id: `review-${index}`, body: `Review ${index}`, updatedAt: new Date('2026-09-16'),
    user: { id: `user-${index}`, displayName: `Member ${index}`, avatarObjectKey: null, movieRatings: [{ scoreHalfSteps: 9 }] },
  }));
  const prisma = {
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
    userBlock: { findMany: async (query: unknown) => {
      queries.blocks = query;
      return [{ blockerId: 'viewer', blockedUserId: 'blocked' }, { blockerId: 'blocked-by', blockedUserId: 'viewer' }];
    } },
    userMovieRating: { groupBy: async (query: unknown) => { queries.ratings = query; return groups; } },
    userMovieReview: {
      count: async (query: unknown) => { queries.count = query; return reviews.length; },
      findMany: async (query: any) => { queries.reviews = query; return reviews.slice(query.skip, query.skip + query.take); },
    },
  };
  const service = new ReviewsService(
    { getOrCreateUser: async () => ({ id: 'viewer' }) } as never,
    prisma as never,
    { getPublicUrl: () => null } as never,
  );
  const response = await service.getMovieCommunity({} as never, 603);
  assert.equal(response.ratingCount, 3);
  assert.equal(response.averageScore, 3.2);
  assert.equal(response.distribution.length, 10);
  assert.deepEqual(response.distribution[0], { score: 0.5, count: 1 });
  assert.deepEqual(response.distribution[8], { score: 4.5, count: 2 });
  assert.deepEqual(response.distribution[9], { score: 5, count: 0 });
  assert.equal(response.reviews.length, 6);
  assert.equal(response.reviews[0].score, 4.5);
  assert.equal(response.reviewCount, 7);
  assert.equal(response.nextPage, 2);
  assert.deepEqual(queries.blocks.where.OR, [{ blockedUserId: 'viewer' }, { blockerId: 'viewer' }]);
  for (const query of [queries.ratings, queries.reviews, queries.count]) {
    assert.equal(query.where.tmdbId, 603);
    assert.deepEqual(query.where.user.id.notIn, ['blocked', 'blocked-by']);
    assert.equal(query.where.user.privacySettings.profileVisibility, 'PUBLIC');
    assert.deepEqual(query.where.user.AND[0].OR[0], { suspendedAt: null });
    assert(query.where.user.AND[0].OR[1].suspendedUntil.lte instanceof Date);
  }
  assert.equal(queries.reviews.where.moderationHiddenAt, null);
  assert.equal(queries.reviews.where.user.privacySettings.reviewsVisibility, 'PUBLIC');
  assert.deepEqual(queries.reviews.where.user.movieRatings, { some: { tmdbId: 603 } });
  assert.deepEqual(queries.count.where, queries.reviews.where);
  assert.equal(queries.ratings.where.user.OR[0].privacySettings.ratingsVisibility, 'PUBLIC');
  assert.equal(queries.ratings.where.user.OR[1].privacySettings.reviewsVisibility, 'PUBLIC');
  assert.deepEqual(queries.ratings.where.user.OR[1].movieReviews.some, { tmdbId: 603, moderationHiddenAt: null });
  assert.deepEqual(queries.reviews.include.user.select.movieRatings.where, { tmdbId: 603 });
  assert.deepEqual(queries.reviews.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  const second = await service.getMovieCommunity(null, 603, 2, 6);
  assert.equal(second.reviews.length, 1);
  assert.equal(second.nextPage, null);
  assert.deepEqual(queries.reviews.where.user.id.notIn, []);
  groups = [];
  reviews.length = 0;
  const empty = await service.getMovieCommunity(null, 603);
  assert.equal(empty.averageScore, null);
  assert.equal(empty.ratingCount, 0);
  assert.equal(empty.reviewCount, 0);
  assert.equal(empty.nextPage, null);
  assert(empty.distribution.every((bucket) => bucket.count === 0));
  const controller = new MovieCommunityController(service);
  for (const [page, limit] of [['0', '6'], ['1.5', '6'], ['1', '21'], ['1', '0'], ['NaN', '6']]) {
    await assert.rejects(controller.get({} as never, '603', page, limit), BadRequestException);
  }
  await assert.rejects(controller.get({} as never, '-1'), BadRequestException);
  assert.deepEqual(await controller.get({} as never, '603'), empty);
  console.log('Movie community QA passed: distribution, pagination, privacy, blocks, moderation and empty states.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
