import assert from 'node:assert/strict';
import {
  ReleaseDatePrecision,
  ReleaseEventStatus,
  ReleaseNotificationType,
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';
import { NotificationsService } from './notifications.service';

async function run() {
  const subscriptions = [
    { contentType: TrackedContentType.MOVIE, tmdbId: 603, updatedAt: new Date() },
    { contentType: TrackedContentType.SERIES, tmdbId: 1399, updatedAt: new Date() },
  ];
  const syncCalls: string[] = [];
  let states: Array<{ contentType: TrackedContentType; tmdbId: number; status: UserContentStatus | null }> = [];
  let watchlistItems: Array<{ contentType: TrackedContentType; tmdbId: number }> = [];
  let progress: Array<{ seriesTmdbId: number }> = [];
  let calendarSubscriptionTake: number | undefined;
  const releaseEventQueries: Array<Record<string, unknown>> = [];
  const prisma = {
    notification: {
      createMany: async () => assert.fail('Reading the calendar must not create notifications'),
      deleteMany: async () => assert.fail('Reading the calendar must not delete notifications'),
      updateMany: async () => assert.fail('Reading the calendar must not update notifications'),
    },
    userContentState: {
      findMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { userId: 'user-a' });
        return states;
      },
    },
    personalWatchlistItem: {
      findMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { watchlist: { userId: 'user-a' } });
        return watchlistItems;
      },
    },
    userEpisodeProgress: {
      findMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { userId: 'user-a' });
        return progress;
      },
    },
    releaseAlertSubscription: {
      findMany: async ({ take, where }: { take?: number; where: unknown }) => {
        assert.deepEqual(where, { userId: 'user-a' });
        calendarSubscriptionTake = take;
        return subscriptions;
      },
    },
    releaseEvent: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        releaseEventQueries.push(where);
        return [
          {
            contentType: TrackedContentType.SERIES,
            episodeNumber: 1,
            id: 'event-episode',
            precision: ReleaseDatePrecision.DATE,
            releaseDate: new Date('2026-09-02T00:00:00.000Z'),
            seasonNumber: 2,
            status: ReleaseEventStatus.ACTIVE,
            title: 'Arcane: S2E1 Return',
            tmdbId: 1399,
            type: ReleaseNotificationType.EPISODE_RELEASE,
          },
          {
            contentType: TrackedContentType.MOVIE,
            episodeNumber: null,
            id: 'event-movie',
            precision: ReleaseDatePrecision.DATE,
            releaseDate: new Date('2026-08-20T00:00:00.000Z'),
            seasonNumber: null,
            status: ReleaseEventStatus.ACTIVE,
            title: 'The Matrix',
            tmdbId: 603,
            type: ReleaseNotificationType.MOVIE_RELEASE,
          },
          {
            contentType: TrackedContentType.SERIES,
            episodeNumber: null,
            id: 'event-undated',
            precision: ReleaseDatePrecision.UNKNOWN,
            releaseDate: null,
            seasonNumber: 3,
            status: ReleaseEventStatus.ACTIVE,
            title: 'Arcane: Season 3',
            tmdbId: 1399,
            type: ReleaseNotificationType.SEASON_RELEASE,
          },
        ];
      },
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  let includeSequel = false;
  const releaseEvents = {
    expandFollowedTitles: async (items: Array<{ contentType: TrackedContentType; tmdbId: number }>) =>
      includeSequel ? [...items, { contentType: TrackedContentType.MOVIE, tmdbId: 604 }] : items,
    syncContent: async (contentType: TrackedContentType, tmdbId: number) => {
      syncCalls.push(`${contentType}:${tmdbId}`);
      return { events: [] };
    },
  };
  const service = new NotificationsService(
    { getOrCreateUser: async () => ({ id: 'user-a' }) } as never,
    prisma as never,
    releaseEvents as never,
    { enqueueReleaseNotifications: async () => 0 } as never,
    { getOrThrow: () => 'development' } as never,
  );

  const response = await service.listReleaseCalendar(
    { firebaseUid: 'firebase-a' } as never,
    new Date('2026-08-14T12:00:00.000Z'),
  );

  assert.deepEqual(syncCalls.sort(), ['MOVIE:603', 'SERIES:1399']);
  assert.equal(calendarSubscriptionTake, undefined, 'calendar reads must not silently omit active alerts');
  assert.deepEqual(response.items.map((item) => item.id), [
    'event-movie',
    'event-episode',
    'event-undated',
  ]);
  assert.deepEqual(response.items[0], {
    contentType: 'movie',
    episodeNumber: null,
    id: 'event-movie',
    precision: 'date',
    releaseDate: '2026-08-20',
    seasonNumber: null,
    title: 'The Matrix',
    tmdbId: 603,
    type: 'movie_release',
  });
  assert.equal(response.items[2]?.releaseDate, null, 'unknown dates must not gain false precision');
  const releaseEventWhere = releaseEventQueries[0];
  assert.ok(releaseEventWhere, 'calendar must query canonical release events');
  assert.equal(releaseEventWhere.status, ReleaseEventStatus.ACTIVE);
  assert.deepEqual(releaseEventWhere.AND, [
    {
      OR: [
        { contentType: TrackedContentType.MOVIE, tmdbId: 603 },
        { contentType: TrackedContentType.SERIES, tmdbId: 1399 },
      ],
    },
    {
      OR: [
        { releaseDate: { gte: new Date('2026-08-14T00:00:00.000Z') } },
        { releaseDate: null },
      ],
    },
  ]);

  includeSequel = true;
  await service.listReleaseCalendar({ firebaseUid: 'firebase-a' } as never);
  const sequelWhere = releaseEventQueries.pop()?.AND as Array<{ OR: Array<{ tmdbId: number }> }>;
  assert.ok(sequelWhere[0].OR.some((item) => item.tmdbId === 604), 'Inherited saga releases must appear in the calendar scope');
  assert.ok(syncCalls.includes('MOVIE:604'), 'Inherited releases must refresh canonical dates');
  includeSequel = false;
  subscriptions.length = 0;
  states = [
    ...Array.from({ length: 60 }, (_, index) => ({
      contentType: TrackedContentType.MOVIE,
      tmdbId: 1000 + index,
      status: UserContentStatus.WATCHLISTED,
    })),
    { contentType: TrackedContentType.SERIES, tmdbId: 2000, status: UserContentStatus.WATCHING },
    { contentType: TrackedContentType.SERIES, tmdbId: 2001, status: UserContentStatus.WATCHED },
    { contentType: TrackedContentType.SERIES, tmdbId: 2002, status: UserContentStatus.DROPPED },
    { contentType: TrackedContentType.MOVIE, tmdbId: 2003, status: UserContentStatus.WATCHED },
    { contentType: TrackedContentType.SERIES, tmdbId: 2004, status: null },
  ];
  watchlistItems = [
    { contentType: TrackedContentType.MOVIE, tmdbId: 1000 },
    { contentType: TrackedContentType.MOVIE, tmdbId: 3000 },
  ];
  progress = [{ seriesTmdbId: 2000 }, { seriesTmdbId: 2002 }, { seriesTmdbId: 4000 }];
  syncCalls.length = 0;
  await service.listReleaseCalendar({ firebaseUid: 'firebase-a' } as never);
  assert.equal(syncCalls.length, 64, 'Every followed title must be refreshed, including titles beyond the old 48-alert limit');
  assert.equal(new Set(syncCalls).size, 64, 'Titles from multiple sources must be deduplicated');
  assert.ok(syncCalls.includes('SERIES:2001'), 'A watched series must retain upcoming seasons');
  assert.ok(syncCalls.includes('MOVIE:3000'), 'Personal watchlists must work without a bell');
  assert.ok(syncCalls.includes('SERIES:4000'), 'Episode progress must count as following a series');
  assert.ok(!syncCalls.includes('SERIES:2002'), 'Dropped series must not be inferred from old episode progress');
  assert.ok(!syncCalls.includes('MOVIE:2003'), 'Watched movies alone must not count as upcoming follows');
  assert.ok(!syncCalls.includes('SERIES:2004'), 'A cleared tracking status must not count as following');
  const followedWhere = releaseEventQueries[1]?.AND as Array<{ OR: Array<{ contentType: string; tmdbId: number }> }>;
  assert.deepEqual(
    followedWhere[0]?.OR.map((item) => `${item.contentType}:${item.tmdbId}`).sort(),
    [...syncCalls].sort(),
    'The canonical event query must use exactly the personal followed titles',
  );
  states = [];
  watchlistItems = [];
  progress = [];
  syncCalls.length = 0;
  assert.deepEqual(await service.listReleaseCalendar({ firebaseUid: 'firebase-a' } as never), { items: [] });
  assert.equal(syncCalls.length, 0, 'An empty calendar must not sync any titles');

  console.log('Release calendar QA passed: followed titles, personal scope, no notification side effects, canonical refresh, ordering, and date precision.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
