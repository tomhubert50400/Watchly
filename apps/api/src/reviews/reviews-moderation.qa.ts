import assert from 'node:assert/strict';
import { PrivacyVisibility } from '../generated/prisma/enums';
import { ReviewsService } from './reviews.service';

async function run() {
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

  console.log('Reviews moderation QA passed.');
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
