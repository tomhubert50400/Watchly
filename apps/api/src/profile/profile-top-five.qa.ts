import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProfileService } from './profile.service';
import { UpdateProfileTopFiveDto } from './profile.dto';

async function run() {
  const owner = '11111111-1111-4111-8111-111111111111';
  const viewer = '22222222-2222-4222-8222-222222222222';
  const stored = { id: owner, topFive: [] as UpdateProfileTopFiveDto['items'], personalWatchlists: [],
    privacySettings: { profileVisibility: 'PUBLIC' } };
  let following = false;
  let blocked = false;
  let writes = 0;
  const prisma = {
    withConnectionRetry: async (run: () => Promise<unknown>) => run(),
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { topFive: UpdateProfileTopFiveDto['items'] } }) => {
        assert.equal(where.id, owner, 'writes use the authenticated owner');
        writes++;
        stored.topFive = structuredClone(data.topFive);
      },
      findUnique: async () => structuredClone(stored),
      findUniqueOrThrow: async () => structuredClone(stored),
    },
    userFollow: { findFirst: async () => following ? { id: 'follow' } : null },
  };
  const service = new ProfileService(
    { getOrCreateUser: async (identity: { providerUserId: string }) => ({ id: identity.providerUserId }) } as never,
    { get: () => undefined } as never, prisma as never, { getPublicUrl: () => null } as never,
  );
  Object.assign(service, {
    getProfileBlockRelationship: async () => blocked ? 'blocked_by_viewer' : null,
    listOpinionsForUser: async () => ({ items: [], stats: {} }),
    getPublicProfileMedia: async () => ({}),
    getProfileSocialStats: async () => ({}),
  });
  const identity = { providerUserId: owner } as never;
  const viewerIdentity = { providerUserId: viewer } as never;
  const items: UpdateProfileTopFiveDto['items'] = [
    { contentType: 'series', tmdbId: 42 }, { contentType: 'movie', tmdbId: 42 },
    { contentType: 'movie', tmdbId: 603 }, { contentType: 'series', tmdbId: 1399 },
    { contentType: 'movie', tmdbId: 550 },
  ];
  assert.equal(validateSync(plainToInstance(UpdateProfileTopFiveDto, { items })).length, 0);
  assert.deepEqual(await service.updateTopFive(identity, { items }), { items });
  assert.deepEqual((await service.getProfile(identity)).topFive, items, 'own profile restores saved order');
  assert.deepEqual((await service.getPublicProfile(viewerIdentity, owner)).topFive, items, 'public profile shares the same ranking');
  for (let count = 0; count < 5; count++) {
    stored.topFive = items.slice(0, count);
    assert.deepEqual((await service.getPublicProfile(viewerIdentity, owner)).topFive, [], 'incomplete legacy selections stay hidden');
    assert.deepEqual((await service.getProfile(identity)).topFive, stored.topFive, 'owners retain incomplete selections to finish editing');
  }
  stored.topFive = items;
  stored.privacySettings.profileVisibility = 'PRIVATE';
  assert.deepEqual((await service.getPublicProfile(viewerIdentity, owner)).topFive, []);
  following = true;
  assert.deepEqual((await service.getPublicProfile(viewerIdentity, owner)).topFive, items);
  blocked = true;
  assert.deepEqual((await service.getPublicProfile(viewerIdentity, owner)).topFive, []);
  for (const invalid of [null, {}, ...Array.from({ length: 5 }, (_, count) => items.slice(0, count)),
    [...items, { contentType: 'movie', tmdbId: 99 }], [items[0], items[0], ...items.slice(2)],
    [null], [{ contentType: 'episode', tmdbId: 1 }], [{ contentType: 'movie', tmdbId: 0 }],
    [{ contentType: 'movie', tmdbId: 1.5 }], [{ contentType: 'movie', tmdbId: '42' }]]) {
    assert.ok(validateSync(plainToInstance(UpdateProfileTopFiveDto, { items: invalid })).length > 0);
    await assert.rejects(service.updateTopFive(identity, { items: invalid } as never), BadRequestException);
  }
  assert.equal(writes, 1, 'invalid selections never reach persistence');
  const reordered = [...items].reverse();
  await service.updateTopFive(identity, { items: reordered });
  assert.deepEqual((await service.getProfile(identity)).topFive, reordered);
  await assert.rejects(service.updateTopFive(identity, { items: [] }), BadRequestException);
  assert.deepEqual((await service.getProfile(identity)).topFive, reordered, 'an incomplete edit preserves the existing ranking');
  console.log('Profile Top 5 QA passed: persistence, order, owner scope, validation and privacy.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
