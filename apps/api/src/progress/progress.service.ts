import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getEpisodeProgress(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);
    const progress = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeProgress.findUnique({
      where: {
        userId_seriesTmdbId_seasonNumber_episodeNumber: {
          episodeNumber,
          seasonNumber,
          seriesTmdbId,
          userId,
        },
      },
      }),
    );

    return progress ? toApiEpisodeProgress(progress) : null;
  }

  async listSeasonProgress(identity: AuthenticatedIdentity, seriesTmdbId: number, seasonNumber: number) {
    const userId = await this.getUserId(identity);
    const progress = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeProgress.findMany({
      orderBy: {
        episodeNumber: 'asc',
      },
      where: {
        seasonNumber,
        seriesTmdbId,
        userId,
      },
      }),
    );

    return {
      episodes: progress.map(toApiEpisodeProgress),
      seasonNumber,
      seriesTmdbId,
      watchedEpisodeCount: progress.length,
    };
  }

  async listSeriesProgress(identity: AuthenticatedIdentity, seriesTmdbId: number) {
    const userId = await this.getUserId(identity);
    const progress = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeProgress.findMany({
      orderBy: [
        {
          seasonNumber: 'asc',
        },
        {
          episodeNumber: 'asc',
        },
      ],
      where: {
        seriesTmdbId,
        userId,
      },
      }),
    );

    return {
      episodes: progress.map(toApiEpisodeProgress),
      seriesTmdbId,
      watchedEpisodeCount: progress.length,
    };
  }

  async listSeriesProgressSummaries(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const progress = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userEpisodeProgress.findMany({
          orderBy: [
            {
              seriesTmdbId: 'asc',
            },
            {
              seasonNumber: 'asc',
            },
            {
              episodeNumber: 'asc',
            },
          ],
          where: {
            userId,
          },
        }),
    );
    const bySeries = new Map<number, SeriesProgressSummaryAccumulator>();

    progress.forEach((episode) => {
      const existing = bySeries.get(episode.seriesTmdbId);

      if (!existing) {
        bySeries.set(episode.seriesTmdbId, {
          latestEpisodeNumber: episode.episodeNumber,
          latestSeasonNumber: episode.seasonNumber,
          seriesTmdbId: episode.seriesTmdbId,
          updatedAt: episode.updatedAt,
          watchedEpisodeCount: 1,
        });
        return;
      }

      existing.watchedEpisodeCount += 1;

      if (
        episode.seasonNumber > existing.latestSeasonNumber ||
        (episode.seasonNumber === existing.latestSeasonNumber &&
          episode.episodeNumber > existing.latestEpisodeNumber)
      ) {
        existing.latestEpisodeNumber = episode.episodeNumber;
        existing.latestSeasonNumber = episode.seasonNumber;
      }

      if (episode.updatedAt > existing.updatedAt) {
        existing.updatedAt = episode.updatedAt;
      }
    });

    return {
      items: Array.from(bySeries.values())
        .map(toApiSeriesProgressSummary)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };
  }

  async markEpisodeWatched(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);
    const watchedAt = new Date();
    const episodeNumbers = Array.from({ length: episodeNumber }, (_, index) => index + 1);
    const progress = await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
      for (const currentEpisodeNumber of episodeNumbers) {
        await transaction.userEpisodeProgress.upsert({
          create: {
            episodeNumber: currentEpisodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
            watchedAt,
          },
          update: {
            watchedAt,
          },
          where: {
            userId_seriesTmdbId_seasonNumber_episodeNumber: {
              episodeNumber: currentEpisodeNumber,
              seasonNumber,
              seriesTmdbId,
              userId,
            },
          },
        });
      }

      return transaction.userEpisodeProgress.findUniqueOrThrow({
        where: {
          userId_seriesTmdbId_seasonNumber_episodeNumber: {
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
        },
      });
      }),
    );

    return toApiEpisodeProgress(progress);
  }

  async clearEpisodeProgress(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeProgress.deleteMany({
      where: {
        episodeNumber,
        seasonNumber,
        seriesTmdbId,
        userId,
      },
      }),
    );
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

type UserEpisodeProgressRecord = {
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
  watchedAt: Date;
};

type SeriesProgressSummaryAccumulator = {
  latestEpisodeNumber: number;
  latestSeasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
  watchedEpisodeCount: number;
};

function toApiEpisodeProgress(progress: UserEpisodeProgressRecord) {
  return {
    episodeNumber: progress.episodeNumber,
    id: progress.id,
    seasonNumber: progress.seasonNumber,
    seriesTmdbId: progress.seriesTmdbId,
    updatedAt: progress.updatedAt.toISOString(),
    watchedAt: progress.watchedAt.toISOString(),
  };
}

function toApiSeriesProgressSummary(summary: SeriesProgressSummaryAccumulator) {
  return {
    latestEpisodeNumber: summary.latestEpisodeNumber,
    latestSeasonNumber: summary.latestSeasonNumber,
    seriesTmdbId: summary.seriesTmdbId,
    updatedAt: summary.updatedAt.toISOString(),
    watchedEpisodeCount: summary.watchedEpisodeCount,
  };
}
