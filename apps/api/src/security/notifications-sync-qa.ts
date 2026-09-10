// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { ReleaseEventsService } from '../release-events/release-events.service';
import { TrackedContentType } from '../generated/prisma/enums';
import { buildReleaseReminderCandidates, NotificationsService } from '../notifications/notifications.service';

const subscriptionCount = 60;
const subscriptions = Array.from({ length: subscriptionCount }, (_, index) => ({
  contentType: TrackedContentType.MOVIE,
  tmdbId: index + 1,
  updatedAt: new Date('2026-07-11T00:00:00.000Z'),
}));

async function run() {
  const now = new Date('2026-09-10T23:59:59.000Z');
  const event = {
    contentType: 'SERIES', episodeNumber: 1, id: 'episode-1',
    lastSyncedAt: now, precision: 'DATE', regionCode: null,
    releaseDate: new Date('2026-09-17T00:00:00.000Z'), seasonNumber: 1,
    source: 'TMDB', sourceKey: 'episode-1', status: 'ACTIVE', timeZone: null,
    title: 'Test series', tmdbId: 1, type: 'EPISODE_RELEASE',
  } as Parameters<typeof buildReleaseReminderCandidates>[0][number];
  const candidates = (overrides = {}) => buildReleaseReminderCandidates([{ ...event, ...overrides }], now);
  assert.equal(candidates().length, 1, 'J-7 must use calendar days even at 23:59');
  for (const date of ['2026-09-18', '2026-09-16', '2026-09-10', '2026-09-09']) {
    assert.equal(candidates({ releaseDate: new Date(date) }).length, 0, 'Only J-7 creates a reminder');
  }
  assert.equal(candidates({ releaseDate: null }).length, 0);
  assert.equal(candidates({ status: 'WITHDRAWN' }).length, 0);
  assert.equal(candidates({ type: 'SEASON_RELEASE' }).length, 0, 'No season/episode double alert');
  const batch = Array.from({ length: 6 }, (_, index) => ({ ...event, id: 'episode-' + index, episodeNumber: index + 1 }));
  const grouped = buildReleaseReminderCandidates(batch, now);
  assert.equal(grouped.length, 1, 'Six episodes released together must send one reminder');
  assert.match(grouped[0].body, /6 new episodes/);
  assert.equal(grouped[0].episodeNumber, undefined);
  assert.equal(buildReleaseReminderCandidates([...batch].reverse(), now)[0].generatedKey, grouped[0].generatedKey);
  assert.equal(candidates({ contentType: 'MOVIE', type: 'MOVIE_RELEASE' }).length, 1);

  let enabled = false;
  const activation = new NotificationsService(
    { getOrCreateUser: async () => ({ id: 'user-a' }) } as never,
    {
      withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
      releaseAlertSubscription: {
        upsert: async () => { enabled = true; },
        findUnique: async () => enabled ? {} : null,
      },
      notification: { findMany: async () => [] },
    } as never,
    { syncContent: async () => assert.fail('Enabling a bell must not generate a backlog') } as never,
    { enqueueReleaseNotifications: async () => assert.fail('Enabling a bell must not push') } as never,
    {} as never,
  );
  assert.equal((await activation.enableReleaseAlert({} as never, 'series', 1)).enabled, true);

  let releaseEventCalls = 0;
  let inFlight = 0;
  let maximumInFlight = 0;
  let subscriptionTake: number | undefined;
  let updatedCandidateCount = 0;
  const dedupeKeys = new Set<string>();
  const prisma = {
    characterAlertSubscription: { findMany: async () => [] },
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
    expandFollowedTitles: async (items: unknown[]) => items,
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
          releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    { enqueueReleaseNotifications: async () => 0 } as never,
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
  const sagaResolver = new ReleaseEventsService({
    getMovie: async () => ({ item: { releaseDate: '2021-01-01', collection: { id: 10 } } }),
    getCollection: async () => ({ items: [{ tmdbId: 603, releaseDate: '2099-01-01' }] }),
  } as never, {} as never);
  const scheduledPrisma = {
    characterAlertSubscription: { findMany: async () => [] },
    notification: {
      createMany: async ({ data }: { data: Array<{ userId: string }> }) => {
        projectedUsers.push(...data.map((item) => item.userId));
        return { count: data.length };
      },
      deleteMany: async () => ({ count: 0 }),
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    releaseAlertSubscription: {
      findMany: async () => [
        { contentType: TrackedContentType.MOVIE, tmdbId: 603, userId: 'user-a' },
        { contentType: TrackedContentType.MOVIE, tmdbId: 1, userId: 'user-b' },
        { contentType: TrackedContentType.MOVIE, tmdbId: 1, userId: 'user-a' },
      ],
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const scheduledReleaseEvents = {
    expandFollowedTitles: sagaResolver.expandFollowedTitles.bind(sagaResolver),
    syncAllTrackedContent: async () => {
      canonicalFullSyncCount += 1;
    },
    syncContent: async (_contentType: TrackedContentType, tmdbId: number) => {
      canonicalContentReadCount += 1;
      if (tmdbId !== 603) return { events: [] };
      return {
        events: [{
          contentType: TrackedContentType.MOVIE,
          episodeNumber: null,
          id: 'event-603',
          lastSyncedAt: new Date(),
          precision: 'DATE',
          regionCode: null,
          releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    { enqueueReleaseNotifications: async () => 0 } as never,
    { getOrThrow: () => 'development' } as never,
  );
  await (scheduledService as unknown as { performScheduledSync: () => Promise<void> })
    .performScheduledSync();

  assert.equal(canonicalFullSyncCount, 1, 'scheduled projection must refresh canonical events first');
  assert.equal(
    canonicalContentReadCount,
    2,
    'subscribers to the same content must share one canonical event read',
  );
  assert.deepEqual(
    projectedUsers.sort(),
    ['user-a', 'user-b'],
    'A sequel must reach direct and inherited subscribers once, despite overlapping bells',
  );

  console.log(`Notifications sync QA passed: quota=48, maxInFlight=${maximumInFlight}, unique=${dedupeKeys.size}.`);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
