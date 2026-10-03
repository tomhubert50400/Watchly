import 'reflect-metadata';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TrackingService } from './tracking.service';
import { SaveFavoriteOrderDto } from './tracking.dto';

async function run() {
  const rows = [
    { id: 'a', userId: 'owner', contentType: 'MOVIE', tmdbId: 1, favorite: true, favoritePosition: null as number | null, status: 'WATCHED', updatedAt: new Date('2026-01-01') },
    { id: 'b', userId: 'owner', contentType: 'SERIES', tmdbId: 1, favorite: true, favoritePosition: null as number | null, status: 'WATCHING', updatedAt: new Date('2026-02-01') },
    { id: 'c', userId: 'owner', contentType: 'MOVIE', tmdbId: 2, favorite: false, favoritePosition: null as number | null, status: 'WATCHED', updatedAt: new Date('2026-03-01') },
    { id: 'd', userId: 'other', contentType: 'MOVIE', tmdbId: 3, favorite: true, favoritePosition: null as number | null, status: 'WATCHED', updatedAt: new Date('2026-04-01') },
  ];
  const before = structuredClone(rows);
  const tx = { userContentState: {
    findMany: async ({ where }: { where: { userId: string; favorite: boolean } }) => rows.filter((row) => row.userId === where.userId && row.favorite === where.favorite),
    update: async ({ where, data }: { where: { id: string }; data: { favoritePosition: number; updatedAt: Date } }) => Object.assign(rows.find((row) => row.id === where.id)!, data),
  } };
  const service = new TrackingService({ getOrCreateUser: async () => ({ id: 'owner' }) } as never, {
    $transaction: async (operation: (transaction: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, 'Serializable');
      return operation(tx);
    },
  } as never);
  const items = [{ contentType: 'series' as const, tmdbId: 1 }, { contentType: 'movie' as const, tmdbId: 1 }];
  const saved = await service.saveFavoriteOrder({} as never, { items });
  assert.deepEqual(saved.map((item) => [item.contentType, item.tmdbId, item.favoritePosition]), [['series', 1, 0], ['movie', 1, 1]]);
  assert.deepEqual(rows.map(({ favoritePosition: _position, ...row }) => row), before.map(({ favoritePosition: _position, ...row }) => row), 'reordering must preserve statuses, favorites, owners and activity dates');
  const after = structuredClone(rows);
  for (const invalid of [items.slice(0, 1), [...items, { contentType: 'movie' as const, tmdbId: 2 }], [items[0]!, { contentType: 'movie' as const, tmdbId: 3 }]]) {
    await assert.rejects(service.saveFavoriteOrder({} as never, { items: invalid }), /favorites changed/);
  }
  await assert.rejects(service.saveFavoriteOrder({} as never, { items: [items[0]!, items[0]!] }), /only once/);
  assert.deepEqual(rows, after, 'invalid, incomplete or foreign orders must leave stored positions unchanged');
  assert.equal((await validate(plainToInstance(SaveFavoriteOrderDto, { items }))).length, 0);
  for (const invalid of [{}, { items: 'bad' }, { items: [null] }, { items: [items[0], items[0]] }, { items: [{ contentType: 'episode', tmdbId: 1 }] }, { items: [{ contentType: 'movie', tmdbId: -1 }] }]) {
    assert.ok((await validate(plainToInstance(SaveFavoriteOrderDto, invalid))).length);
  }
  console.log('Favorite order API QA passed.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
