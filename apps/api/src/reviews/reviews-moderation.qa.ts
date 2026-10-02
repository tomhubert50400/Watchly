import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PrivacyVisibility } from '../generated/prisma/enums';
import { ReviewsService } from './reviews.service';

async function run() {
  await verifyReviewRatingRequirement();
  let aggregateWhere: unknown;
  let reviewsWhere: unknown;
  const prisma = {
    userBlock: {
      findMany: async () => [],
    },
    userEpisodeRating: {
      aggregate: async ({ where }: { where: unknown }) => {
        aggregateWhere = where;
        return { _avg: { scoreHalfSteps: null }, _count: { scoreHalfSteps: 0 } };
      },
    },
    userEpisodeReview: {
      findMany: async ({ where }: { where: unknown }) => {
        reviewsWhere = where;
        return [];
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new ReviewsService(
    {} as never,
    prisma as never,
    { getPublicUrl: () => null } as never,
  );

  assert.deepEqual(await service.getEpisodeCommunity(null, 100, 2, 3), {
    averageScore: null,
    ratingCount: 0,
    reviews: [],
  });
  const reviewActiveFilter = getActiveFilter(reviewsWhere);
  const aggregateActiveFilter = getActiveFilter(aggregateWhere);
  assert.deepEqual(reviewsWhere, {
    episodeNumber: 3,
    moderationHiddenAt: null,
    seasonNumber: 2,
    seriesTmdbId: 100,
    user: {
      AND: [reviewActiveFilter],
      privacySettings: {
        profileVisibility: PrivacyVisibility.PUBLIC,
        reviewsVisibility: PrivacyVisibility.PUBLIC,
      },
    },
  });
  assert.deepEqual(aggregateWhere, {
    episodeNumber: 3,
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
          episodeReviews: {
            some: {
              episodeNumber: 3,
              moderationHiddenAt: null,
              seasonNumber: 2,
              seriesTmdbId: 100,
            },
          },
          privacySettings: {
            reviewsVisibility: PrivacyVisibility.PUBLIC,
          },
        },
      },
    ],
    seasonNumber: 2,
    seriesTmdbId: 100,
    user: {
      AND: [aggregateActiveFilter],
      privacySettings: {
        profileVisibility: PrivacyVisibility.PUBLIC,
      },
    },
  });

  console.log('Reviews moderation and rating requirement QA passed.');
}

async function verifyReviewRatingRequirement() {
  for (const kind of ['movie', 'episode'] as const) {
    let hasRating = false;
    let writes = 0;
    const expectedWhere = kind === 'movie'
      ? { userId_tmdbId: { tmdbId: 100, userId: 'reviewer' } }
      : { userId_seriesTmdbId_seasonNumber_episodeNumber: {
          episodeNumber: 3, seasonNumber: 2, seriesTmdbId: 100, userId: 'reviewer',
        } };
    const ratingModel = {
      findUnique: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, expectedWhere, 'Require the same author and exact movie or episode.');
        return hasRating ? { id: 'rating' } : null;
      },
    };
    const reviewModel = {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        writes += 1;
        return { ...create, id: 'review', updatedAt: new Date() };
      },
    };
    const service = new ReviewsService(
      { getOrCreateUser: async () => ({ id: 'reviewer' }) } as never,
      {
        userMovieRating: ratingModel,
        userEpisodeRating: ratingModel,
        userMovieReview: reviewModel,
        userEpisodeReview: reviewModel,
        withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
      } as never,
      {} as never,
    );
    const saveReview = () => kind === 'movie'
      ? service.upsertMovieReview({} as never, 100, ' Great film. ')
      : service.upsertEpisodeReview({} as never, 100, 2, 3, ' Great episode. ');

    await assert.rejects(saveReview, (error: unknown) =>
      error instanceof BadRequestException && error.getStatus() === 400
      && error.message === 'Add a rating before writing a review.');
    assert.equal(writes, 0, `${kind}: no review may be written without a rating.`);

    hasRating = true;
    assert.equal((await saveReview()).body, kind === 'movie' ? 'Great film.' : 'Great episode.');
    assert.equal(writes, 1);

    hasRating = false;
    await assert.rejects(saveReview, BadRequestException);
    assert.equal(writes, 1, `${kind}: updating a review also requires a rating.`);
  }
}

function getActiveFilter(where: unknown) {
  const user = (where as { user: { AND: Array<{ OR: unknown[] }> } }).user;
  const filter = user.AND[0];
  const cutoff = (filter?.OR[1] as { suspendedUntil: { lte: unknown } }).suspendedUntil.lte;

  assert.deepEqual(filter?.OR[0], { suspendedAt: null });
  assert(cutoff instanceof Date);
  return filter;
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
