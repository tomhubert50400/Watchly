import assert from 'node:assert/strict';
import { RatingsService } from './ratings.service';

async function run() {
  const upserts: Array<Record<string, unknown>> = [];
  const deletes: Array<Record<string, unknown>> = [];
  const storedRating = {
    id: 'series-rating-id',
    scoreHalfSteps: 9,
    seriesTmdbId: 1399,
    updatedAt: new Date('2026-09-05T00:00:00.000Z'),
  };
  const authService = {
    getOrCreateUser: async () => ({ id: 'user-id' }),
  };
  const prisma = {
    userSeriesRating: {
      deleteMany: async (input: Record<string, unknown>) => {
        deletes.push(input);
      },
      findUnique: async () => storedRating,
      upsert: async (input: Record<string, unknown>) => {
        upserts.push(input);
        return { ...storedRating, scoreHalfSteps: 8 };
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new RatingsService(authService as never, prisma as never);
  const identity = {} as never;

  assert.deepEqual(await service.getSeriesRating(identity, 1399), {
    id: 'series-rating-id',
    score: 4.5,
    seriesTmdbId: 1399,
    updatedAt: '2026-09-05T00:00:00.000Z',
  });

  assert.equal((await service.upsertSeriesRating(identity, 1399, 4)).score, 4);
  assert.deepEqual(upserts[0], {
    create: { scoreHalfSteps: 8, seriesTmdbId: 1399, userId: 'user-id' },
    update: { scoreHalfSteps: 8 },
    where: { userId_seriesTmdbId: { seriesTmdbId: 1399, userId: 'user-id' } },
  });

  await assert.rejects(
    service.upsertSeriesRating(identity, 1399, 4.25),
    /score must be between 0.5 and 5 in 0.5 increments/,
  );

  await service.deleteSeriesRating(identity, 1399);
  assert.deepEqual(deletes[0], {
    where: { seriesTmdbId: 1399, userId: 'user-id' },
  });

  console.log('Series ratings QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
