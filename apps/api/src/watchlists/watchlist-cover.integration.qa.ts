import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { WatchlistsService } from './watchlists.service';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';

async function run() {
  const connectionString = process.env.DATABASE_URL!;
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname), 'Run only against a local test database');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const rollback = new Error('Rollback cover QA fixtures');
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { firebaseUid: `cover-qa-${randomUUID()}` } });
      const auth = { getOrCreateUser: async () => owner };
      const database = new Proxy(tx, {
        get(target, key) {
          if (key === 'withConnectionRetry') return (operation: () => unknown) => operation();
          if (key === '$transaction') return (operation: (transaction: typeof tx) => unknown) => operation(tx);
          return Reflect.get(target, key);
        },
      });
      const personal = new WatchlistsService(auth as never, database as never);
      const shared = new SharedWatchlistsService(auth as never, database as never);
      const identity = {} as AuthenticatedIdentity;
      for (const kind of ['personal', 'shared'] as const) {
        const data = { name: 'Cover QA', items: { create: [
          { contentType: 'MOVIE' as const, tmdbId: 550 },
          { contentType: 'SERIES' as const, tmdbId: 1399 },
          { contentType: 'MOVIE' as const, tmdbId: 11 },
          { contentType: 'SERIES' as const, tmdbId: 1396 },
        ] } };
        const list = kind === 'personal'
          ? await tx.personalWatchlist.create({ data: { ...data, userId: owner.id }, include: { items: true } })
          : await tx.sharedWatchlist.create({ data: { ...data, ownerId: owner.id, members: { create: { userId: owner.id } } }, include: { items: true } });
        const service = kind === 'personal' ? personal : shared;
        const read = () => kind === 'personal' ? personal.getWatchlist(identity, list.id) : shared.getSharedWatchlist(identity, list.id);
        const ids = list.items.map((item) => item.id).reverse();
        for (let count = 1; count <= 4; count++) {
          await service.updateCover(identity, list.id, ids.slice(0, count));
          assert.deepEqual((await read()).coverItemIds, ids.slice(0, count));
        }
        const removed = list.items.find((item) => item.id === ids[0])!;
        await service.removeItem(identity, list.id, removed.contentType === 'MOVIE' ? 'movie' : 'series', removed.tmdbId);
        assert.deepEqual((await read()).coverItemIds, ids.slice(1), 'Deleted titles must disappear from the cover');
        await service.updateCover(identity, list.id, []);
        assert.deepEqual((await read()).coverItemIds, []);
      }
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
    console.log('Watchlist cover database QA passed; fixtures rolled back.');
  } finally {
    await prisma.$disconnect();
  }
}
void run();
