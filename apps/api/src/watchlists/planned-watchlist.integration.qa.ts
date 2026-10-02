import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PrismaClient } from '../generated/prisma/client';
import { commitImportWatchlists } from '../imports/import-watchlists';
import { TrackingService } from '../tracking/tracking.service';
import { WatchlistsService } from './watchlists.service';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL is required');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname), 'Run only against a local test database');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const rollback = new Error('Rollback planned watchlist QA fixtures');
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { firebaseUid: `planned-qa-${randomUUID()}` } });
      const other = await tx.user.create({ data: { firebaseUid: `planned-other-qa-${randomUUID()}` } });
      const database = new Proxy(tx, {
        get(target, key) {
          if (key === 'withConnectionRetry') return (operation: () => unknown) => operation();
          if (key === '$transaction') return (operation: (transaction: typeof tx) => unknown) => operation(tx);
          return Reflect.get(target, key);
        },
      });
      const auth = { getOrCreateUser: async () => owner };
      const lists = new WatchlistsService(auth as never, database as never);
      const tracking = new TrackingService(auth as never, database as never);
      const otherLists = new WatchlistsService({ getOrCreateUser: async () => other } as never, database as never);
      const identity = {} as AuthenticatedIdentity;
      const movie = { contentType: 'movie' as const, tmdbId: 550 };
      const series = { contentType: 'series' as const, tmdbId: 550 };
      const stateKey = { userId: owner.id, contentType: 'MOVIE' as const, tmdbId: movie.tmdbId };
      const readState = () => tx.userContentState.findUnique({ where: { userId_contentType_tmdbId: stateKey } });

      assert.deepEqual((await lists.listWatchlists(identity)).items, [], 'An untouched account has no automatic list');
      const ordinary = await lists.createWatchlist(identity, 'Planned to Watch');
      await lists.addItem(identity, ordinary.id, movie);
      assert.equal(await readState(), null, 'An ordinary list with the same name must not change tracking');
      await tracking.upsertState(identity, { ...movie, status: 'watchlisted', favorite: true });
      const summaries = (await lists.listWatchlists(identity)).items;
      const planned = summaries.find((list) => list.isPlanned);
      assert.ok(planned, 'The first planned title creates its automatic list');
      assert.notEqual(planned.id, ordinary.id, 'A matching user-defined name must not be adopted');
      assert.equal(planned.name, 'Planned to Watch');
      assert.equal(planned.visibility, 'private');
      assert.equal(planned.itemCount, 1);
      assert.equal((await lists.getWatchlist(identity, planned.id)).isPlanned, true);
      assert.equal((await lists.getWatchlist(identity, ordinary.id)).isPlanned, false);
      const originalItem = (await lists.getWatchlist(identity, planned.id)).items[0]!;

      await tracking.upsertState(identity, { ...movie, status: 'watchlisted', favorite: true });
      await lists.addItem(identity, planned.id, movie);
      assert.equal((await lists.getWatchlist(identity, planned.id)).items[0]!.id, originalItem.id, 'Repeated additions preserve membership identity');
      assert.equal((await lists.listWatchlists(identity)).items.filter((list) => list.isPlanned).length, 1);
      await lists.addItem(identity, planned.id, series);
      assert.equal((await tracking.getState(identity, 'series', series.tmdbId))?.status, 'watchlisted');
      assert.deepEqual((await lists.getWatchlist(identity, planned.id)).items.map((item) => item.contentType).sort(), ['movie', 'series'], 'Movie and series TMDB namespaces remain distinct');
      assert.equal((await lists.listWatchlists(identity, 'series', series.tmdbId)).items.find((list) => list.id === planned.id)?.containsTitle, true);

      await lists.removeItem(identity, planned.id, 'movie', movie.tmdbId);
      assert.equal((await readState())?.status, null);
      assert.equal((await readState())?.favorite, true, 'Removing a planned title preserves its favorite');
      assert.deepEqual((await lists.getWatchlist(identity, planned.id)).items.map((item) => item.contentType), ['series']);
      assert.equal((await lists.getWatchlist(identity, ordinary.id)).items.length, 1, 'Automatic removal leaves ordinary list membership intact');
      await lists.removeItem(identity, planned.id, 'series', series.tmdbId);
      assert.notEqual((await tracking.getState(identity, 'series', series.tmdbId))?.status, 'watchlisted');

      for (const status of ['WATCHING', 'WATCHED', 'DROPPED', null] as const) {
        await tx.userContentState.update({ where: { userId_contentType_tmdbId: stateKey }, data: { status: 'WATCHLISTED' } });
        assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 1);
        await tx.userContentState.update({ where: { userId_contentType_tmdbId: stateKey }, data: { status } });
        assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 0, `Direct status transition to ${status} removes membership`);
        assert.equal((await readState())?.favorite, true);
      }
      await tracking.upsertState(identity, { ...movie, status: 'watchlisted', favorite: true });
      await tracking.upsertState(identity, { ...movie, status: 'watched', favorite: true });
      assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 0, 'Marking watched through TrackingService removes membership');
      await tracking.upsertState(identity, { ...movie, status: 'watchlisted', favorite: true });
      await tracking.deleteState(identity, 'movie', movie.tmdbId);
      assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 0, 'Deleting the tracking state removes membership');
      await tracking.upsertState(identity, { ...movie, status: 'watchlisted' });
      await tracking.upsertState(identity, { ...movie, status: null, favorite: false });
      assert.equal(await readState(), null);
      assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 0);

      const importedState = await tx.userContentState.create({ data: { ...stateKey, status: 'WATCHLISTED' } });
      assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 1, 'Direct insert, including imports, creates membership');
      await tx.userContentState.delete({ where: { id: importedState.id } });
      assert.equal((await lists.getWatchlist(identity, planned.id)).items.length, 0);
      const emptyList = (await lists.listWatchlists(identity)).items.find((list) => list.id === planned.id);
      assert.equal(emptyList?.itemCount, 0, 'The automatic list remains after its final title is removed');
      await assert.rejects(lists.deleteWatchlist(identity, planned.id), BadRequestException);
      assert.equal((await lists.getWatchlist(identity, planned.id)).id, planned.id);

      await assert.rejects(otherLists.getWatchlist(identity, planned.id), NotFoundException);
      await assert.rejects(otherLists.addItem(identity, planned.id, movie), NotFoundException);
      await assert.rejects(otherLists.removeItem(identity, planned.id, 'movie', movie.tmdbId), NotFoundException);
      assert.equal(await tx.userContentState.count({ where: { userId: other.id } }), 0, 'Foreign list requests must not alter the caller tracking');
      assert.equal((await otherLists.listWatchlists(identity)).items.length, 0);

      const manualLists = [ordinary];
      for (let index = 1; index < 5; index++) manualLists.push(await lists.createWatchlist(identity, `Manual ${index}`));
      assert.equal((await lists.listWatchlists(identity)).items.length, 6, 'Five manual lists are allowed alongside the automatic list');
      await assert.rejects(lists.createWatchlist(identity, 'Sixth manual list'), BadRequestException);
      await lists.deleteWatchlist(identity, manualLists[4]!.id);
      const importedLists = await commitImportWatchlists(tx, owner.id, 'letterboxd', [{ key: 'planned-qa-import', name: 'Imported list' }], []);
      assert.ok(importedLists.ids['planned-qa-import'], 'Imports also exclude the automatic list from the five-list quota');
      assert.equal((await lists.listWatchlists(identity)).items.length, 6);
      const skippedLists = await commitImportWatchlists(tx, owner.id, 'letterboxd', [{ key: 'planned-qa-over-quota', name: 'Over quota' }], []);
      assert.equal(skippedLists.ids['planned-qa-over-quota'], null);
      assert.equal((await lists.getWatchlist(identity, ordinary.id)).items[0]!.tmdbId, movie.tmdbId);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
    await verifyConcurrentRetry(connectionString);
    console.log('Planned watchlist database QA passed; transaction fixtures rolled back and concurrent fixtures removed.');
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyConcurrentRetry(connectionString: string) {
  const database = new PrismaService(new ConfigService({ DATABASE_URL: connectionString }));
  const owner = await database.user.create({ data: { firebaseUid: `planned-concurrent-qa-${randomUUID()}` } });
  let resets = 0;
  database.resetConnection = async () => { resets += 1; };
  try {
    await database.userContentState.createMany({ data: [401, 402].map((tmdbId) => ({
      userId: owner.id, contentType: 'MOVIE', tmdbId,
    })) });
    let listLocked!: () => void;
    let stateLocked!: () => void;
    const listReady = new Promise<void>((resolve) => { listLocked = resolve; });
    const stateReady = new Promise<void>((resolve) => { stateLocked = resolve; });
    const attempts = [0, 0];
    const stateKey = (tmdbId: number) => ({ userId_contentType_tmdbId: { userId: owner.id, contentType: 'MOVIE' as const, tmdbId } });
    const results = await Promise.allSettled([
      database.withConnectionRetry(() => database.$transaction(async (tx) => {
        attempts[0]! += 1;
        await tx.userContentState.update({ where: stateKey(401), data: { status: 'WATCHLISTED' } });
        listLocked();
        await stateReady;
        await tx.userContentState.update({ where: stateKey(402), data: { status: 'WATCHLISTED' } });
      }, { timeout: 15000 })),
      database.withConnectionRetry(async () => {
        await listReady;
        return database.$transaction(async (tx) => {
          attempts[1]! += 1;
          await tx.$queryRaw`SELECT id FROM "user_content_states" WHERE "userId" = ${owner.id}::uuid AND "contentType" = 'MOVIE' AND "tmdbId" = 402 FOR UPDATE`;
          stateLocked();
          await tx.userContentState.update({ where: stateKey(402), data: { status: 'WATCHLISTED' } });
        }, { timeout: 15000 });
      }),
    ]);
    assert.ok(results.every((result) => result.status === 'fulfilled'), `Both concurrent transactions must recover: ${JSON.stringify(results)}`);
    assert.ok(attempts[0]! + attempts[1]! >= 3, 'The forced deadlock must exercise transaction retry');
    assert.equal(resets, 0, 'A real PostgreSQL deadlock must not reset the healthy connection');
    const planned = await database.personalWatchlist.findMany({ where: { userId: owner.id, systemKey: 'planned' }, include: { items: true } });
    assert.equal(planned.length, 1);
    assert.deepEqual(planned[0]!.items.map((item) => item.tmdbId).sort(), [401, 402]);
  } finally {
    await database.user.delete({ where: { id: owner.id } });
    await database.$disconnect();
  }
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
