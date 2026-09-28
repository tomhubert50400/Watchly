import assert from 'node:assert/strict';
import { TrackingService } from '../tracking/tracking.service';
import { ProgressService } from '../progress/progress.service';
import { ViewingsService } from './viewings.service';

type Row = Record<string, unknown>;
type Query = { where: Row };

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return (value as Row[]).some((clause) => matches(row, clause));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return (value.in as unknown[]).includes(row[key]);
      return matches(row, value as Row);
    }
    return row[key] === value;
  });
}

function table(defaults: Row = {}) {
  const rows: Row[] = [];
  const create = async ({ data }: { data: Row }) => {
    const row = { id: String(rows.length + 1), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
    rows.push(row);
    return row;
  };
  return {
    rows,
    create,
    createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
      for (const item of data) {
        const { userId, seriesTmdbId, seasonNumber, episodeNumber } = item;
        if (skipDuplicates && rows.some((row) => matches(row, { userId, seriesTmdbId, seasonNumber, episodeNumber }))) continue;
        await create({ data: item });
      }
    },
    findMany: async ({ where }: Query) => rows.filter((row) => matches(row, where)),
    findFirst: async ({ where }: Query) => rows.find((row) => matches(row, where)) ?? null,
    findUniqueOrThrow: async ({ where }: Query) => {
      const row = rows.find((item) => matches(item, where));
      assert.ok(row);
      return row;
    },
    upsert: async ({ where, create: data, update }: Query & { create: Row; update: Row }) => {
      const row = rows.find((item) => matches(item, where));
      return row ? Object.assign(row, update) : create({ data });
    },
    update: async ({ where, data }: Query & { data: Row }) => {
      const row = rows.find((item) => matches(item, where));
      assert.ok(row);
      return Object.assign(row, data);
    },
  };
}

async function run() {
  const stores = {
    userContentState: table({ watchedEpisodesInitializedAt: null }),
    userEpisodeProgress: table(),
    viewingEvent: table({ seasonNumber: null, episodeNumber: null, subtitle: null }),
    userMovieRating: table(), userEpisodeRating: table(), userSeriesRating: table(),
  };
  const prisma = {
    ...stores,
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
    $transaction: async <T>(operation: (tx: typeof stores) => Promise<T>) => operation(stores),
  };
  const auth = { getOrCreateUser: async () => ({ id: 'owner' }) };
  const catalogue = {
    getMovie: async () => ({ item: { title: 'Movie', runtimeMinutes: 120, genres: ['Drama'], posterUrl: 'movie.jpg' } }),
    getSeries: async () => ({ item: { title: 'Series', genres: ['Drama'], posterUrl: 'series.jpg', seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }] } }),
    getSeason: async () => ({ item: { episodes: [
      { seasonNumber: 1, episodeNumber: 1, title: 'Pilot', runtimeMinutes: 40, airDate: '2020-01-01' },
      { seasonNumber: 1, episodeNumber: 2, title: 'Second', runtimeMinutes: 50, airDate: '2020-01-02' },
      { seasonNumber: 1, episodeNumber: 3, title: 'Future', runtimeMinutes: 60, airDate: '2099-01-01' },
    ] } }),
  };
  const viewings = new ViewingsService(auth as never, prisma as never, catalogue as never);
  const tracking = new TrackingService(auth as never, prisma as never, viewings);
  const progress = new ProgressService(auth as never, prisma as never, viewings);
  const identity = {} as never;
  const summary = async () => (await viewings.getStats(identity)).summary;

  assert.equal((await summary()).totalViewCount, 0);
  await tracking.upsertState(identity, { contentType: 'movie', tmdbId: 10, status: 'watching' });
  assert.equal((await summary()).movieCount, 0, 'watching alone is not a completed viewing');
  await tracking.upsertState(identity, { contentType: 'movie', tmdbId: 10, status: 'watched' });
  assert.deepEqual(await summary(), {
    movieCount: 1, seriesCount: 0, episodeCount: 0, totalViewCount: 1, watchMinutes: 120, watchTimeIsEstimated: false,
  });
  await tracking.upsertState(identity, { contentType: 'movie', tmdbId: 10, status: 'watched' });
  assert.equal((await summary()).totalViewCount, 1, 'saving watched again must not create a rewatch');

  await progress.markEpisodeWatched(identity, 20, 1, 1);
  assert.deepEqual(await summary(), {
    movieCount: 1, seriesCount: 1, episodeCount: 1, totalViewCount: 2, watchMinutes: 160, watchTimeIsEstimated: false,
  });
  await progress.markEpisodeWatched(identity, 20, 1, 1);
  assert.equal((await summary()).totalViewCount, 2, 'saving episode progress again must not duplicate views');

  await tracking.upsertState(identity, { contentType: 'series', tmdbId: 20, status: 'watched' });
  const completed = await summary();
  assert.deepEqual(completed, {
    movieCount: 1, seriesCount: 1, episodeCount: 2, totalViewCount: 3, watchMinutes: 210, watchTimeIsEstimated: false,
  }, 'whole-series watched must include released episodes without duplicating existing progress');
  assert.deepEqual(await summary(), completed, 'reading stats twice must not duplicate series viewings');
  await tracking.upsertState(identity, { contentType: 'series', tmdbId: 30, status: 'watched' });
  assert.equal((await summary()).episodeCount, 4, 'whole-series watched also works without prior episode progress');

  await progress.markEpisodeWatched(identity, 40, 1, 2);
  assert.deepEqual(await summary(), {
    movieCount: 1, seriesCount: 3, episodeCount: 6, totalViewCount: 7, watchMinutes: 390, watchTimeIsEstimated: false,
  }, 'marking through an episode must count every newly watched episode');

  await viewings.logMovieViewing(identity, 10);
  const rewatched = await viewings.getStats(identity);
  assert.equal(rewatched.summary.movieCount, 1);
  assert.equal(rewatched.summary.totalViewCount, 8);
  assert.equal(rewatched.summary.watchMinutes, 510);
  assert.equal(rewatched.more.rewatchCount, 1);
  assert.equal((await viewings.getStatsForUser('another-user')).summary.totalViewCount, 0);
  console.log('Your activity to viewing stats QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
