import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  PushDeliveryStatus,
  PushPlatform,
  TrackedContentType,
} from '../generated/prisma/enums';
import { ExpoPushGateway, ExpoPushResult } from './expo-push.gateway';

const WORKER_INTERVAL_MS = 60_000;
const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_EXPIRY_MS = 24 * 60 * 60_000;
const MAX_DELIVERY_ATTEMPTS = 5;

type PushPreferencesInput = {
  pushEnabled?: boolean;
  releasePushEnabled?: boolean;
};

type ReleasePushNotification = {
  body: string;
  contentType: TrackedContentType;
  id: string;
  title: string;
  tmdbId: number;
};

@Injectable()
export class PushService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly environment: string;
  private readonly logger = new Logger(PushService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private workerPromise: Promise<void> | null = null;

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExpoPushGateway) private readonly gateway: ExpoPushGateway,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.environment = config.getOrThrow<string>('APP_ENV');
  }

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.runWorker(), WORKER_INTERVAL_MS);
    this.timer.unref();
    void this.runWorker();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async getPreferences(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    return toPreferencesDto(await this.ensurePreferences(userId));
  }

  async updatePreferences(identity: AuthenticatedIdentity, input: PushPreferencesInput) {
    const userId = await this.getUserId(identity);
    const current = await this.ensurePreferences(userId);
    const preferences = await this.prisma.withConnectionRetry(() =>
      this.prisma.notificationPreference.update({
        data: {
          pushEnabled: input.pushEnabled ?? current.pushEnabled,
          releasePushEnabled: input.releasePushEnabled ?? current.releasePushEnabled,
        },
        where: { userId },
      }),
    );

    if (!preferences.pushEnabled || !preferences.releasePushEnabled) {
      await this.cancelPendingDeliveries(userId, 'PreferenceDisabled');
    }

    return toPreferencesDto(preferences);
  }

  async registerDevice(
    identity: AuthenticatedIdentity,
    expoPushToken: string,
    platform: 'android' | 'ios',
  ) {
    const userId = await this.getUserId(identity);
    assertExpoPushToken(expoPushToken);
    await this.ensurePreferences(userId);

    const existingDevice = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDevice.findUnique({
        select: { id: true, userId: true },
        where: {
          environment_expoPushToken: {
            environment: this.environment,
            expoPushToken,
          },
        },
      }),
    );
    if (existingDevice && existingDevice.userId !== userId) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.pushDelivery.updateMany({
          data: {
            completedAt: new Date(),
            errorCode: 'DeviceOwnershipChanged',
            status: PushDeliveryStatus.FAILED,
          },
          where: {
            pushDeviceId: existingDevice.id,
            status: PushDeliveryStatus.PENDING,
          },
        }),
      );
    }

    const device = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDevice.upsert({
        create: {
          environment: this.environment,
          expoPushToken,
          platform: toPushPlatform(platform),
          userId,
        },
        update: {
          active: true,
          lastRegisteredAt: new Date(),
          platform: toPushPlatform(platform),
          revokedAt: null,
          userId,
        },
        where: {
          environment_expoPushToken: {
            environment: this.environment,
            expoPushToken,
          },
        },
      }),
    );

    return {
      active: device.active,
      environment: device.environment,
      platform,
    };
  }

  async revokeDevice(identity: AuthenticatedIdentity, expoPushToken: string) {
    const userId = await this.getUserId(identity);
    assertExpoPushToken(expoPushToken);
    const revokedAt = new Date();
    const devices = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDevice.findMany({
        select: { id: true },
        where: {
          active: true,
          environment: this.environment,
          expoPushToken,
          userId,
        },
      }),
    );

    if (devices.length > 0) {
      await this.prisma.withConnectionRetry(() => Promise.all([
        this.prisma.pushDevice.updateMany({
          data: { active: false, revokedAt },
          where: { id: { in: devices.map((device) => device.id) } },
        }),
        this.prisma.pushDelivery.updateMany({
          data: {
            completedAt: revokedAt,
            errorCode: 'DeviceRevoked',
            status: PushDeliveryStatus.FAILED,
          },
          where: {
            pushDeviceId: { in: devices.map((device) => device.id) },
            status: PushDeliveryStatus.PENDING,
          },
        }),
      ]));
    }

    return { revoked: devices.length > 0 };
  }

  async enqueueReleaseNotifications(userId: string, notifications: ReleasePushNotification[]) {
    if (notifications.length === 0) return 0;
    const preferences = await this.ensurePreferences(userId);
    if (!preferences.pushEnabled || !preferences.releasePushEnabled) return 0;

    const devices = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDevice.findMany({
        select: { id: true },
        where: {
          active: true,
          environment: this.environment,
          userId,
        },
      }),
    );
    if (devices.length === 0) return 0;

    const queued = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.createMany({
        data: notifications.flatMap((notification) => devices.map((device) => ({
          notificationId: notification.id,
          pushDeviceId: device.id,
        }))),
        skipDuplicates: true,
      }),
    );

    if (queued.count > 0) void this.runWorker();
    return queued.count;
  }

  async runWorker() {
    if (this.workerPromise) return this.workerPromise;
    this.workerPromise = this.performWorker().finally(() => {
      this.workerPromise = null;
    });
    return this.workerPromise;
  }

  private async performWorker() {
    try {
      await this.dispatchPending();
      await this.checkReceipts();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async dispatchPending() {
    const now = new Date();
    const deliveries = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.findMany({
        include: {
          notification: true,
          pushDevice: {
            include: { user: { include: { notificationPreference: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
        where: {
          nextAttemptAt: { lte: now },
          pushDevice: { active: true, environment: this.environment },
          status: PushDeliveryStatus.PENDING,
        },
      }),
    );
    if (deliveries.length === 0) return;

    const ownershipMismatch = deliveries.filter((delivery) =>
      delivery.notification.userId !== delivery.pushDevice.userId
    );
    if (ownershipMismatch.length > 0) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.pushDelivery.updateMany({
          data: {
            completedAt: now,
            errorCode: 'DeviceOwnershipChanged',
            status: PushDeliveryStatus.FAILED,
          },
          where: { id: { in: ownershipMismatch.map((delivery) => delivery.id) } },
        }),
      );
    }
    const ownedDeliveries = deliveries.filter((delivery) =>
      delivery.notification.userId === delivery.pushDevice.userId
    );
    const eligible = ownedDeliveries.filter((delivery) => {
      const preferences = delivery.pushDevice.user.notificationPreference;
      return preferences?.pushEnabled && preferences.releasePushEnabled;
    });
    const ineligible = ownedDeliveries.filter((delivery) => !eligible.includes(delivery));

    if (ineligible.length > 0) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.pushDelivery.updateMany({
          data: {
            completedAt: now,
            errorCode: 'PreferenceDisabled',
            status: PushDeliveryStatus.FAILED,
          },
          where: { id: { in: ineligible.map((delivery) => delivery.id) } },
        }),
      );
    }
    if (eligible.length === 0) return;

    let tickets: ExpoPushResult[];
    try {
      tickets = await this.gateway.send(eligible.map((delivery) => ({
        body: delivery.notification.body,
        channelId: 'release-alerts',
        data: {
          kind: 'release',
          notificationId: delivery.notification.id,
          url: buildReleaseUrl(delivery.notification),
        },
        sound: 'default',
        title: delivery.notification.title,
        to: delivery.pushDevice.expoPushToken,
      })));
    } catch (error) {
      await Promise.all(eligible.map((delivery) => this.retryDelivery(delivery, error)));
      return;
    }

    await Promise.all(eligible.map((delivery, index) =>
      this.applyTicket(delivery.id, delivery.pushDeviceId, tickets[index]!, now)
    ));
    this.logger.log(JSON.stringify({
      attemptedCount: eligible.length,
      event: 'push.release.dispatch.completed',
    }));
  }

  private async applyTicket(
    deliveryId: string,
    pushDeviceId: string,
    ticket: ExpoPushResult,
    sentAt: Date,
  ) {
    if (ticket.status === 'ok' && ticket.id) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.pushDelivery.update({
          data: {
            attemptCount: { increment: 1 },
            errorCode: null,
            errorMessage: null,
            lastAttemptAt: sentAt,
            sentAt,
            status: PushDeliveryStatus.TICKETED,
            ticketId: ticket.id,
          },
          where: { id: deliveryId },
        }),
      );
      return;
    }

    const errorCode = ticket.details?.error ?? 'ExpoTicketError';
    await this.failDelivery(deliveryId, errorCode, ticket.message, sentAt);
    if (errorCode === 'DeviceNotRegistered') await this.revokeDeviceById(pushDeviceId, sentAt);
  }

  private async retryDelivery(
    delivery: { attemptCount: number; id: string },
    error: unknown,
  ) {
    const attemptCount = delivery.attemptCount + 1;
    const attemptedAt = new Date();
    if (attemptCount >= MAX_DELIVERY_ATTEMPTS) {
      await this.failDelivery(
        delivery.id,
        'ExpoRequestFailed',
        error instanceof Error ? error.message : String(error),
        attemptedAt,
        attemptCount,
      );
      return;
    }

    await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.update({
        data: {
          attemptCount,
          errorCode: 'ExpoRequestFailed',
          errorMessage: sanitizePushErrorMessage(error instanceof Error ? error.message : String(error)),
          lastAttemptAt: attemptedAt,
          nextAttemptAt: new Date(attemptedAt.getTime() + 2 ** attemptCount * 30_000),
        },
        where: { id: delivery.id },
      }),
    );
  }

  private async checkReceipts() {
    const now = new Date();
    const receiptCutoff = new Date(now.getTime() - RECEIPT_DELAY_MS);
    const deliveries = await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.findMany({
        orderBy: { sentAt: 'asc' },
        take: 1000,
        where: {
          OR: [
            { receiptCheckedAt: null },
            { receiptCheckedAt: { lte: receiptCutoff } },
          ],
          sentAt: { lte: receiptCutoff },
          status: PushDeliveryStatus.TICKETED,
          ticketId: { not: null },
        },
      }),
    );
    if (deliveries.length === 0) return;

    const receipts = await this.gateway.getReceipts(
      deliveries.flatMap((delivery) => delivery.ticketId ? [delivery.ticketId] : []),
    );

    await Promise.all(deliveries.map(async (delivery) => {
      const receipt = delivery.ticketId ? receipts[delivery.ticketId] : undefined;
      if (!receipt) {
        if (delivery.sentAt && now.getTime() - delivery.sentAt.getTime() >= RECEIPT_EXPIRY_MS) {
          await this.failDelivery(delivery.id, 'ReceiptExpired', 'No Expo receipt was available.', now);
        } else {
          await this.prisma.withConnectionRetry(() =>
            this.prisma.pushDelivery.update({ data: { receiptCheckedAt: now }, where: { id: delivery.id } }),
          );
        }
        return;
      }

      if (receipt.status === 'ok') {
        await this.prisma.withConnectionRetry(() =>
          this.prisma.pushDelivery.update({
            data: {
              completedAt: now,
              receiptCheckedAt: now,
              status: PushDeliveryStatus.DELIVERED,
            },
            where: { id: delivery.id },
          }),
        );
        return;
      }

      const errorCode = receipt.details?.error ?? 'ExpoReceiptError';
      await this.failDelivery(delivery.id, errorCode, receipt.message, now);
      if (errorCode === 'DeviceNotRegistered') await this.revokeDeviceById(delivery.pushDeviceId, now);
    }));
  }

  private async failDelivery(
    deliveryId: string,
    errorCode: string,
    errorMessage: string | undefined,
    completedAt: Date,
    attemptCount?: number,
  ) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.update({
        data: {
          ...(attemptCount === undefined ? {} : { attemptCount }),
          completedAt,
          errorCode,
          errorMessage: sanitizePushErrorMessage(errorMessage),
          lastAttemptAt: completedAt,
          receiptCheckedAt: completedAt,
          status: PushDeliveryStatus.FAILED,
        },
        where: { id: deliveryId },
      }),
    );
  }

  private async revokeDeviceById(pushDeviceId: string, revokedAt: Date) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDevice.update({
        data: { active: false, revokedAt },
        where: { id: pushDeviceId },
      }),
    );
  }

  private async cancelPendingDeliveries(userId: string, errorCode: string) {
    const completedAt = new Date();
    await this.prisma.withConnectionRetry(() =>
      this.prisma.pushDelivery.updateMany({
        data: { completedAt, errorCode, status: PushDeliveryStatus.FAILED },
        where: {
          notification: { userId },
          status: PushDeliveryStatus.PENDING,
        },
      }),
    );
  }

  private async ensurePreferences(userId: string) {
    return this.prisma.withConnectionRetry(() =>
      this.prisma.notificationPreference.upsert({
        create: { userId },
        update: {},
        where: { userId },
      }),
    );
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    return (await this.auth.getOrCreateUser(identity)).id;
  }
}

export function assertExpoPushToken(value: string) {
  if (!/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(value)) {
    throw new BadRequestException('expoPushToken must be a valid Expo push token.');
  }
}

function toPushPlatform(platform: 'android' | 'ios') {
  return platform === 'ios' ? PushPlatform.IOS : PushPlatform.ANDROID;
}

function toPreferencesDto(preferences: { pushEnabled: boolean; releasePushEnabled: boolean }) {
  return {
    pushEnabled: preferences.pushEnabled,
    releasePushEnabled: preferences.releasePushEnabled,
  };
}

function buildReleaseUrl(notification: {
  contentType: TrackedContentType | null;
  title: string;
  tmdbId: number | null;
}) {
  if (!notification.contentType || !notification.tmdbId) return 'tvapp://alerts';
  const path = notification.contentType === TrackedContentType.MOVIE ? 'film' : 'series';
  return `tvapp://${path}/${notification.tmdbId}?title=${encodeURIComponent(notification.title)}`;
}

function sanitizePushErrorMessage(value: string | undefined) {
  if (!value) return null;
  return value
    .replace(/(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]/g, '[push-token]')
    .slice(0, 500);
}
