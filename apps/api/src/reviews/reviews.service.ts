import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getMovieReview(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);
    const review = await this.prisma.userMovieReview.findUnique({
      where: {
        userId_tmdbId: {
          tmdbId,
          userId,
        },
      },
    });

    return review ? toApiMovieReview(review) : null;
  }

  async upsertMovieReview(identity: AuthenticatedIdentity, tmdbId: number, body: string) {
    const userId = await this.getUserId(identity);
    const reviewBody = normalizeBody(body);
    const review = await this.prisma.userMovieReview.upsert({
      create: {
        body: reviewBody,
        tmdbId,
        userId,
      },
      update: {
        body: reviewBody,
      },
      where: {
        userId_tmdbId: {
          tmdbId,
          userId,
        },
      },
    });

    return toApiMovieReview(review);
  }

  async deleteMovieReview(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.prisma.userMovieReview.deleteMany({
      where: {
        tmdbId,
        userId,
      },
    });
  }

  async getEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);
    const review = await this.prisma.userEpisodeReview.findUnique({
      where: {
        userId_seriesTmdbId_seasonNumber_episodeNumber: {
          episodeNumber,
          seasonNumber,
          seriesTmdbId,
          userId,
        },
      },
    });

    return review ? toApiEpisodeReview(review) : null;
  }

  async upsertEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    body: string,
  ) {
    const userId = await this.getUserId(identity);
    const reviewBody = normalizeBody(body);
    const review = await this.prisma.userEpisodeReview.upsert({
      create: {
        body: reviewBody,
        episodeNumber,
        seasonNumber,
        seriesTmdbId,
        userId,
      },
      update: {
        body: reviewBody,
      },
      where: {
        userId_seriesTmdbId_seasonNumber_episodeNumber: {
          episodeNumber,
          seasonNumber,
          seriesTmdbId,
          userId,
        },
      },
    });

    return toApiEpisodeReview(review);
  }

  async deleteEpisodeReview(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);

    await this.prisma.userEpisodeReview.deleteMany({
      where: {
        episodeNumber,
        seasonNumber,
        seriesTmdbId,
        userId,
      },
    });
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

type UserMovieReviewRecord = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: Date;
};

type UserEpisodeReviewRecord = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: Date;
};

function normalizeBody(body: string) {
  const normalized = body.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('Review body cannot be empty.');
  }

  if (normalized.length > 5000) {
    throw new BadRequestException('Review body must be 5000 characters or fewer.');
  }

  return normalized;
}

function toApiMovieReview(review: UserMovieReviewRecord) {
  return {
    body: review.body,
    id: review.id,
    tmdbId: review.tmdbId,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toApiEpisodeReview(review: UserEpisodeReviewRecord) {
  return {
    body: review.body,
    episodeNumber: review.episodeNumber,
    id: review.id,
    seasonNumber: review.seasonNumber,
    seriesTmdbId: review.seriesTmdbId,
    updatedAt: review.updatedAt.toISOString(),
  };
}
