// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { TrackedContentType } from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';

const subscriptionCount = 60;
const subscriptions = Array.from({ length: subscriptionCount }, (_, index) => ({
  contentType: TrackedContentType.MOVIE,
  tmdbId: index + 1,
  updatedAt: new Date('2026-07-11T00:00:00.000Z'),
}));

async function run() {
  let releaseEventCalls = 0;
  let inFlight = 0;
  let maximumInFlight = 0;
  let subscriptionTake: number | undefined;
  let updatedCandidateCount = 0;
  const dedupeKeys = new Set<string>();
  const prisma = {
    notification: {
      createMany: async ({ data, skipDuplicates }: { data: Array<{ dedupeKey: string }>; skipDuplicates?: boolean }) => {
        assert.equal(skipDuplicates, true, 'notification persistence must tolerate concurrent duplicate candidates');
        let count = 0;
        for (const item of data) {
          if (!dedupeKeys.has(item.dedupeKey)) {
            dedupeKeys.add(item.dedupeKey);
            count += 1;
          }
        }
        return { count };
      },
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
      updateMany: async ({ data, where }: {
        data: { body: string; releaseEventId: string; title: string };
        where: { dedupeKey: string; kind: string; userId: string };
      }) => {
        assert.match(data.body, new RegExp(`^${data.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
        assert.match(data.releaseEventId, /^event-/);
        assert.equal(where.kind, 'RELEASE');
        assert.equal(where.userId, 'user-a');
        updatedCandidateCount += 1;
        return { count: dedupeKeys.has(where.dedupeKey) ? 1 : 0 };
      },
    },
    releaseAlertSubscription: {
      findMany: async ({ take }: { take?: number }) => {
        subscriptionTake = take;
        return subscriptions.slice(0, take);
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const releaseEvents = {
    syncContent: async (contentType: TrackedContentType, tmdbId: number) => {
      releaseEventCalls += 1;
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await new Promise<void>((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return {
        events: [{
          contentType,
          episodeNumber: null,
          id: `event-${tmdbId}`,
          lastSyncedAt: new Date(),
          precision: 'DATE',
          regionCode: null,
          releaseDate: new Date('2099-01-01T00:00:00.000Z'),
          seasonNumber: null,
          source: 'TMDB',
          sourceKey: `tmdb:movie:${tmdbId}:release`,
          status: 'ACTIVE',
          timeZone: null,
          title: `Movie ${tmdbId}`,
          tmdbId,
          type: 'MOVIE_RELEASE',
        }],
      };
    },
  };
  const service = new NotificationsService(
    { getOrCreateUser: async () => ({ id: 'user-a' }) } as never,
    prisma as never,
    releaseEvents as never,
    { getOrThrow: () => 'development' } as never,
  );
  const identity = { firebaseUid: 'firebase-a' } as never;

  const [first, second] = await Promise.all([service.sync(identity), service.sync(identity)]);

  assert.equal(subscriptionTake, 48, 'sync must enforce the per-request total-work quota in the database query');
  assert.equal(first.syncedContentCount, 48);
  assert.equal(second.syncedContentCount, 48);
  assert.equal(releaseEventCalls, 96, 'two bounded concurrent syncs must each stop at the quota');
  assert.ok(maximumInFlight <= 24, 'two concurrent requests may each use at most one 12-item batch');
  assert.equal(updatedCandidateCount, 96, 'sync must refresh localized copy for every existing candidate');
  assert.equal(dedupeKeys.size, 48, 'concurrent syncs must persist one row per dedupe key without errors');
  assert.ok(
    [...dedupeKeys].every((key) => !/\d{4}-\d{2}-\d{2}/.test(key)),
    'release notification identity must stay stable when a date changes',
  );
  assert.equal(first.createdCount + second.createdCount, 48);

  let canonicalFullSyncCount = 0;
  let canonicalContentReadCount = 0;
  const projectedUsers: string[] = [];
  const scheduledPrisma = {
    notification: {
      createMany: async ({ data }: { data: Array<{ userId: string }> }) => {
        projectedUsers.push(...data.map((item) => item.userId));
        return { count: data.length };
      },
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: 0 }),
    },
    releaseAlertSubscription: {
      findMany: async () => [
        { contentType: TrackedContentType.MOVIE, tmdbId: 603, userId: 'user-a' },
        { contentType: TrackedContentType.MOVIE, tmdbId: 603, userId: 'user-b' },
      ],
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const scheduledReleaseEvents = {
    syncAllTrackedContent: async () => {
      canonicalFullSyncCount += 1;
    },
    syncContent: async () => {
      canonicalContentReadCount += 1;
      return {
        events: [{
          contentType: TrackedContentType.MOVIE,
          episodeNumber: null,
          id: 'event-603',
          lastSyncedAt: new Date(),
          precision: 'DATE',
          regionCode: null,
          releaseDate: new Date('2099-01-01T00:00:00.000Z'),
          seasonNumber: null,
          source: 'TMDB',
          sourceKey: 'tmdb:movie:603:release',
          status: 'ACTIVE',
          timeZone: null,
          title: 'Scheduled film',
          tmdbId: 603,
          type: 'MOVIE_RELEASE',
        }],
      };
    },
  };
  const scheduledService = new NotificationsService(
    {} as never,
    scheduledPrisma as never,
    scheduledReleaseEvents as never,
    { getOrThrow: () => 'development' } as never,
  );
  await (scheduledService as unknown as { performScheduledSync: () => Promise<void> })
    .performScheduledSync();

  assert.equal(canonicalFullSyncCount, 1, 'scheduled projection must refresh canonical events first');
  assert.equal(
    canonicalContentReadCount,
    1,
    'subscribers to the same content must share one canonical event read',
  );
  assert.deepEqual(
    projectedUsers.sort(),
    ['user-a', 'user-b'],
    'scheduled release notifications must project to every subscriber',
  );

  console.log(`Notifications sync QA passed: quota=48, maxInFlight=${maximumInFlight}, unique=${dedupeKeys.size}.`);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
