import assert from 'node:assert/strict';
import { Prisma } from '../generated/prisma/client';
import { commitImportWatchlists } from './import-watchlists';
import type { PreparedImportItem } from './imports.service';

export function watchlistHarness(initialCount = 0) {
  const lists = new Map<string, { id: string; name: string; userId: string }>(
    Array.from({ length: initialCount }, (_, index) => [`existing-${index}`, { id: `existing-${index}`, name: 'Existing', userId: 'owner' }]),
  );
  const memberships = new Map<string, { watchlistId: string; tmdbId: number; contentType: string }>();
  const transaction = {
    $queryRaw: async () => [],
    personalWatchlist: {
      findMany: async ({ where }: { where: { userId: string } }) => [...lists.values()].filter((list) => list.userId === where.userId),
      create: async ({ data }: { data: { id: string; name: string; userId: string } }) => {
        assert.ok(!lists.has(data.id));
        lists.set(data.id, data);
        return data;
      },
      updateMany: async () => ({ count: 1 }),
    },
    personalWatchlistItem: {
      createMany: async ({ data, skipDuplicates }: { data: { watchlistId: string; tmdbId: number; contentType: string }[]; skipDuplicates: boolean }) => {
        assert.equal(skipDuplicates, true);
        for (const row of data) memberships.set(`${row.watchlistId}:${row.contentType}:${row.tmdbId}`, row);
      },
    },
  };
  return { lists, memberships, transaction };
}

export async function verifyImportWatchlists(baseItem: PreparedImportItem) {
  const harness = watchlistHarness(3);
  const tx = harness.transaction as unknown as Prisma.TransactionClient;
  const lists = [{ key: 'a', name: 'Same name' }, { key: 'b', name: 'Same name' }, { key: 'c', name: 'Overflow' }];
  const item = { ...baseItem, watched: true, watchlistKeys: ['a', 'b', 'c'] };
  const result = await commitImportWatchlists(tx, 'owner', 'letterboxd', lists, [item]);
  assert.equal(harness.lists.size, 5, 'existing personal lists count toward the limit');
  assert.notEqual(result.ids.a, result.ids.b, 'distinct source lists with equal names remain separate');
  assert.equal(result.ids.c, null, 'excess lists must be skipped');
  assert.equal(harness.memberships.size, 2, 'watched films must be added to every accepted list');
  assert.equal(result.items[0].watched, true);
  await commitImportWatchlists(tx, 'owner', 'letterboxd', lists, [item]);
  assert.equal(harness.lists.size, 5, 'reimport must reuse lists even at the limit');
  assert.equal(harness.memberships.size, 2, 'reimport must not duplicate films');
  const skipped = await commitImportWatchlists(tx, 'owner', 'letterboxd', lists, [
    { ...baseItem, watched: false, rating: null, review: null, watchlisted: true, watchlistKeys: ['c'] },
  ], result.ids);
  assert.equal(skipped.items.length, 0, 'a skipped list must not create planned states for its films');
  const rated = await commitImportWatchlists(tx, 'owner', 'letterboxd', lists, [
    { ...baseItem, watchlisted: true, watchlistKeys: ['c'] },
  ], result.ids);
  assert.equal(rated.items[0].rating, baseItem.rating, 'independent ratings must survive list overflow');
  assert.equal(rated.items[0].watchlisted, false);
  await commitImportWatchlists(tx, 'owner', 'letterboxd', lists, [
    { ...item, match: { ...baseItem.match!, contentType: 'series' }, watchlistKeys: ['a'] },
    { ...item, status: 'unmatched', match: null },
  ], result.ids);
  assert.equal(harness.memberships.size, 3, 'series IDs are distinct from movie IDs; unmatched titles are never invented');
  const otherOwner = await commitImportWatchlists(tx, 'another-owner', 'letterboxd', [lists[0]], [item]);
  assert.notEqual(otherOwner.ids.a, result.ids.a, 'list identity must be scoped to its owner');
  const otherSource = await commitImportWatchlists(tx, 'another-owner', 'imdb', [lists[0]], [item]);
  assert.notEqual(otherSource.ids.a, otherOwner.ids.a, 'list identity must be scoped to its source');
  const empty = await commitImportWatchlists(tx, 'third-owner', 'imdb', [lists[0]], []);
  assert.ok(empty.ids.a, 'empty exported lists must also be created');
}
