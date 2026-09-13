import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

async function run() {
  const userId = '22222222-2222-4222-8222-222222222222';
  let viewerId = '11111111-1111-4111-8111-111111111111';
  let historyVisibility = 'PUBLIC';
  let profileVisibility = 'PUBLIC';
  let ratingsVisibility = 'PUBLIC';
  let blockedBy: string | null = null;
  let accepted = false;
  let exists = true;
  let reads = 0;
  let take: number | undefined;
  const events = Array.from({ length: 7 }, (_, index) => ({ id: `event-${index}`, contentType: 'MOVIE', tmdbId: 1, watchedAt: new Date('2026-09-13'), title: 'Movie', artworkUrl: 'poster', seasonNumber: null, episodeNumber: null }));
  const prisma = {
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
    user: { findUnique: async () => exists ? { id: userId, privacySettings: { profileVisibility, viewingHistoryVisibility: historyVisibility, ratingsVisibility } } : null },
    userFollow: { findFirst: async () => accepted ? { id: 'follow' } : null },
    userBlock: { findMany: async () => blockedBy ? [{ blockerId: blockedBy }] : [] },
    viewingEvent: { findMany: async (args: { take?: number; where: unknown; orderBy: unknown }) => {
      reads++; take = args.take;
      assert.deepEqual(args.where, { userId, watchedAt: { not: null } });
      assert.deepEqual(args.orderBy, [{ watchedAt: 'desc' }, { createdAt: 'desc' }]);
      return events.slice(0, args.take);
    } },
    userMovieRating: { findMany: async () => [{ id: 'rating', tmdbId: 1, scoreHalfSteps: 9, updatedAt: new Date() }] },
    userEpisodeRating: { findMany: async () => [] },
    userMovieReview: { findMany: async (args: { where: { moderationHiddenAt: unknown } }) => {
      assert.equal(args.where.moderationHiddenAt, null);
      return [{ id: 'review', tmdbId: 1, body: 'Review', updatedAt: new Date() }];
    } },
    userEpisodeReview: { findMany: async () => [] },
  };
  const service = new ProfileService({ getOrCreateUser: async () => ({ id: viewerId }) } as never, { get: () => undefined } as never, prisma as never, {} as never);
  const identity = {} as never;
  const preview = await service.getViewingHistory(identity, userId, true);
  assert.equal(take, 3);
  assert.equal(preview.items.length, 3);
  assert.equal(preview.opinions[0]?.score, 4.5);
  const full = await service.getViewingHistory(identity, userId);
  assert.equal(take, undefined);
  assert.equal(full.items.length, 7, 'rewatches remain separate');
  assert.ok(full.opinions.some((item) => 'body' in item));
  ratingsVisibility = 'PRIVATE';
  assert.ok((await service.getViewingHistory(identity, userId)).opinions.every((item) => 'body' in item && item.score === null));
  historyVisibility = 'PRIVATE';
  let before = reads;
  await assert.rejects(() => service.getViewingHistory(identity, userId), ForbiddenException);
  assert.equal(reads, before, 'private history is not queried');
  historyVisibility = 'PUBLIC'; profileVisibility = 'PRIVATE';
  await assert.rejects(() => service.getViewingHistory(identity, userId), ForbiddenException);
  accepted = true;
  assert.equal((await service.getViewingHistory(identity, userId)).items.length, 7);
  for (const blocker of [viewerId, userId]) {
    blockedBy = blocker; before = reads;
    await assert.rejects(() => service.getViewingHistory(identity, userId), ForbiddenException);
    assert.equal(reads, before, 'blocking prevents reading history in either direction');
  }
  blockedBy = null; historyVisibility = 'PRIVATE'; viewerId = userId;
  assert.equal((await service.getViewingHistory(identity, userId)).items.length, 7, 'owner retains access');
  exists = false;
  await assert.rejects(() => service.getViewingHistory(identity, userId), NotFoundException);

  let privacyUpdate: any;
  const privacyPrisma = {
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation({
      privacySettings: { upsert: async (args: unknown) => { privacyUpdate = args; } },
      userFollow: { updateMany: async () => ({ count: 0 }) },
      auditLog: { create: async () => ({}) },
    }),
  };
  const privacyService = new ProfileService({ getOrCreateUser: async () => ({ id: userId }) } as never, {} as never, privacyPrisma as never, {} as never);
  (privacyService as any).getProfileByUserId = async () => ({});
  await privacyService.updatePrivacy(identity, { profileVisibility: 'public' });
  assert.equal(privacyUpdate.update.viewingHistoryVisibility, undefined, 'publishing the profile must not publish history');
  await privacyService.updatePrivacy(identity, { profileVisibility: 'public', viewingHistoryVisibility: 'private' });
  assert.equal(privacyUpdate.update.viewingHistoryVisibility, 'PRIVATE');
  await privacyService.updatePrivacy(identity, { viewingHistoryVisibility: 'public' });
  assert.equal(privacyUpdate.update.viewingHistoryVisibility, 'PUBLIC');
  console.log('Profile history QA passed: three previews, complete rewatches, ratings privacy, owners, followers, blocks and independent sharing.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
