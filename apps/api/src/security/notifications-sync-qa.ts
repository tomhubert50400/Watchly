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
  let catalogueCalls = 0;
  let inFlight = 0;
  let maximumInFlight = 0;
  let subscriptionTake: number | undefined;
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
    },
    releaseAlertSubscription: {
      findMany: async ({ take }: { take?: number }) => {
        subscriptionTake = take;
        return subscriptions.slice(0, take);
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const catalogue = {
    getMovie: async (tmdbId: number) => {
      catalogueCalls += 1;
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await new Promise<void>((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return { item: { releaseDate: '2099-01-01', title: `Movie ${tmdbId}`, tmdbId } };
    },
  };
  const service = new NotificationsService(
    { getOrCreateUser: async () => ({ id: 'user-a' }) } as never,
    catalogue as never,
    prisma as never,
  );
  const identity = { firebaseUid: 'firebase-a' } as never;

  const [first, second] = await Promise.all([service.sync(identity), service.sync(identity)]);

  assert.equal(subscriptionTake, 48, 'sync must enforce the per-request total-work quota in the database query');
  assert.equal(first.syncedContentCount, 48);
  assert.equal(second.syncedContentCount, 48);
  assert.equal(catalogueCalls, 96, 'two bounded concurrent syncs must each stop at the quota');
  assert.ok(maximumInFlight <= 24, 'two concurrent requests may each use at most one 12-item batch');
  assert.equal(dedupeKeys.size, 48, 'concurrent syncs must persist one row per dedupe key without errors');
  assert.equal(first.createdCount + second.createdCount, 48);

  console.log(`Notifications sync QA passed: quota=48, maxInFlight=${maximumInFlight}, unique=${dedupeKeys.size}.`);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
