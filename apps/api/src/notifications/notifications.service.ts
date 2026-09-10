import {
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
  NotificationKind,
  ReleaseDatePrecision,
  ReleaseEventStatus,
  ReleaseNotificationType,
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';
import {
  CanonicalReleaseEvent,
  ReleaseEventsService,
} from '../release-events/release-events.service';
import { PushService } from '../push/push.service';

const SCHEDULE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SYNC_BATCH_SIZE = 12;
const MAX_SYNC_SUBSCRIPTIONS = 48;

type ReleaseAlertContentType = 'movie' | 'series';

type NotificationCandidate = {
  contentType: TrackedContentType;
  episodeNumber?: number;
  generatedKey: string;
  releaseEventId: string;
  releasedAt: Date | null;
  seasonNumber?: number;
  tmdbId: number;
  title: string;
  body: string;
  type: ReleaseNotificationType;
};

@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private scheduledSyncPromise: Promise<void> | null = null;
  private scheduleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReleaseEventsService) private readonly releaseEvents: ReleaseEventsService,
    @Inject(PushService) private readonly push: PushService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.getOrThrow<string>('APP_ENV') === 'development') {
      return;
    }

    void this.runScheduledSync();
    this.scheduleTimer = setInterval(() => {
      void this.runScheduledSync();
    }, SCHEDULE_INTERVAL_MS);
    this.scheduleTimer.unref();
  }

  onModuleDestroy() {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  async list(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const notifications = await this.prisma.withConnectionRetry(() =>
      this.prisma.notification.findMany({
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        take: 30,
        where: {
          userId,
        },
      }),
    );

    return {
      items: notifications.map(toNotificationDto),
    };
  }

  async sync(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const alertSubscriptions = await this.listAlertSubscriptions(userId);
    const followedTitles = await this.releaseEvents.expandFollowedTitles(alertSubscriptions);
    let createdCount = 0;

    for (let offset = 0; offset < followedTitles.length; offset += SYNC_BATCH_SIZE) {
      const batch = followedTitles.slice(offset, offset + SYNC_BATCH_SIZE);
      const createdCounts = await Promise.all(
        batch.map((item) =>
          this.syncSubscription(userId, item.contentType, item.tmdbId),
        ),
      );
      createdCount += createdCounts.reduce((total, count) => total + count, 0);
    }

    const list = await this.list(identity);

    return {
      ...list,
      createdCount,
      syncedContentCount: alertSubscriptions.length,
    };
  }

  async listReleaseAlerts(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const alertSubscriptions = await this.listAlertSubscriptions(userId);

    return {
      items: alertSubscriptions.map((subscription) => ({
        contentType: fromTrackedContentType(subscription.contentType),
        tmdbId: subscription.tmdbId,
        updatedAt: subscription.updatedAt.toISOString(),
      })),
    };
  }

  async listReleaseCalendar(identity: AuthenticatedIdentity, now = new Date()) {
    const userId = await this.getUserId(identity);
    const titles = await this.listCalendarTitles(userId);

    if (titles.length === 0) {
      return { items: [] };
    }

    for (let offset = 0; offset < titles.length; offset += SYNC_BATCH_SIZE) {
      const batch = titles.slice(offset, offset + SYNC_BATCH_SIZE);
      await Promise.all(batch.map((title) =>
        this.buildCandidates(title.contentType, title.tmdbId),
      ));
    }

    const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const events = await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEvent.findMany({
        where: {
          AND: [
            {
              OR: titles.map((title) => ({
                contentType: title.contentType,
                tmdbId: title.tmdbId,
              })),
            },
            {
              OR: [
                { releaseDate: { gte: today } },
                { releaseDate: null },
              ],
            },
          ],
          status: ReleaseEventStatus.ACTIVE,
        },
      }),
    );

    return {
      items: events
        .map(toReleaseCalendarDto)
        .sort(compareReleaseCalendarItems),
    };
  }

  async getReleaseAlert(
    identity: AuthenticatedIdentity,
    contentType: ReleaseAlertContentType,
    tmdbId: number,
  ) {
    const userId = await this.getUserId(identity);

    return this.getReleaseAlertForUser(userId, toTrackedContentType(contentType), tmdbId);
  }

  async enableReleaseAlert(
    identity: AuthenticatedIdentity,
    contentType: ReleaseAlertContentType,
    tmdbId: number,
  ) {
    const userId = await this.getUserId(identity);
    const trackedContentType = toTrackedContentType(contentType);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseAlertSubscription.upsert({
      create: {
        contentType: trackedContentType,
        tmdbId,
        userId,
      },
      update: {},
      where: {
        userId_contentType_tmdbId: {
          contentType: trackedContentType,
          tmdbId,
          userId,
        },
      },
      }),
    );

    return this.getReleaseAlertForUser(userId, trackedContentType, tmdbId);
  }

  async disableReleaseAlert(
    identity: AuthenticatedIdentity,
    contentType: ReleaseAlertContentType,
    tmdbId: number,
  ) {
    const userId = await this.getUserId(identity);
    const trackedContentType = toTrackedContentType(contentType);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseAlertSubscription.deleteMany({
      where: {
        contentType: trackedContentType,
        tmdbId,
        userId,
      },
      }),
    );

    return this.getReleaseAlertForUser(userId, trackedContentType, tmdbId);
  }

  async markRead(identity: AuthenticatedIdentity, notificationId: string) {
    const userId = await this.getUserId(identity);
    const notification = await this.prisma.withConnectionRetry(() =>
      this.prisma.notification.updateMany({
      data: {
        readAt: new Date(),
      },
      where: {
        id: notificationId,
        userId,
      },
      }),
    );

    return {
      updated: notification.count > 0,
    };
  }

  async markAllRead(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const notifications = await this.prisma.withConnectionRetry(() =>
      this.prisma.notification.updateMany({
        data: {
          readAt: new Date(),
        },
        where: {
          readAt: null,
          userId,
        },
      }),
    );

    return {
      updatedCount: notifications.count,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async getReleaseAlertForUser(userId: string, contentType: TrackedContentType, tmdbId: number) {
    const [subscription, notifications] = await this.prisma.withConnectionRetry(() =>
      Promise.all([
        this.prisma.releaseAlertSubscription.findUnique({
          where: {
            userId_contentType_tmdbId: {
              contentType,
              tmdbId,
              userId,
            },
          },
        }),
        this.prisma.notification.findMany({
          orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
          take: 10,
          where: {
            contentType,
            tmdbId,
            userId,
          },
        }),
      ]),
    );

    return {
      enabled: Boolean(subscription),
      items: notifications.map(toNotificationDto),
    };
  }

  private async listAlertSubscriptions(userId: string) {
    return this.prisma.withConnectionRetry(() =>
      this.prisma.releaseAlertSubscription.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        contentType: true,
        tmdbId: true,
        updatedAt: true,
      },
      take: MAX_SYNC_SUBSCRIPTIONS,
      where: {
        userId,
      },
      }),
    );
  }

  private async syncSubscription(
    userId: string,
    contentType: TrackedContentType,
    tmdbId: number,
  ) {
    const candidates = await this.buildCandidates(contentType, tmdbId);
    if (candidates === null) {
      return 0;
    }

    await this.pruneInvalidFutureNotifications(userId, contentType, tmdbId);
    return this.createNotifications(userId, candidates);
  }

  private async runScheduledSync() {
    if (this.scheduledSyncPromise) {
      return this.scheduledSyncPromise;
    }

    this.scheduledSyncPromise = this.performScheduledSync().finally(() => {
      this.scheduledSyncPromise = null;
    });

    return this.scheduledSyncPromise;
  }

  private async performScheduledSync() {
    try {
      await this.releaseEvents.syncAllTrackedContent();
      const subscriptions = await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseAlertSubscription.findMany({
          orderBy: [{ contentType: 'asc' }, { tmdbId: 'asc' }, { userId: 'asc' }],
          select: {
            contentType: true,
            tmdbId: true,
            userId: true,
          },
        }),
      );
      const groups = groupSubscriptionsByContent(await this.releaseEvents.expandFollowedTitles(subscriptions));
      let createdCount = 0;
      let failedContentCount = 0;

      for (let offset = 0; offset < groups.length; offset += SYNC_BATCH_SIZE) {
        const batch = groups.slice(offset, offset + SYNC_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((group) => this.syncSubscriberGroup(group)),
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            createdCount += result.value;
          } else {
            failedContentCount += 1;
          }
        });
      }

      this.logger.log(JSON.stringify({
        contentCount: groups.length,
        createdCount,
        event: 'release_notifications.scheduled_sync.completed',
        failedContentCount,
        subscriberCount: subscriptions.length,
      }));
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async syncSubscriberGroup(group: SubscriptionGroup) {
    const candidates = await this.buildCandidates(group.contentType, group.tmdbId);
    if (candidates === null) {
      throw new Error(`Release event sync failed for ${group.contentType}:${group.tmdbId}.`);
    }

    const createdCounts = await Promise.all(group.userIds.map(async (userId) => {
      await this.pruneInvalidFutureNotifications(
        userId,
        group.contentType,
        group.tmdbId,
      );
      return this.createNotifications(userId, candidates);
    }));

    return createdCounts.reduce((total, count) => total + count, 0);
  }

  private async buildCandidates(contentType: TrackedContentType, tmdbId: number) {
    try {
      const result = await this.releaseEvents.syncContent(contentType, tmdbId);
      return buildReleaseReminderCandidates(result.events);
    } catch {
      this.logger.warn(JSON.stringify({
        contentType: contentType.toLowerCase(),
        event: 'release_notifications.sync.failed',
        tmdbId,
      }));
      return null;
    }
  }

  private async pruneInvalidFutureNotifications(
    userId: string,
    contentType: TrackedContentType,
    tmdbId: number,
  ) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.notification.deleteMany({
        where: {
          contentType,
          OR: [
            { dedupeKey: { endsWith: ':announcement' } },
            { dedupeKey: { endsWith: ':release-day' } },
            { releaseType: ReleaseNotificationType.SEASON_RELEASE },
          ],
          kind: NotificationKind.RELEASE,
          readAt: null,
          releasedAt: { gt: new Date() },
          tmdbId,
          userId,
        },
      }),
    );
  }

  private async listCalendarTitles(userId: string) {
    const [alerts, states, watchlistItems, progress] = await Promise.all([
      this.prisma.withConnectionRetry(() => this.prisma.releaseAlertSubscription.findMany({
        where: { userId },
        select: { contentType: true, tmdbId: true },
      })),
      this.prisma.withConnectionRetry(() => this.prisma.userContentState.findMany({
        where: { userId },
        select: { contentType: true, tmdbId: true, status: true },
      })),
      this.prisma.withConnectionRetry(() => this.prisma.personalWatchlistItem.findMany({
        where: { watchlist: { userId } },
        select: { contentType: true, tmdbId: true },
      })),
      this.prisma.withConnectionRetry(() => this.prisma.userEpisodeProgress.findMany({
        where: { userId },
        distinct: ['seriesTmdbId'],
        select: { seriesTmdbId: true },
      })),
    ]);
    const tracked = states.filter((state) =>
      state.status === UserContentStatus.WATCHLISTED ||
      (state.contentType === TrackedContentType.SERIES &&
        (state.status === UserContentStatus.WATCHING || state.status === UserContentStatus.WATCHED)),
    );
    const droppedSeries = new Set(states.filter((state) =>
      state.contentType === TrackedContentType.SERIES && state.status === UserContentStatus.DROPPED,
    ).map((state) => state.tmdbId));
    const watching = progress
      .filter((item) => !droppedSeries.has(item.seriesTmdbId))
      .map((item) => ({ contentType: TrackedContentType.SERIES, tmdbId: item.seriesTmdbId }));
    const followedAlerts = await this.releaseEvents.expandFollowedTitles(alerts);
    return [...new Map([...followedAlerts, ...tracked, ...watchlistItems, ...watching].map((item) =>
      [`${item.contentType}:${item.tmdbId}`, { contentType: item.contentType, tmdbId: item.tmdbId }],
    )).values()];
  }

  private async createNotifications(userId: string, candidates: NotificationCandidate[]) {
    if (candidates.length === 0) return 0;

    const existingNotifications = await this.prisma.withConnectionRetry(() =>
      this.prisma.notification.findMany({
        select: { dedupeKey: true },
        where: {
          dedupeKey: { in: candidates.map((candidate) => candidate.generatedKey) },
          kind: NotificationKind.RELEASE,
          userId,
        },
      }),
    );
    const existingKeys = new Set(existingNotifications.map((notification) => notification.dedupeKey));

    const created = await this.prisma.withConnectionRetry(async () => {
      await Promise.all(candidates.map((candidate) =>
        this.prisma.notification.updateMany({
          data: {
            body: candidate.body,
            contentType: candidate.contentType,
            episodeNumber: candidate.episodeNumber,
            releaseEventId: candidate.releaseEventId,
            releasedAt: candidate.releasedAt,
            releaseType: candidate.type,
            seasonNumber: candidate.seasonNumber,
            title: candidate.title,
            tmdbId: candidate.tmdbId,
          },
          where: {
            dedupeKey: candidate.generatedKey,
            kind: NotificationKind.RELEASE,
            userId,
          },
        }),
      ));

      return this.prisma.notification.createMany({
        data: candidates.map((candidate) => ({
          body: candidate.body,
          contentType: candidate.contentType,
          episodeNumber: candidate.episodeNumber,
          dedupeKey: candidate.generatedKey,
          kind: NotificationKind.RELEASE,
          releaseEventId: candidate.releaseEventId,
          releasedAt: candidate.releasedAt,
          releaseType: candidate.type,
          seasonNumber: candidate.seasonNumber,
          title: candidate.title,
          tmdbId: candidate.tmdbId,
          userId,
        })),
        skipDuplicates: true,
      });
    });

    const newKeys = candidates
      .filter((candidate) => !existingKeys.has(candidate.generatedKey))
      .map((candidate) => candidate.generatedKey);
    if (newKeys.length > 0) {
      const newNotifications = await this.prisma.withConnectionRetry(() =>
        this.prisma.notification.findMany({
          select: {
            body: true,
            contentType: true,
            id: true,
            title: true,
            tmdbId: true,
          },
          where: {
            dedupeKey: { in: newKeys },
            kind: NotificationKind.RELEASE,
            userId,
          },
        }),
      );
      await this.push.enqueueReleaseNotifications(
        userId,
        newNotifications.flatMap((notification) =>
          notification.contentType && notification.tmdbId
            ? [{ ...notification, contentType: notification.contentType, tmdbId: notification.tmdbId }]
            : []
        ),
      );
    }

    return created.count;
  }

}

type SubscriptionGroup = {
  contentType: TrackedContentType;
  tmdbId: number;
  userIds: string[];
};

function groupSubscriptionsByContent(
  subscriptions: Array<{
    contentType: TrackedContentType;
    tmdbId: number;
    userId: string;
  }>,
) {
  const groups = new Map<string, SubscriptionGroup>();

  subscriptions.forEach((subscription) => {
    const key = `${subscription.contentType}:${subscription.tmdbId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.userIds.push(subscription.userId);
      return;
    }

    groups.set(key, {
      contentType: subscription.contentType,
      tmdbId: subscription.tmdbId,
      userIds: [subscription.userId],
    });
  });

  return [...groups.values()];
}

export function buildReleaseReminderCandidates(
  events: CanonicalReleaseEvent[],
  now = new Date(),
): NotificationCandidate[] {
  const reminderDate = new Date(now);
  reminderDate.setUTCDate(reminderDate.getUTCDate() + 7);
  const dateKey = reminderDate.toISOString().slice(0, 10);
  const groups = new Map<string, CanonicalReleaseEvent[]>();

  for (const event of events) {
    if (event.status !== ReleaseEventStatus.ACTIVE ||
        event.precision !== ReleaseDatePrecision.DATE ||
        event.releaseDate?.toISOString().slice(0, 10) !== dateKey ||
        event.type === ReleaseNotificationType.SEASON_RELEASE) continue;
    const key = event.contentType === TrackedContentType.MOVIE
      ? `movie:${event.tmdbId}:one-week`
      : `series:${event.tmdbId}:date:${dateKey}:one-week`;
    const group = groups.get(key) ?? [];
    if (!group.some((item) => item.id === event.id)) group.push(event);
    groups.set(key, group);
  }

  return [...groups].map(([generatedKey, group]) => {
    group.sort((left, right) => (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0) ||
      (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0));
    const event = group[0];
    const title = group.length > 1 ? event.title.replace(/: S\d+E\d+.*$/, '') : event.title;
    return {
      body: event.contentType === TrackedContentType.SERIES
        ? `${title} has ${group.length === 1 ? 'a new episode' : `${group.length} new episodes`} releasing in one week on ${dateKey}.`
        : `${event.title} releases in one week on ${dateKey}.`,
      contentType: event.contentType,
      episodeNumber: group.length === 1 ? event.episodeNumber ?? undefined : undefined,
      generatedKey,
      releaseEventId: event.id,
      releasedAt: event.releaseDate,
      seasonNumber: group.every((item) => item.seasonNumber === event.seasonNumber)
        ? event.seasonNumber ?? undefined : undefined,
      title,
      tmdbId: event.tmdbId,
      type: event.type,
    };
  });
}

function fromTrackedContentType(contentType: TrackedContentType | null) {
  if (contentType === null) {
    return null;
  }

  return contentType === TrackedContentType.MOVIE ? 'movie' : 'series';
}

function fromNotificationType(type: ReleaseNotificationType) {
  if (type === ReleaseNotificationType.MOVIE_RELEASE) {
    return 'movie_release';
  }

  if (type === ReleaseNotificationType.SEASON_RELEASE) {
    return 'season_release';
  }

  return 'episode_release';
}

function toReleaseCalendarDto(event: {
  contentType: TrackedContentType;
  episodeNumber: number | null;
  id: string;
  precision: ReleaseDatePrecision;
  releaseDate: Date | null;
  seasonNumber: number | null;
  title: string;
  tmdbId: number;
  type: ReleaseNotificationType;
}) {
  return {
    contentType: fromTrackedContentType(event.contentType),
    episodeNumber: event.episodeNumber,
    id: event.id,
    precision: event.precision === ReleaseDatePrecision.DATE ? 'date' as const : 'unknown' as const,
    releaseDate: event.releaseDate?.toISOString().slice(0, 10) ?? null,
    seasonNumber: event.seasonNumber,
    title: event.title,
    tmdbId: event.tmdbId,
    type: fromNotificationType(event.type),
  };
}

function compareReleaseCalendarItems(
  left: ReturnType<typeof toReleaseCalendarDto>,
  right: ReturnType<typeof toReleaseCalendarDto>,
) {
  if (left.releaseDate === null) return right.releaseDate === null ? left.title.localeCompare(right.title) : 1;
  if (right.releaseDate === null) return -1;
  return left.releaseDate.localeCompare(right.releaseDate)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id);
}

function fromNotificationKind(kind: NotificationKind) {
  if (kind === NotificationKind.RELEASE) {
    return 'release';
  }

  return kind === NotificationKind.SHARED_LIST_INVITE
    ? 'shared_list_invite'
    : 'shared_vote_update';
}

function toTrackedContentType(contentType: ReleaseAlertContentType) {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function toNotificationDto(notification: {
  actorUserId: string | null;
  body: string;
  contentType: TrackedContentType | null;
  createdAt: Date;
  episodeNumber: number | null;
  id: string;
  kind: NotificationKind;
  readAt: Date | null;
  releasedAt: Date | null;
  releaseType: ReleaseNotificationType | null;
  routeMetadata: unknown;
  seasonNumber: number | null;
  sharedWatchlistId: string | null;
  title: string;
  tmdbId: number | null;
  votingSessionId: string | null;
}) {
  const kind = fromNotificationKind(notification.kind);

  return {
    actorUserId: notification.actorUserId,
    body: notification.body,
    contentType: fromTrackedContentType(notification.contentType),
    createdAt: notification.createdAt.toISOString(),
    episodeNumber: notification.episodeNumber,
    id: notification.id,
    kind,
    readAt: notification.readAt?.toISOString() ?? null,
    releasedAt: notification.releasedAt?.toISOString() ?? null,
    routeMetadata: notification.routeMetadata,
    seasonNumber: notification.seasonNumber,
    sharedWatchlistId: notification.sharedWatchlistId,
    title: notification.title,
    tmdbId: notification.tmdbId,
    type: notification.releaseType ? fromNotificationType(notification.releaseType) : kind,
    votingSessionId: notification.votingSessionId,
  };
}
