import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';

async function run() {
  const personal = new Map<string, number>();
  const memberships = new Map<string, Set<string>>();
  const locks = new Map<string, Promise<void>>();
  let sequence = 0;
  const members = (userId: string) => {
    if (!memberships.has(userId)) memberships.set(userId, new Set());
    return memberships.get(userId)!;
  };
  const record = (data: { name: string; userId?: string; ownerId?: string }) => ({
    ...data, id: `list-${++sequence}`, createdAt: new Date(), updatedAt: new Date(),
    visibility: 'PRIVATE', _count: { items: 0, members: 1 },
  });
  const prisma = {
    withConnectionRetry: <T>(operation: () => Promise<T>) => operation(),
    user: { findUnique: async () => ({ id: 'member' }) },
    sharedWatchlist: {
      findFirst: async () => ({ id: 'shared' }),
      update: async () => ({}),
      findUniqueOrThrow: async () => ({ name: 'Friends' }),
    },
    notification: { upsert: async () => ({}) },
    $transaction: async (operation: (tx: object) => Promise<unknown>) => {
      let lockedUser: string | undefined;
      let release: (() => void) | undefined;
      const assertLocked = (userId: string) => assert.equal(lockedUser, userId, 'quota reads and writes must hold the same user lock');
      const transaction = {
        $queryRaw: async (sql: TemplateStringsArray, userId: string) => {
          assert.match(sql.join('?'), /SELECT id FROM "users" WHERE id = \?::uuid FOR UPDATE/);
          const previous = locks.get(userId) ?? Promise.resolve();
          const current = new Promise<void>((resolve) => { release = resolve; });
          locks.set(userId, previous.then(() => current));
          await previous;
          lockedUser = userId;
          return [{ id: userId }];
        },
        personalWatchlist: {
          count: async ({ where }: { where: { userId: string } }) => { assertLocked(where.userId); return personal.get(where.userId) ?? 0; },
          create: async ({ data }: { data: { name: string; userId: string } }) => {
            assertLocked(data.userId);
            personal.set(data.userId, (personal.get(data.userId) ?? 0) + 1);
            return record(data);
          },
        },
        sharedWatchlist: {
          findFirst: async ({ where }: { where: { id: string; members: { some: { userId: string } } } }) => members(where.members.some.userId).has(where.id) ? { ownerId: 'owner' } : null,
          create: async ({ data }: { data: { name: string; ownerId: string; members: { create: { userId: string } } } }) => {
            assertLocked(data.ownerId);
            assert.equal(data.members.create.userId, data.ownerId);
            const list = record(data);
            members(data.ownerId).add(list.id);
            return list;
          },
        },
        sharedWatchlistMember: {
          deleteMany: async ({ where }: { where: { userId: string; watchlistId: string } }) => {
            assertLocked(where.userId);
            return { count: members(where.userId).delete(where.watchlistId) ? 1 : 0 };
          },
          count: async ({ where }: { where: { userId: string } }) => { assertLocked(where.userId); return members(where.userId).size; },
          findUnique: async ({ where }: { where: { watchlistId_userId: { userId: string; watchlistId: string } } }) => {
            const { userId, watchlistId } = where.watchlistId_userId;
            assertLocked(userId);
            return members(userId).has(watchlistId) ? { id: watchlistId } : null;
          },
          upsert: async ({ create }: { create: { userId: string; watchlistId: string } }) => {
            assertLocked(create.userId);
            members(create.userId).add(create.watchlistId);
            return { id: create.watchlistId };
          },
        },
      };
      try { return await operation(transaction); } finally { release?.(); }
    },
  };
  const auth = { getOrCreateUser: async (identity: { subject: string }) => ({ id: identity.subject }) };
  const personalService = new WatchlistsService(auth as never, prisma as never);
  const sharedService = new SharedWatchlistsService(auth as never, prisma as never);
  const identity = (subject: string) => ({ subject }) as never;
  personal.set('owner', 4);
  await personalService.createWatchlist(identity('owner'), 'Fifth');
  await assert.rejects(() => personalService.createWatchlist(identity('owner'), 'Sixth'), BadRequestException);
  assert.equal(personal.get('owner'), 5);
  await sharedService.createSharedWatchlist(identity('owner'), 'Independent shared quota');
  assert.equal(members('owner').size, 1);

  members('member').add('existing');
  for (let i = 0; i < 3; i += 1) members('member').add(`old-${i}`);
  const race = await Promise.allSettled([
    sharedService.createSharedWatchlist(identity('member'), 'Mine'),
    sharedService.addMember(identity('owner'), 'invited-list', 'member'),
  ]);
  assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(members('member').size, 5, 'creation and membership must share one quota');
  await sharedService.addMember(identity('owner'), 'existing', 'member');
  assert.equal(members('member').size, 5, 'adding an existing member at the limit must stay idempotent');
  await assert.rejects(() => sharedService.addMember(identity('owner'), 'sixth', 'member'), BadRequestException);
  await assert.rejects(() => sharedService.createSharedWatchlist(identity('member'), 'Sixth'), BadRequestException);
  await sharedService.leaveSharedWatchlist(identity('member'), 'existing');
  assert.equal(members('member').size, 4);
  await sharedService.addMember(identity('owner'), 'replacement', 'member');
  assert.equal(members('member').size, 5, 'leaving must release a membership slot');
  const ownedList = [...members('owner')][0]!;
  await assert.rejects(() => sharedService.leaveSharedWatchlist(identity('owner'), ownedList), BadRequestException);
  await assert.rejects(() => sharedService.leaveSharedWatchlist(identity('stranger'), ownedList), NotFoundException);
  assert.equal(members('owner').size, 1, 'owner and stranger leave attempts must not remove memberships');

  personal.set('race', 4);
  const personalRace = await Promise.allSettled([
    personalService.createWatchlist(identity('race'), 'A'),
    personalService.createWatchlist(identity('race'), 'B'),
  ]);
  assert.equal(personalRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(personal.get('race'), 5);
  personal.set('legacy', 7);
  await assert.rejects(() => personalService.createWatchlist(identity('legacy'), 'Another'), BadRequestException);
  assert.equal(personal.get('legacy'), 7, 'existing over-limit lists must not be deleted');
  await assert.rejects(() => personalService.createWatchlist(identity('owner'), '  '), BadRequestException);
  console.log('Watchlist quota QA passed: independent quotas, fifth/sixth, membership, concurrency, idempotency and legacy lists.');
}
void run();
