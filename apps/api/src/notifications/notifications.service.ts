import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { SeriesDetails, TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { ReleaseNotificationType, TrackedContentType } from '../generated/prisma/enums';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SYNC_ITEMS = 12;

type ReleaseAlertContentType = 'movie' | 'series';

type NotificationCandidate = {
  contentType: TrackedContentType;
  episodeNumber?: number;
  generatedKey: string;
  releasedAt: Date | null;
  seasonNumber?: number;
  tmdbId: number;
  title: string;
  body: string;
  type: ReleaseNotificationType;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async list(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const notifications = await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseNotification.findMany({
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
    const candidates: NotificationCandidate[] = [];

    for (const item of alertSubscriptions.slice(0, MAX_SYNC_ITEMS)) {
      candidates.push(...(await this.buildCandidates(item.contentType, item.tmdbId)));
    }

    const createdCount = await this.createNotifications(userId, candidates);

    const list = await this.list(identity);

    return {
      ...list,
      createdCount,
      syncedContentCount: alertSubscriptions.length,
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

    await this.createNotifications(userId, await this.buildCandidates(trackedContentType, tmdbId));

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
      this.prisma.releaseNotification.updateMany({
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
        this.prisma.releaseNotification.findMany({
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
      },
      where: {
        userId,
      },
      }),
    );
  }

  private async buildCandidates(contentType: TrackedContentType, tmdbId: number) {
    if (contentType === TrackedContentType.MOVIE) {
      return this.buildMovieCandidates(tmdbId);
    }

    return this.buildSeriesCandidates(tmdbId);
  }

  private async createNotifications(userId: string, candidates: NotificationCandidate[]) {
    let createdCount = 0;

    for (const candidate of candidates) {
      const existing = await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseNotification.findUnique({
        where: {
          userId_generatedKey: {
            generatedKey: candidate.generatedKey,
            userId,
          },
        },
        }),
      );

      if (existing) {
        continue;
      }

      await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseNotification.create({
        data: {
          body: candidate.body,
          contentType: candidate.contentType,
          episodeNumber: candidate.episodeNumber,
          generatedKey: candidate.generatedKey,
          releasedAt: candidate.releasedAt,
          seasonNumber: candidate.seasonNumber,
          title: candidate.title,
          tmdbId: candidate.tmdbId,
          type: candidate.type,
          userId,
        },
        }),
      );
      createdCount += 1;
    }

    return createdCount;
  }

  private async buildMovieCandidates(tmdbId: number): Promise<NotificationCandidate[]> {
    try {
      const response = await this.catalogue.getMovie(tmdbId);
      const movie = response.item;
      const releaseDate = parseReleaseDate(movie.releaseDate);

      if (!releaseDate) {
        return [];
      }

      return buildMilestoneCandidates({
        contentType: TrackedContentType.MOVIE,
        label: 'film',
        releaseDate,
        title: movie.title,
        tmdbId: movie.tmdbId,
        type: ReleaseNotificationType.MOVIE_RELEASE,
      });
    } catch {
      return [];
    }
  }

  private async buildSeriesCandidates(tmdbId: number): Promise<NotificationCandidate[]> {
    try {
      const response = await this.catalogue.getSeries(tmdbId);
      const series = response.item;
      const seasonCandidates = series.seasons.flatMap((season) =>
        this.buildSeasonCandidate(series, season),
      );

      return seasonCandidates;
    } catch {
      return [];
    }
  }

  private buildSeasonCandidate(
    series: SeriesDetails,
    season: SeriesDetails['seasons'][number],
  ): NotificationCandidate[] {
    const releaseDate = parseReleaseDate(season.airDate);

    if (season.seasonNumber <= 0 || !releaseDate) {
      return [];
    }

    return buildMilestoneCandidates({
      contentType: TrackedContentType.SERIES,
      label: 'season',
      releaseDate,
      seasonNumber: season.seasonNumber,
      title: `${series.title}: ${season.name}`,
      tmdbId: series.tmdbId,
      type: ReleaseNotificationType.SEASON_RELEASE,
    });
  }
}

function parseReleaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildMilestoneCandidates({
  contentType,
  label,
  releaseDate,
  seasonNumber,
  title,
  tmdbId,
  type,
}: {
  contentType: TrackedContentType;
  label: 'film' | 'season';
  releaseDate: Date;
  seasonNumber?: number;
  title: string;
  tmdbId: number;
  type: ReleaseNotificationType;
}): NotificationCandidate[] {
  const milestones: Array<'announcement' | 'one-week' | 'release-day'> = [];

  if (isFutureDate(releaseDate)) {
    milestones.push('announcement');
  }

  if (isWithinOneWeekBeforeRelease(releaseDate)) {
    milestones.push('one-week');
  }

  if (isSameUtcDate(releaseDate, new Date())) {
    milestones.push('release-day');
  }

  return milestones.map((milestone) => ({
    body: buildReleaseBody(title, releaseDate, label, milestone),
    contentType,
    generatedKey: buildGeneratedKey(contentType, tmdbId, seasonNumber, releaseDate, milestone),
    releasedAt: releaseDate,
    seasonNumber,
    title,
    tmdbId,
    type,
  }));
}

function isFutureDate(date: Date) {
  return date.getTime() > new Date().getTime();
}

function isWithinOneWeekBeforeRelease(date: Date) {
  const diff = date.getTime() - new Date().getTime();

  return diff > 0 && diff <= 7 * DAY_MS;
}

function isSameUtcDate(left: Date, right: Date) {
  return toDateKey(left) === toDateKey(right);
}

function buildReleaseBody(
  title: string,
  releaseDate: Date,
  label: 'film' | 'season',
  milestone: 'announcement' | 'one-week' | 'release-day',
) {
  const dateLabel = releaseDate.toISOString().slice(0, 10);

  if (milestone === 'announcement') {
    return `${title} has a new ${label} release announced for ${dateLabel}.`;
  }

  if (milestone === 'one-week') {
    return `${title} releases in one week on ${dateLabel}.`;
  }

  return `${title} releases today.`;
}

function buildGeneratedKey(
  contentType: TrackedContentType,
  tmdbId: number,
  seasonNumber: number | undefined,
  releaseDate: Date,
  milestone: 'announcement' | 'one-week' | 'release-day',
) {
  const contentKey =
    contentType === TrackedContentType.MOVIE
      ? `movie:${tmdbId}`
      : `series:${tmdbId}:season:${seasonNumber}`;

  return `${contentKey}:${milestone}:${toDateKey(releaseDate)}`;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromTrackedContentType(contentType: TrackedContentType) {
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

function toTrackedContentType(contentType: ReleaseAlertContentType) {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function toNotificationDto(notification: {
  body: string;
  contentType: TrackedContentType;
  createdAt: Date;
  episodeNumber: number | null;
  id: string;
  readAt: Date | null;
  releasedAt: Date | null;
  seasonNumber: number | null;
  title: string;
  tmdbId: number;
  type: ReleaseNotificationType;
}) {
  return {
    body: notification.body,
    contentType: fromTrackedContentType(notification.contentType),
    createdAt: notification.createdAt.toISOString(),
    episodeNumber: notification.episodeNumber,
    id: notification.id,
    readAt: notification.readAt?.toISOString() ?? null,
    releasedAt: notification.releasedAt?.toISOString() ?? null,
    seasonNumber: notification.seasonNumber,
    title: notification.title,
    tmdbId: notification.tmdbId,
    type: fromNotificationType(notification.type),
  };
}
