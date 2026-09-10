import assert from 'node:assert/strict';
import {
  ReleaseDatePrecision,
  ReleaseEventStatus,
  ReleaseNotificationType,
  TrackedContentType,
} from '../generated/prisma/enums';
import {
  parseTmdbDate,
  ReleaseEventsService,
  selectEpisodeSeasonNumbers,
} from './release-events.service';

type StoredEvent = {
  contentType: TrackedContentType;
  createdAt: Date;
  episodeNumber: number | null;
  id: string;
  lastSyncedAt: Date;
  precision: ReleaseDatePrecision;
  regionCode: string | null;
  releaseDate: Date | null;
  seasonNumber: number | null;
  source: string;
  sourceKey: string;
  status: ReleaseEventStatus;
  timeZone: string | null;
  title: string;
  tmdbId: number;
  type: ReleaseNotificationType;
  updatedAt: Date;
};

async function verifySagaSubscriptions() {
  const now = new Date('2026-09-10T12:00:00Z');
  let parts = [
    { tmdbId: 1, releaseDate: '2017-01-01' },
    { tmdbId: 2, releaseDate: '2021-01-01' },
    { tmdbId: 3, releaseDate: '2026-09-17' },
    { tmdbId: 4, releaseDate: null },
  ];
  let failing = false;
  const service = new ReleaseEventsService({
    getMovie: async (tmdbId: number) => ({ item: {
      releaseDate: tmdbId === 1 ? '2017-01-01' : '2021-01-01',
      collection: tmdbId === 99 ? null : { id: tmdbId === 50 ? 20 : 10 },
    } }),
    getCollection: async (id: number) => {
      if (failing) throw new Error('unavailable');
      return { items: id === 10 ? parts : [{ tmdbId: 51, releaseDate: '2026-09-17' }] };
    },
  } as never, {} as never);
  const root = { contentType: TrackedContentType.MOVIE, tmdbId: 2, userId: 'a' };
  const ids = (items: { tmdbId: number }[]) => items.map((item) => item.tmdbId);
  assert.deepEqual(ids(await service.expandFollowedTitles([root], now)), [2, 3, 4],
    'Only upcoming films in the same collection follow the original bell');
  assert.deepEqual(ids(await service.expandFollowedTitles([{ ...root, tmdbId: 50 }], now)), [50, 51],
    'Another Spider-Man collection must stay separate');
  assert.deepEqual(ids(await service.expandFollowedTitles([{ ...root, tmdbId: 99 }], now)), [99]);
  const overlapping = await service.expandFollowedTitles([root, { ...root, tmdbId: 1 }, { ...root, userId: 'b' }], now);
  assert.equal(overlapping.filter((item) => item.userId === 'a' && item.tmdbId === 3).length, 1,
    'Multiple bells in a saga must not duplicate sequel reminders for a user');
  assert.equal(overlapping.filter((item) => item.userId === 'b' && item.tmdbId === 3).length, 1);
  parts = [...parts, { tmdbId: 5, releaseDate: '2027-01-01' }];
  assert.ok(ids(await service.expandFollowedTitles([root], now)).includes(5),
    'A newly announced sequel must be discovered without reactivating the bell');
  assert.deepEqual(await service.expandFollowedTitles([], now), [], 'Disabling the root stops inherited follows');
  failing = true;
  assert.deepEqual(await service.expandFollowedTitles([root], now), [root],
    'A collection outage must preserve the directly followed title');
}

async function run() {
  await verifySagaSubscriptions();
  assert.equal(parseTmdbDate('2026-02-29'), null, 'invalid calendar dates must not be normalized');
  assert.equal(parseTmdbDate('2028-02-29')?.toISOString(), '2028-02-29T00:00:00.000Z');
  assert.deepEqual(
    selectEpisodeSeasonNumbers({
      seasons: [
        { airDate: '2020-01-01', seasonNumber: 1 },
        { airDate: '2021-01-01', seasonNumber: 2 },
        { airDate: null, seasonNumber: 3 },
        { airDate: '2099-01-01', seasonNumber: 4 },
      ] as never,
    }),
    [4, 3],
    'episode synchronization must stay bounded to the latest unknown or future seasons',
  );

  const events: StoredEvent[] = [];
  const runs: Array<Record<string, unknown>> = [];
  let movieReleaseDate = '2099-01-01';
  let failSeasonFetch = false;
  let episodes = [
    { airDate: '2099-02-01', episodeNumber: 1, seasonNumber: 2, title: 'Return' },
    { airDate: '2099-02-08', episodeNumber: 2, seasonNumber: 2, title: 'Aftermath' },
  ];
  const catalogue = {
    getMovie: async (tmdbId: number) => ({
      item: { releaseDate: movieReleaseDate, title: 'Canonical film', tmdbId },
    }),
    getSeason: async (tmdbId: number, seasonNumber: number) => {
      if (failSeasonFetch) {
        throw new Error('season unavailable');
      }

      return {
        item: {
          episodes: episodes.map((episode) => ({ ...episode, tmdbId })),
          seasonNumber,
        },
      };
    },
    getSeries: async (tmdbId: number) => ({
      item: {
        seasons: [
          { airDate: '2020-01-01', name: 'Season 1', seasonNumber: 1 },
          { airDate: '2099-02-01', name: 'Season 2', seasonNumber: 2 },
        ],
        title: 'Canonical series',
        tmdbId,
      },
    }),
  };
  const prisma = createPrismaDouble(events, runs);
  const service = new ReleaseEventsService(
    catalogue as never,
    prisma as never,
  );

  const firstMovieSync = await service.syncContent(TrackedContentType.MOVIE, 10, { force: true });
  const movieEventId = firstMovieSync.events[0]?.id;
  assert.equal(firstMovieSync.createdCount, 1);
  assert.equal(firstMovieSync.updatedCount, 0);

  const repeatedMovieSync = await service.syncContent(TrackedContentType.MOVIE, 10, { force: true });
  assert.equal(repeatedMovieSync.createdCount, 0);
  assert.equal(repeatedMovieSync.updatedCount, 0, 'an identical forced sync must remain idempotent');
  assert.equal(repeatedMovieSync.events[0]?.id, movieEventId);

  movieReleaseDate = '2099-03-15';
  const postponedMovieSync = await service.syncContent(TrackedContentType.MOVIE, 10, { force: true });
  assert.equal(postponedMovieSync.createdCount, 0);
  assert.equal(postponedMovieSync.updatedCount, 1);
  assert.equal(postponedMovieSync.events[0]?.id, movieEventId, 'a postponement must update the canonical event');
  assert.equal(postponedMovieSync.events[0]?.releaseDate?.toISOString().slice(0, 10), '2099-03-15');

  const firstSeriesSync = await service.syncContent(TrackedContentType.SERIES, 20, { force: true });
  assert.equal(firstSeriesSync.createdCount, 4, 'series sync must persist seasons and upcoming episodes');
  const episodeOneId = firstSeriesSync.events.find((event) => event.episodeNumber === 1)?.id;

  episodes = [
    { airDate: '2099-03-01', episodeNumber: 1, seasonNumber: 2, title: 'Return' },
  ];
  const changedSeriesSync = await service.syncContent(TrackedContentType.SERIES, 20, { force: true });
  assert.equal(changedSeriesSync.createdCount, 0);
  assert.equal(changedSeriesSync.updatedCount, 1, 'a changed episode date must update in place');
  assert.equal(changedSeriesSync.withdrawnCount, 1, 'a removed episode must be withdrawn');
  assert.equal(
    changedSeriesSync.events.find((event) => event.episodeNumber === 1)?.id,
    episodeOneId,
  );
  assert.equal(
    events.find((event) => event.episodeNumber === 2)?.status,
    ReleaseEventStatus.WITHDRAWN,
  );

  const fullSync = await service.syncAllTrackedContent();
  assert.equal(fullSync.contentCount, 2);
  assert.equal(fullSync.failedCount, 0);
  assert.equal(runs.at(-1)?.status, 'SUCCEEDED', 'scheduled runs must persist an observable status');

  failSeasonFetch = true;
  const partialSync = await service.syncAllTrackedContent();
  assert.equal(partialSync.failedCount, 1);
  assert.equal(
    runs.at(-1)?.status,
    'PARTIAL',
    'a failed episode scope must remain visible even when season events were synchronized',
  );

  console.log('Release events QA passed: idempotency, postponement, withdrawal, and run status.');
}

function createPrismaDouble(events: StoredEvent[], runs: Array<Record<string, unknown>>) {
  return {
    releaseAlertSubscription: {
      findMany: async () => [
        { contentType: TrackedContentType.MOVIE, tmdbId: 10 },
        { contentType: TrackedContentType.SERIES, tmdbId: 20 },
      ],
    },
    releaseEvent: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        events.filter((event) => matchesWhere(event, where)),
      updateMany: async ({ data, where }: {
        data: Partial<StoredEvent>;
        where: Record<string, unknown>;
      }) => {
        const matches = events.filter((event) => matchesWhere(event, where));
        matches.forEach((event) => Object.assign(event, data, { updatedAt: new Date() }));
        return { count: matches.length };
      },
      upsert: async ({ create, update, where }: {
        create: Omit<StoredEvent, 'createdAt' | 'id' | 'updatedAt'>;
        update: Partial<StoredEvent>;
        where: { sourceKey: string };
      }) => {
        const existing = events.find((event) => event.sourceKey === where.sourceKey);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }

        const created = {
          ...create,
          createdAt: new Date(),
          id: `event-${events.length + 1}`,
          updatedAt: new Date(),
        } as StoredEvent;
        events.push(created);
        return created;
      },
    },
    releaseEventSyncRun: {
      create: async () => {
        const run = { id: `run-${runs.length + 1}`, startedAt: new Date(), status: 'RUNNING' };
        runs.push(run);
        return run;
      },
      findFirst: async () => runs.at(-1) ?? null,
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const run = runs.find((item) => item.id === where.id);
        Object.assign(run!, data);
        return run;
      },
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
}

function matchesWhere(event: StoredEvent, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) {
      return true;
    }

    if (key === 'sourceKey' && typeof expected === 'object' && expected !== null) {
      return !(expected as { notIn: string[] }).notIn.includes(event.sourceKey);
    }

    return event[key as keyof StoredEvent] === expected;
  });
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
