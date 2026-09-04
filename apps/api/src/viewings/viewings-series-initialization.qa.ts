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

  console.log('Watched series initialization QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
