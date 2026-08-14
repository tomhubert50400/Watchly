import assert from 'node:assert/strict';
import {
  ReleaseNotificationType,
  PushDeliveryStatus,
  TrackedContentType,
} from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpoPushGateway, ExpoPushMessage } from './expo-push.gateway';
import { assertExpoPushToken, PushService } from './push.service';

async function run() {
  await verifyGatewayContract();
  await verifyRegistrationIsolation();
  await verifyReleaseDispatch();
  await verifyInvalidTokenReceiptCleanup();
  await verifyNotificationProjectionDedupe();
  assert.doesNotThrow(() => assertExpoPushToken('ExpoPushToken[valid_token-1]'));
  assert.throws(() => assertExpoPushToken('not-a-token'), /valid Expo push token/);
  console.log('Push QA passed: environment isolation, dispatch dedupe contract, receipts, and token cleanup.');
}

async function verifyGatewayContract() {
  let request: { body?: string; headers?: HeadersInit; url?: string } = {};
  const gateway = new ExpoPushGateway({ get: () => '' } as never);
  const tickets = await gateway.send([{
    body: 'Release body',
    data: { url: 'tvapp://film/1' },
    title: 'Release title',
    to: 'ExpoPushToken[token-a]',
  }], async (input, init) => {
    request = { body: init?.body as string, headers: init?.headers, url: String(input) };
    return new Response(JSON.stringify({ data: [{ id: 'ticket-a', status: 'ok' }] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  });

  assert.equal(request.url, 'https://exp.host/--/api/v2/push/send');
  assert.equal(JSON.parse(request.body ?? '[]')[0].to, 'ExpoPushToken[token-a]');
  assert.deepEqual(tickets, [{ id: 'ticket-a', status: 'ok' }]);
}

async function verifyRegistrationIsolation() {
  let upsertArgs: Record<string, unknown> | null = null;
  const cancelledDeliveries: Array<Record<string, unknown>> = [];
  const prisma = {
    notificationPreference: {
      upsert: async () => ({ pushEnabled: false, releasePushEnabled: true, userId: 'user-a' }),
    },
    pushDevice: {
      findUnique: async () => ({ id: 'device-a', userId: 'user-b' }),
      upsert: async (args: Record<string, unknown>) => {
        upsertArgs = args;
        return { active: true, environment: 'staging' };
      },
    },
    pushDelivery: {
      updateMany: async (args: Record<string, unknown>) => {
        cancelledDeliveries.push(args);
        return { count: 1 };
      },
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  const service = createService(prisma, { send: async () => [], getReceipts: async () => ({}) }, 'staging');

  const response = await service.registerDevice(
    { firebaseUid: 'firebase-a' } as never,
    'ExpoPushToken[token-a]',
    'ios',
  );

  assert.deepEqual(response, { active: true, environment: 'staging', platform: 'ios' });
  assert.deepEqual(
    (upsertArgs as { where: unknown } | null)?.where,
    { environment_expoPushToken: { environment: 'staging', expoPushToken: 'ExpoPushToken[token-a]' } },
  );
  assert.equal(cancelledDeliveries.length, 1, 'reassigning a token must cancel its old pending deliveries');
}

async function verifyReleaseDispatch() {
  const updates: Array<Record<string, unknown>> = [];
  let sentMessages: ExpoPushMessage[] = [];
  const pendingDelivery = {
    attemptCount: 0,
    createdAt: new Date(),
    id: 'delivery-a',
    notification: {
      body: 'Film releases soon.',
      contentType: TrackedContentType.MOVIE,
      id: 'notification-a',
      title: 'A Film & More',
      tmdbId: 100,
      userId: 'user-a',
    },
    pushDevice: {
      environment: 'development',
      expoPushToken: 'ExpoPushToken[token-a]',
      userId: 'user-a',
      user: { notificationPreference: { pushEnabled: true, releasePushEnabled: true } },
    },
    pushDeviceId: 'device-a',
  };
  const prisma = {
    pushDelivery: {
      findMany: async ({ where }: { where: { status: PushDeliveryStatus } }) =>
        where.status === PushDeliveryStatus.PENDING ? [pendingDelivery] : [],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return {};
      },
      updateMany: async () => ({ count: 0 }),
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  const service = createService(prisma, {
    getReceipts: async () => ({}),
    send: async (messages: ExpoPushMessage[]) => {
      sentMessages = messages;
      return [{ id: 'ticket-a', status: 'ok' as const }];
    },
  });

  await service.runWorker();

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0]?.data.url, 'tvapp://film/100?title=A%20Film%20%26%20More');
  assert.equal(sentMessages[0]?.channelId, 'release-alerts');
  assert.ok(updates.some((update) => update.status === PushDeliveryStatus.TICKETED));
}

async function verifyNotificationProjectionDedupe() {
  const stored = new Map<string, {
    body: string;
    contentType: TrackedContentType;
    dedupeKey: string;
    id: string;
    title: string;
    tmdbId: number;
  }>();
  const enqueued: string[][] = [];
  const prisma = {
    notification: {
      createMany: async ({ data }: { data: Array<{ body: string; contentType: TrackedContentType; dedupeKey: string; title: string; tmdbId: number }> }) => {
        let count = 0;
        data.forEach((item) => {
          if (stored.has(item.dedupeKey)) return;
          stored.set(item.dedupeKey, { ...item, id: `notification-${stored.size + 1}` });
          count += 1;
        });
        return { count };
      },
      findMany: async ({ select, where }: { select: Record<string, boolean>; where: { dedupeKey: { in: string[] } } }) => {
        const rows = [...stored.values()].filter((row) => where.dedupeKey.in.includes(row.dedupeKey));
        return select.dedupeKey
          ? rows.map((row) => ({ dedupeKey: row.dedupeKey }))
          : rows.map(({ body, contentType, id, title, tmdbId }) => ({ body, contentType, id, title, tmdbId }));
      },
      updateMany: async () => ({ count: 0 }),
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  const notifications = new NotificationsService(
    {} as never,
    prisma as never,
    {} as never,
    {
      enqueueReleaseNotifications: async (_userId: string, rows: Array<{ id: string }>) => {
        enqueued.push(rows.map((row) => row.id));
        return rows.length;
      },
    } as never,
    { getOrThrow: () => 'development' } as never,
  );
  const candidate = {
    body: 'Dedupe film releases on 2099-01-01.',
    contentType: TrackedContentType.MOVIE,
    generatedKey: 'movie:100:announcement',
    releaseEventId: 'event-a',
    releasedAt: new Date('2099-01-01T00:00:00.000Z'),
    title: 'Dedupe film',
    tmdbId: 100,
    type: ReleaseNotificationType.MOVIE_RELEASE,
  };
  const createNotifications = (notifications as unknown as {
    createNotifications: (userId: string, candidates: unknown[]) => Promise<number>;
  }).createNotifications.bind(notifications);

  await createNotifications('user-a', [candidate]);
  await createNotifications('user-a', [candidate]);

  assert.deepEqual(enqueued, [['notification-1']], 'an internal notification may enqueue one push only once');
}

async function verifyInvalidTokenReceiptCleanup() {
  const deliveryUpdates: Array<Record<string, unknown>> = [];
  const deviceUpdates: Array<Record<string, unknown>> = [];
  const sentAt = new Date(Date.now() - 20 * 60_000);
  const prisma = {
    pushDelivery: {
      findMany: async ({ where }: { where: { status: PushDeliveryStatus } }) =>
        where.status === PushDeliveryStatus.TICKETED
          ? [{
              id: 'delivery-b',
              pushDeviceId: 'device-b',
              receiptCheckedAt: null,
              sentAt,
              ticketId: 'ticket-b',
            }]
          : [],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        deliveryUpdates.push(data);
        return {};
      },
      updateMany: async () => ({ count: 0 }),
    },
    pushDevice: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        deviceUpdates.push(data);
        return {};
      },
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  const service = createService(prisma, {
    getReceipts: async () => ({
      'ticket-b': {
        details: { error: 'DeviceNotRegistered' },
        message: 'The device is no longer registered.',
        status: 'error' as const,
      },
    }),
    send: async () => [],
  });

  await service.runWorker();

  assert.ok(deliveryUpdates.some((update) =>
    update.status === PushDeliveryStatus.FAILED && update.errorCode === 'DeviceNotRegistered'
  ));
  assert.ok(deviceUpdates.some((update) => update.active === false && update.revokedAt instanceof Date));
}

function createService(
  prisma: object,
  gateway: { getReceipts: (ids: string[]) => Promise<Record<string, unknown>>; send: (messages: ExpoPushMessage[]) => Promise<unknown[]> },
  environment = 'development',
) {
  return new PushService(
    { getOrCreateUser: async () => ({ id: 'user-a' }) } as never,
    prisma as never,
    gateway as never,
    { getOrThrow: () => environment } as never,
  );
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
