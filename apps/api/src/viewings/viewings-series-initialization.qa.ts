import assert from 'node:assert/strict';
import { ViewingsService } from './viewings.service';

async function run() {
  const progressRows: Array<Record<string, unknown>> = [];
  const viewingRows: Array<Record<string, unknown>> = [];
  const initializedStateIds: string[] = [];
  const requestedSeasons: number[] = [];
  const transaction = {
    userContentState: {
      update: async ({ where }: { where: { id: string } }) => {
        initializedStateIds.push(where.id);
      },
    },
    userEpisodeProgress: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        progressRows.push(...data);
      },
    },
    viewingEvent: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        viewingRows.push(...data);
      },
      findMany: async () => [{ episodeNumber: 1, seasonNumber: 1 }],
    },
  };
  const prisma = {
    $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => (
      operation(transaction)
    ),
    userContentState: {
      findMany: async () => [{ id: 'series-state', tmdbId: 20 }],
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const catalogue = {
    getSeason: async (_seriesTmdbId: number, seasonNumber: number) => {
      requestedSeasons.push(seasonNumber);
      return {
        item: {
          episodes: seasonNumber === 1
            ? [
                { airDate: '2020-01-01', episodeNumber: 1, runtimeMinutes: 48, seasonNumber: 1, stillUrl: null, title: 'Pilot' },
                { airDate: '2099-01-01', episodeNumber: 2, runtimeMinutes: 52, seasonNumber: 1, stillUrl: null, title: 'Future' },
              ]
            : [
                { airDate: '2021-01-01', episodeNumber: 1, runtimeMinutes: 50, seasonNumber: 2, stillUrl: null, title: 'Return' },
              ],
          posterUrl: null,
        },
      };
    },
    getSeries: async () => ({
      item: {
        backdropUrl: 'series-backdrop.jpg',
        genres: ['Drama'],
        posterUrl: 'series-poster.jpg',
        seasons: [
          { seasonNumber: 0 },
          { seasonNumber: 1 },
          { seasonNumber: 2 },
        ],
        title: 'Test Series',
      },
    }),
  };
  const service = new ViewingsService({} as never, prisma as never, catalogue as never);

  await service.initializeWatchedSeriesEpisodes('viewer-id');

  assert.deepEqual(requestedSeasons.sort(), [1, 2], 'specials must not be initialized');
  assert.deepEqual(
    progressRows.map((row) => `${row.seasonNumber}:${row.episodeNumber}`).sort(),
    ['1:1', '2:1'],
    'all released regular episodes must be marked watched',
  );
  assert.deepEqual(
    viewingRows.map((row) => `${row.seasonNumber}:${row.episodeNumber}`),
    ['2:1'],
    'existing viewing events must not be duplicated',
  );
  assert.equal(viewingRows[0]?.watchedAt, null, 'onboarding episodes must not invent Journal dates');
  assert.deepEqual(initializedStateIds, ['series-state']);

  await verifyImportedStatsLoading();
  console.log('Watched series initialization QA passed.');
}

async function verifyImportedStatsLoading() {
  const rows = Array.from({ length: 25 }, (_, index) => ({
    id: String(index), tmdbId: index + 1, contentType: 'MOVIE', seasonNumber: null, episodeNumber: null,
    title: 'Imported movie', artworkUrl: null, runtimeMinutes: null as number | null, genres: [] as string[],
    watchedAt: new Date('2024-01-01'), createdAt: new Date('2024-01-01'),
  }));
  let active = 0;
  let peak = 0;
  let calls = 0;
  let unavailable = false;
  const prisma = {
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
    userContentState: { findMany: async () => [] },
    userMovieRating: { findMany: async () => [] },
    userEpisodeRating: { findMany: async () => [] },
    userSeriesRating: { findMany: async () => [] },
    viewingEvent: {
      findMany: async ({ where }: { where: { OR?: unknown } }) => {
        if (unavailable) throw new Error('Database unavailable');
        return where.OR ? rows.filter((row) => row.runtimeMinutes === null) : rows;
      },
      updateMany: async ({ where, data }: { where: { tmdbId: number }; data: { runtimeMinutes: number; genres: string[] } }) => {
        Object.assign(rows.find((row) => row.tmdbId === where.tmdbId)!, data);
      },
    },
  };
  const catalogue = { getMovie: async () => {
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return { item: { runtimeMinutes: 100, genres: ['Drama'], title: 'Imported movie', posterUrl: null, backdropUrl: null } };
  } };
  const service = new ViewingsService({} as never, prisma as never, catalogue as never);
  const profile = service.getStatsForUser('owner');
  const allTime = service.getStatsForUser('owner');
  assert.equal(profile, allTime, 'concurrent profile and all-time requests must share the same calculation');
  const stats = await profile;
  assert.equal(stats.summary.movieCount, 25);
  assert.equal(stats.summary.watchMinutes, 2500);
  assert.equal(calls, 25);
  assert.ok(peak <= 5, 'old imports must not flood the catalogue while filling missing runtimes');
  await service.getStatsForUser('owner');
  assert.equal(calls, 25, 'stored metadata must not need another catalogue lookup');
  unavailable = true;
  await assert.rejects(service.getStatsForUser('owner'), /Database unavailable/);
  unavailable = false;
  assert.equal((await service.getStatsForUser('owner')).summary.movieCount, 25, 'failed calculations must be retryable');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
