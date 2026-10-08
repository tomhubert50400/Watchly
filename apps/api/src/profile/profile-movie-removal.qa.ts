import assert from 'node:assert/strict';
import { ProfileService } from './profile.service';
import { WatchlistsService } from '../watchlists/watchlists.service';

type Row = Record<string, unknown>;
const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
function fixture(fail = false, systemKey: string | null = 'planned', status = 'WATCHLISTED') {
  const ownMovie = { userId: 'owner', tmdbId: 550, contentType: 'MOVIE' };
  let tables: Record<string, Row[]> = {
    ...Object.fromEntries(['userEpisodeReview', 'userEpisodeRating', 'userSeriesRating', 'userEpisodeProgress'].map((table) => [table, [
      { userId: 'owner', seriesTmdbId: 550 }, { userId: 'other', seriesTmdbId: 550 }, { userId: 'owner', seriesTmdbId: 551 },
    ]])),
    userMovieReview: [{ userId: 'owner', tmdbId: 550 }, { userId: 'other', tmdbId: 550 }, { userId: 'owner', tmdbId: 551 }],
    userMovieRating: [{ userId: 'owner', tmdbId: 550 }, { userId: 'other', tmdbId: 550 }, { userId: 'owner', tmdbId: 551 }],
    viewingEvent: [ownMovie, { ...ownMovie }, { ...ownMovie, userId: 'other' }, { ...ownMovie, contentType: 'EPISODE' }, { ...ownMovie, tmdbId: 551 }],
    releaseAlertSubscription: [ownMovie, { ...ownMovie, userId: 'other' }, { ...ownMovie, contentType: 'SERIES' }],
    userContentState: [{ ...ownMovie, status }, { ...ownMovie, userId: 'other' }, { ...ownMovie, contentType: 'SERIES', status }],
    user: [
      { id: 'owner', profileBackdropContentType: 'MOVIE', profileBackdropTmdbId: 550 },
      { id: 'other', profileBackdropContentType: 'MOVIE', profileBackdropTmdbId: 550 },
    ],
    personalWatchlistItem: [{ ...ownMovie, watchlistId: 'list' }, { ...ownMovie, watchlistId: 'another-list' }],
    sharedWatchlistItem: [ownMovie],
  };
  const original = structuredClone(tables);
  let transactions = 0;
  const prisma = {
    withConnectionRetry: (run: () => unknown) => run(),
    personalWatchlist: {
      findFirst: async ({ where }: { where: Row }) => where.userId === 'owner' && where.id === 'list' ? { id: 'list', systemKey } : null,
      update: async () => {},
    },
    personalWatchlistItem: { deleteMany: async ({ where }: { where: Row }) => {
      tables.personalWatchlistItem = tables.personalWatchlistItem.filter((row) => !matches(row, where));
    } },
    $transaction: async (run: (tx: object) => Promise<void>) => {
      transactions += 1;
      const draft = structuredClone(tables);
      const tx = Object.fromEntries(Object.keys(draft).map((table) => [table, {
        deleteMany: async ({ where }: { where: Row }) => {
          assert.equal(where.userId, 'owner', 'every deletion must use the authenticated owner');
          assert.equal(where.tmdbId ?? where.seriesTmdbId, 550);
          if (fail && table === 'userContentState') throw new Error('Database failure');
          draft[table] = draft[table].filter((row) => !matches(row, where));
        },
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          draft[table] = draft[table].map((row) => matches(row, where) ? { ...row, ...data } : row);
        },
      }]));
      Object.assign(tx, { $queryRawUnsafe: async (sql: string, owner: string, contentType: string, tmdbId: number) => {
        assert.match(sql, /FOR UPDATE/);
        assert.match(sql, /status = 'WATCHLISTED'/);
        return draft.userContentState.filter((row) => matches(row, { userId: owner, tmdbId, contentType, status: 'WATCHLISTED' }));
      } });
      await run(tx);
      tables = draft;
    },
  };
  const service = new ProfileService(
    { getOrCreateUser: async () => ({ id: 'owner' }) } as never,
    {} as never, prisma as never, {} as never,
  );
  const lists = new WatchlistsService({ getOrCreateUser: async () => ({ id: 'owner' }) } as never, prisma as never);
  return { service, lists, original, tables: () => tables, transactions: () => transactions };
}

async function run() {
  const state = fixture();
  await state.service.removeTitle({} as never, 'movie', 550);
  for (const table of ['userMovieReview', 'userMovieRating']) {
    assert.deepEqual(state.tables()[table], state.original[table].filter((row) => row.userId !== 'owner' || row.tmdbId !== 550));
  }
  for (const table of ['viewingEvent', 'releaseAlertSubscription', 'userContentState']) {
    assert.deepEqual(state.tables()[table], state.original[table].filter((row) => row.userId !== 'owner' || row.tmdbId !== 550 || row.contentType !== 'MOVIE'));
  }
  assert.deepEqual(state.tables().user[0], { id: 'owner', profileBackdropContentType: null, profileBackdropTmdbId: null });
  assert.deepEqual(state.tables().user[1], state.original.user[1]);
  assert.deepEqual(state.tables().personalWatchlistItem, state.original.personalWatchlistItem, 'custom lists are preserved');
  assert.deepEqual(state.tables().sharedWatchlistItem, state.original.sharedWatchlistItem, 'shared lists are preserved');
  const removed = structuredClone(state.tables());
  await state.service.removeTitle({} as never, 'movie', 550);
  assert.deepEqual(state.tables(), removed, 'repeated deletion is harmless');
  assert.equal(state.transactions(), 2);

  const failed = fixture(true);
  await assert.rejects(failed.service.removeTitle({} as never, 'movie', 550), /Database failure/);
  assert.deepEqual(failed.tables(), failed.original, 'all deletions must roll back together');
  for (const tmdbId of [0, -1, 1.5, NaN]) {
    await assert.rejects(failed.service.removeTitle({} as never, 'movie', tmdbId), /positive integer/);
  }
  assert.equal(failed.transactions(), 1, 'invalid IDs must not enter a transaction');

  const planned = fixture();
  await planned.lists.removeItem({} as never, 'list', 'movie', 550);
  assert.deepEqual(planned.tables(), removed, 'Planned removal must perform the same profile cleanup');
  const stale = fixture(false, 'planned', 'WATCHED');
  await stale.lists.removeItem({} as never, 'list', 'movie', 550);
  assert.deepEqual(stale.tables(), stale.original, 'a stale Planned removal must preserve a movie now marked watched');
  const ordinary = fixture(false, null);
  await ordinary.lists.removeItem({} as never, 'list', 'movie', 550);
  assert.deepEqual(ordinary.tables(), { ...ordinary.original, personalWatchlistItem: ordinary.original.personalWatchlistItem.slice(1) }, 'ordinary removal changes only that list');
  await assert.rejects(ordinary.lists.removeItem({} as never, 'foreign-list', 'movie', 550), /Watchlist not found/);
  const plannedFailure = fixture(true);
  await assert.rejects(plannedFailure.lists.removeItem({} as never, 'list', 'movie', 550), /Database failure/);
  assert.deepEqual(plannedFailure.tables(), plannedFailure.original, 'Planned profile cleanup rolls back on failure');
  const series = fixture();
  await series.service.removeTitle({} as never, 'series', 550);
  for (const table of ['userEpisodeReview', 'userEpisodeRating', 'userSeriesRating', 'userEpisodeProgress']) {
    assert.deepEqual(series.tables()[table], series.original[table].slice(1), `${table} removes only the owner's selected series`);
  }
  for (const table of ['userMovieReview', 'userMovieRating', 'personalWatchlistItem', 'sharedWatchlistItem', 'user']) {
    assert.deepEqual(series.tables()[table], series.original[table], `${table} must remain unchanged`);
  }
  assert.deepEqual(series.tables().viewingEvent, series.original.viewingEvent.filter((row) => row.contentType !== 'EPISODE'));
  for (const table of ['userContentState', 'releaseAlertSubscription']) {
    assert.deepEqual(series.tables()[table], series.original[table].filter((row) => row.contentType !== 'SERIES'));
  }
  const plannedSeries = fixture();
  await plannedSeries.lists.removeItem({} as never, 'list', 'series', 550);
  assert.deepEqual(plannedSeries.tables(), series.tables(), 'Planned series removal must perform the full profile cleanup');
  const failedSeries = fixture(true);
  await assert.rejects(failedSeries.service.removeTitle({} as never, 'series', 550), /Database failure/);
  assert.deepEqual(failedSeries.tables(), failedSeries.original);
  await assert.rejects(series.service.removeTitle({} as never, 'invalid' as never, 550), /contentType/);
  console.log('Profile movie removal QA passed: owner isolation, data cleanup, retained lists, rollback and retries.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
