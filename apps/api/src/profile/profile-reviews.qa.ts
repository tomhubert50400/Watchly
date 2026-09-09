import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

async function run() {
  let viewerId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  let visibility = 'PUBLIC';
  let blockedBy: string | null = null;
  let accepted = false;
  let exists = true;
  let reads = 0;
  const movies = Array.from({ length: 75 }, (_, index) => ({ id: `movie-${index}`, tmdbId: index + 1, body: `Review ${index}`, updatedAt: new Date(2020, 0, index + 1) }));
  const prisma = {
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
    user: {
      findUnique: async () => exists ? { id: userId, personalWatchlists: [], privacySettings: { profileVisibility: visibility } } : null,
      findUniqueOrThrow: async () => ({ _count: { followers: 0, following: 0, movieReviews: 75, episodeReviews: 1, movieRatings: 0, episodeRatings: 0, seriesRatings: 0 } }),
    },
    userFollow: { findFirst: async () => accepted ? { id: 'follow' } : null },
    userBlock: { findMany: async () => blockedBy ? [{ blockerId: blockedBy }] : [] },
    userMovieRating: { findMany: async () => [{ tmdbId: 1, scoreHalfSteps: 9 }] },
    userSeriesRating: { findMany: async () => [] },
    userEpisodeRating: { findMany: async () => [] },
    userMovieReview: { findMany: async (args: { take?: number; where: unknown }) => {
      reads++;
      assert.deepEqual(args.where, { moderationHiddenAt: null, userId });
      return movies.slice(0, args.take);
    } },
    userEpisodeReview: { findMany: async (args: { take?: number; where: unknown }) => {
      assert.deepEqual(args.where, { moderationHiddenAt: null, userId });
      return [{ id: 'episode', body: 'Episode review', seriesTmdbId: 2, seasonNumber: 1, episodeNumber: 1, updatedAt: new Date('2026-01-01') }].slice(0, args.take);
    } },
  };
  const service = new ProfileService(
    { getOrCreateUser: async () => ({ id: viewerId }) } as never,
    { get: () => undefined } as never,
    prisma as never,
    { getPublicUrl: () => null } as never,
  );
  const identity = { providerUserId: 'viewer' } as never;
  const response = await service.listProfileReviews(identity, userId);
  assert.equal(response.items.length, 76, 'reviews beyond the 50-opinion preview are retained');
  assert.equal(response.items[0].id, 'episode');
  assert.equal(response.items.find((item) => item.id === 'movie-0')?.score, 4.5);
  assert.ok(response.items.every((item) => 'body' in item));
  visibility = 'PRIVATE';
  const priorReads = reads;
  await assert.rejects(() => service.listProfileReviews(identity, userId), ForbiddenException);
  assert.equal(reads, priorReads, 'private review content is not queried');
  accepted = true;
  assert.equal((await service.listProfileReviews(identity, userId)).items.length, 76);
  for (const blocker of [viewerId, userId]) {
    blockedBy = blocker;
    const before = reads;
    await assert.rejects(() => service.listProfileReviews(identity, userId), ForbiddenException);
    assert.equal(reads, before);
  }
  blockedBy = null;
  accepted = false;
  viewerId = userId;
  assert.equal((await service.listProfileReviews(identity, userId)).items.length, 76, 'owner can read private reviews');
  exists = false;
  await assert.rejects(() => service.listProfileReviews(identity, userId), NotFoundException);
  console.log('Profile reviews access and completeness QA passed.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
