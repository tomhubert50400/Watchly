import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';
import { UpdateWatchlistCoverDto } from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

async function run() {
  const ids = Array.from({ length: 5 }, (_, index) => `00000000-0000-4000-8000-00000000000${index}`);
  for (const invalid of [[...ids], [ids[0], ids[0]], ['invalid'], 'not-an-array', undefined]) {
    const dto = Object.assign(new UpdateWatchlistCoverDto(), { itemIds: invalid });
    assert.ok((await validate(dto)).length, 'Invalid cover payload must be rejected');
  }
  for (const itemIds of [[], ids.slice(0, 1), ids.slice(0, 4)]) {
    assert.equal((await validate(Object.assign(new UpdateWatchlistCoverDto(), { itemIds }))).length, 0);
  }
  for (const kind of ['personal', 'shared'] as const) {
    let saved: string[] = [];
    let owned = true;
    const model = {
      findFirst: async ({ where }: { where: Record<string, string> }) => {
        assert.equal(where[kind === 'personal' ? 'userId' : 'ownerId'], 'owner');
        return owned ? { items: ids.slice(0, 4).map((id) => ({ id })) } : null;
      },
      update: async ({ data }: { data: { coverItemIds: string[] } }) => { saved = [...data.coverItemIds]; },
    };
    const transaction = { personalWatchlist: model, sharedWatchlist: model };
    const prisma = {
      withConnectionRetry: <T>(operation: () => Promise<T>) => operation(),
      $transaction: <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction),
    };
    const auth = { getOrCreateUser: async () => ({ id: 'owner' }) };
    const Service = kind === 'personal' ? WatchlistsService : SharedWatchlistsService;
    const service = new Service(auth as never, prisma as never);
    const identity = {} as AuthenticatedIdentity;
    for (let count = 1; count <= 4; count++) {
      const selection = ids.slice(0, count).reverse();
      assert.deepEqual(await service.updateCover(identity, 'list', selection), { coverItemIds: selection });
      assert.deepEqual(saved, selection, 'Selection order must persist');
    }
    const previous = [...saved];
    for (const invalid of [[ids[4]], ids, [ids[0], ids[0]]]) {
      await assert.rejects(service.updateCover(identity, 'list', invalid), BadRequestException);
      assert.deepEqual(saved, previous, 'Rejected writes must preserve the cover');
    }
    owned = false;
    await assert.rejects(service.updateCover(identity, 'list', [ids[0]]), NotFoundException);
    assert.deepEqual(saved, previous, 'A non-owner must not change the cover');
    owned = true;
    await service.updateCover(identity, 'list', []);
    assert.deepEqual(saved, [], 'Automatic cover must be restorable');
  }
  console.log('Watchlist cover API QA passed.');
}
void run();
