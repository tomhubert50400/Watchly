import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RatingsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listMovieRatings(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const ratings = await this.prisma.withConnectionRetry(
      () =>
        this.prisma.userMovieRating.findMany({
          orderBy: {
            updatedAt: 'desc',
          },
          where: {
            userId,
          },
        }),
    );

    return ratings.map(toApiMovieRating);
  }

  async getMovieRating(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.findUnique({
      where: {
        userId_tmdbId: {
          tmdbId,
          userId,
        },
      },
      }),
    );

    return rating ? toApiMovieRating(rating) : null;
  }

  async upsertMovieRating(identity: AuthenticatedIdentity, tmdbId: number, score: number) {
    const userId = await this.getUserId(identity);
    const scoreHalfSteps = toScoreHalfSteps(score);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.upsert({
      create: {
        scoreHalfSteps,
        tmdbId,
        userId,
      },
      update: {
        scoreHalfSteps,
      },
      where: {
        userId_tmdbId: {
          tmdbId,
          userId,
        },
      },
      }),
    );

    return toApiMovieRating(rating);
  }

  async deleteMovieRating(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction([
        this.prisma.userMovieReview.deleteMany({
          where: {
            tmdbId,
            userId,
          },
        }),
        this.prisma.userMovieRating.deleteMany({
          where: {
            tmdbId,
            userId,
          },
        }),
      ]),
    );
  }

  async getEpisodeRating(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeRating.findUnique({
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

    return rating ? toApiEpisodeRating(rating) : null;
  }

  async upsertEpisodeRating(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    score: number,
  ) {
    const userId = await this.getUserId(identity);
    const scoreHalfSteps = toScoreHalfSteps(score);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeRating.upsert({
      create: {
        episodeNumber,
        scoreHalfSteps,
        seasonNumber,
        seriesTmdbId,
        userId,
      },
      update: {
        scoreHalfSteps,
      },
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

    return toApiEpisodeRating(rating);
  }

  async deleteEpisodeRating(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction([
        this.prisma.userEpisodeReview.deleteMany({
          where: {
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
        }),
        this.prisma.userEpisodeRating.deleteMany({
          where: {
            episodeNumber,
            seasonNumber,
            seriesTmdbId,
            userId,
          },
        }),
      ]),
    );
  }

  async getSeriesRating(identity: AuthenticatedIdentity, seriesTmdbId: number) {
    const userId = await this.getUserId(identity);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userSeriesRating.findUnique({
        where: {
          userId_seriesTmdbId: {
            seriesTmdbId,
            userId,
          },
        },
      }),
    );

    return rating ? toApiSeriesRating(rating) : null;
  }

  async upsertSeriesRating(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    score: number,
  ) {
    const userId = await this.getUserId(identity);
    const scoreHalfSteps = toScoreHalfSteps(score);
    const rating = await this.prisma.withConnectionRetry(() =>
      this.prisma.userSeriesRating.upsert({
        create: {
          scoreHalfSteps,
          seriesTmdbId,
          userId,
        },
        update: {
          scoreHalfSteps,
        },
        where: {
          userId_seriesTmdbId: {
            seriesTmdbId,
            userId,
          },
        },
      }),
    );

    return toApiSeriesRating(rating);
  }

  async deleteSeriesRating(identity: AuthenticatedIdentity, seriesTmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userSeriesRating.deleteMany({
        where: {
          seriesTmdbId,
          userId,
        },
      }),
    );
  }

  async getSeriesRatingSummary(identity: AuthenticatedIdentity, seriesTmdbId: number) {
    const userId = await this.getUserId(identity);
    const ratings = await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeRating.findMany({
      orderBy: {
        seasonNumber: 'asc',
      },
      select: {
        scoreHalfSteps: true,
        seasonNumber: true,
      },
      where: {
        seriesTmdbId,
        userId,
      },
      }),
    );
    const seasonTotals = new Map<number, { count: number; totalHalfSteps: number }>();
    let totalHalfSteps = 0;

    ratings.forEach((rating) => {
      totalHalfSteps += rating.scoreHalfSteps;
      const seasonTotal = seasonTotals.get(rating.seasonNumber) ?? { count: 0, totalHalfSteps: 0 };

      seasonTotals.set(rating.seasonNumber, {
        count: seasonTotal.count + 1,
        totalHalfSteps: seasonTotal.totalHalfSteps + rating.scoreHalfSteps,
      });
    });

    return {
      averageScore: toAverageScore(totalHalfSteps, ratings.length),
      ratedEpisodeCount: ratings.length,
      seasons: Array.from(seasonTotals.entries()).map(([seasonNumber, total]) => ({
        averageScore: toAverageScore(total.totalHalfSteps, total.count),
        ratedEpisodeCount: total.count,
        seasonNumber,
      })),
      seriesTmdbId,
    };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

type UserMovieRatingRecord = {
  id: string;
  scoreHalfSteps: number;
  tmdbId: number;
  updatedAt: Date;
};

type UserEpisodeRatingRecord = {
  episodeNumber: number;
  id: string;
  scoreHalfSteps: number;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

type UserSeriesRatingRecord = {
  id: string;
  scoreHalfSteps: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

function toApiMovieRating(rating: UserMovieRatingRecord) {
  return {
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    tmdbId: rating.tmdbId,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toApiEpisodeRating(rating: UserEpisodeRatingRecord) {
  return {
    episodeNumber: rating.episodeNumber,
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    seasonNumber: rating.seasonNumber,
    seriesTmdbId: rating.seriesTmdbId,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toApiSeriesRating(rating: UserSeriesRatingRecord) {
  return {
    id: rating.id,
    score: rating.scoreHalfSteps / 2,
    seriesTmdbId: rating.seriesTmdbId,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function toScoreHalfSteps(score: number) {
  const halfSteps = score * 2;

  if (!Number.isInteger(halfSteps) || halfSteps < 1 || halfSteps > 10) {
    throw new BadRequestException('score must be between 0.5 and 5 in 0.5 increments.');
  }

  return halfSteps;
}

function toAverageScore(totalHalfSteps: number, count: number) {
  if (count === 0) {
    return null;
  }

  return Math.round((totalHalfSteps / count / 2) * 10) / 10;
}
