import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { SeriesDetails, TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { withPrismaConnectionRetry } from '../database/prisma-retry';
import { PrismaService } from '../database/prisma.service';
import { ReleaseNotificationType, TrackedContentType } from '../generated/prisma/enums';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_RELEASE_WINDOW_DAYS = 14;
const UPCOMING_RELEASE_WINDOW_DAYS = 30;
const MAX_SYNC_ITEMS = 12;

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
    const notifications = await withPrismaConnectionRetry(() =>
      this.prisma.releaseNotification.findMany({
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        take: 30,
        where: {
          userId,
        },
      }),
    );

    return {
      items: notifications.map((notification) => ({
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
      })),
    };
  }

  async sync(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const followedContent = await this.listFollowedContent(userId);
    const candidates: NotificationCandidate[] = [];

    for (const item of followedContent.slice(0, MAX_SYNC_ITEMS)) {
      if (item.contentType === TrackedContentType.MOVIE) {
        const movieCandidates = await this.buildMovieCandidates(item.tmdbId);

        candidates.push(...movieCandidates);
      } else {
        const seriesCandidates = await this.buildSeriesCandidates(item.tmdbId);

        candidates.push(...seriesCandidates);
      }
    }

    let createdCount = 0;

    for (const candidate of candidates) {
      const existing = await this.prisma.releaseNotification.findUnique({
        where: {
          userId_generatedKey: {
            generatedKey: candidate.generatedKey,
            userId,
          },
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.releaseNotification.create({
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
      });
      createdCount += 1;
    }

    const list = await this.list(identity);

    return {
      ...list,
      createdCount,
      syncedContentCount: followedContent.length,
    };
  }

  async markRead(identity: AuthenticatedIdentity, notificationId: string) {
    const userId = await this.getUserId(identity);
    const notification = await this.prisma.releaseNotification.updateMany({
      data: {
        readAt: new Date(),
      },
      where: {
        id: notificationId,
        userId,
      },
    });

    return {
      updated: notification.count > 0,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async listFollowedContent(userId: string) {
    const [states, watchlistItems] = await Promise.all([
      this.prisma.userContentState.findMany({
        select: {
          contentType: true,
          tmdbId: true,
          updatedAt: true,
        },
        where: {
          userId,
        },
      }),
      this.prisma.personalWatchlistItem.findMany({
        select: {
          contentType: true,
          createdAt: true,
          tmdbId: true,
        },
        where: {
          watchlist: {
            userId,
          },
        },
      }),
    ]);
    const byKey = new Map<string, { contentType: TrackedContentType; tmdbId: number; updatedAt: Date }>();

    states.forEach((state) => {
      byKey.set(`${state.contentType}:${state.tmdbId}`, {
        contentType: state.contentType,
        tmdbId: state.tmdbId,
        updatedAt: state.updatedAt,
      });
    });

    watchlistItems.forEach((item) => {
      const key = `${item.contentType}:${item.tmdbId}`;
      const existing = byKey.get(key);

      if (!existing || item.createdAt > existing.updatedAt) {
        byKey.set(key, {
          contentType: item.contentType,
          tmdbId: item.tmdbId,
          updatedAt: item.createdAt,
        });
      }
    });

    return Array.from(byKey.values()).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  private async buildMovieCandidates(tmdbId: number): Promise<NotificationCandidate[]> {
    try {
      const response = await this.catalogue.getMovie(tmdbId);
      const movie = response.item;
      const releaseDate = parseReleaseDate(movie.releaseDate);

      if (!releaseDate || !isInReleaseWindow(releaseDate)) {
        return [];
      }

      return [
        {
          body: buildReleaseBody(movie.title, releaseDate, 'film'),
          contentType: TrackedContentType.MOVIE,
          generatedKey: `movie:${movie.tmdbId}:release:${toDateKey(releaseDate)}`,
          releasedAt: releaseDate,
          title: movie.title,
          tmdbId: movie.tmdbId,
          type: ReleaseNotificationType.MOVIE_RELEASE,
        },
      ];
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
      const recentSeasons = series.seasons
        .filter((season) => season.seasonNumber > 0)
        .filter((season) => {
          const airDate = parseReleaseDate(season.airDate);

          return Boolean(airDate && isNearEpisodeWindow(airDate));
        })
        .sort((left, right) => right.seasonNumber - left.seasonNumber)
        .slice(0, 2);
      const episodeCandidateGroups = await Promise.all(
        recentSeasons.map((season) => this.buildEpisodeCandidates(series, season.seasonNumber)),
      );

      return [...seasonCandidates, ...episodeCandidateGroups.flat()];
    } catch {
      return [];
    }
  }

  private buildSeasonCandidate(
    series: SeriesDetails,
    season: SeriesDetails['seasons'][number],
  ): NotificationCandidate[] {
    const releaseDate = parseReleaseDate(season.airDate);

    if (season.seasonNumber <= 0 || !releaseDate || !isInReleaseWindow(releaseDate)) {
      return [];
    }

    return [
      {
        body: buildReleaseBody(`${series.title} ${season.name}`, releaseDate, 'season'),
        contentType: TrackedContentType.SERIES,
        generatedKey: `series:${series.tmdbId}:season:${season.seasonNumber}:release:${toDateKey(releaseDate)}`,
        releasedAt: releaseDate,
        seasonNumber: season.seasonNumber,
        title: `${series.title}: ${season.name}`,
        tmdbId: series.tmdbId,
        type: ReleaseNotificationType.SEASON_RELEASE,
      },
    ];
  }

  private async buildEpisodeCandidates(series: SeriesDetails, seasonNumber: number) {
    try {
      const response = await this.catalogue.getSeason(series.tmdbId, seasonNumber);

      return response.item.episodes.flatMap((episode) => {
        const releaseDate = parseReleaseDate(episode.airDate);

        if (!releaseDate || !isInReleaseWindow(releaseDate)) {
          return [];
        }

        return [
          {
            body: buildReleaseBody(
              `${series.title} S${episode.seasonNumber} E${episode.episodeNumber}`,
              releaseDate,
              'episode',
            ),
            contentType: TrackedContentType.SERIES,
            episodeNumber: episode.episodeNumber,
            generatedKey:
              `series:${series.tmdbId}:season:${episode.seasonNumber}:episode:${episode.episodeNumber}:release:${toDateKey(releaseDate)}`,
            releasedAt: releaseDate,
            seasonNumber: episode.seasonNumber,
            title: `${series.title}: ${episode.title}`,
            tmdbId: series.tmdbId,
            type: ReleaseNotificationType.EPISODE_RELEASE,
          },
        ];
      });
    } catch {
      return [];
    }
  }
}

function parseReleaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isInReleaseWindow(date: Date) {
  const now = new Date();
  const lowerBound = new Date(now.getTime() - PAST_RELEASE_WINDOW_DAYS * DAY_MS);
  const upperBound = new Date(now.getTime() + UPCOMING_RELEASE_WINDOW_DAYS * DAY_MS);

  return date >= lowerBound && date <= upperBound;
}

function isNearEpisodeWindow(date: Date) {
  const now = new Date();
  const lowerBound = new Date(now.getTime() - 120 * DAY_MS);
  const upperBound = new Date(now.getTime() + UPCOMING_RELEASE_WINDOW_DAYS * DAY_MS);

  return date >= lowerBound && date <= upperBound;
}

function buildReleaseBody(title: string, releaseDate: Date, label: string) {
  const dateLabel = releaseDate.toISOString().slice(0, 10);
  const now = new Date();

  if (releaseDate > now) {
    return `${title} has a ${label} release planned for ${dateLabel}.`;
  }

  return `${title} has a ${label} release dated ${dateLabel}.`;
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
