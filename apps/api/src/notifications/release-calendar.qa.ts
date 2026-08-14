import assert from 'node:assert/strict';
import {
  ReleaseDatePrecision,
  ReleaseEventStatus,
  ReleaseNotificationType,
  TrackedContentType,
} from '../generated/prisma/enums';
import { NotificationsService } from './notifications.service';

async function run() {
  const subscriptions = [
    { contentType: TrackedContentType.MOVIE, tmdbId: 603, updatedAt: new Date() },
    { contentType: TrackedContentType.SERIES, tmdbId: 1399, updatedAt: new Date() },
  ];
  const syncCalls: string[] = [];
  let calendarSubscriptionTake: number | undefined;
  const releaseEventQueries: Array<Record<string, unknown>> = [];
  const prisma = {
    notification: {
      createMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: 0 }),
    },
    releaseAlertSubscription: {
      findMany: async ({ take }: { take?: number }) => {
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
  const releaseEvents = {
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

  console.log('Release calendar QA passed: personal scope, canonical refresh, ordering, and date precision.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
