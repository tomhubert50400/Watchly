import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { buildViewingStats } from './viewing-stats';

@Injectable()
export class ViewingsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
  ) {}

  async getStats(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getStatsForUser(userId);
  }

  async getStatsForUser(userId: string) {

    await this.enrichMissingMetadata(userId);

    const [events, movieRatings, episodeRatings] = await this.prisma.withConnectionRetry(() =>
      Promise.all([
        this.prisma.viewingEvent.findMany({
          orderBy: [{ watchedAt: 'desc' }, { createdAt: 'desc' }],
          where: { userId },
        }),
        this.prisma.userMovieRating.findMany({
          select: { scoreHalfSteps: true },
          where: { userId },
        }),
        this.prisma.userEpisodeRating.findMany({
          select: { scoreHalfSteps: true },
          where: { userId },
        }),
      ]),
    );

    return buildViewingStats(events, [...movieRatings, ...episodeRatings]);
  }

  async getMovieSummary(identity: AuthenticatedIdentity, tmdbId: number) {
    return this.getMovieSummaryForUser(await this.getUserId(identity), tmdbId);
  }

  async logMovieViewing(identity: AuthenticatedIdentity, tmdbId: number) {
    const userId = await this.getUserId(identity);

    await this.createMovieViewing(userId, tmdbId, new Date());

    return this.getMovieSummaryForUser(userId, tmdbId);
  }

  async getEpisodeSummary(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    return this.getEpisodeSummaryForUser(
      await this.getUserId(identity),
      seriesTmdbId,
      seasonNumber,
      episodeNumber,
    );
  }

  async logEpisodeViewing(
    identity: AuthenticatedIdentity,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const userId = await this.getUserId(identity);

    await this.createEpisodeViewing(userId, seriesTmdbId, seasonNumber, episodeNumber, new Date());

    return this.getEpisodeSummaryForUser(userId, seriesTmdbId, seasonNumber, episodeNumber);
  }

  async getSeriesSummary(identity: AuthenticatedIdentity, seriesTmdbId: number) {
    const userId = await this.getUserId(identity);
    const events = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        select: { episodeNumber: true, seasonNumber: true },
        where: {
          contentType: 'EPISODE',
          tmdbId: seriesTmdbId,
          userId,
        },
      }),
    );
    const uniqueEpisodes = new Set(
      events.map((event) => `${event.seasonNumber}:${event.episodeNumber}`),
    );

    return {
      rewatchCount: Math.max(0, events.length - uniqueEpisodes.size),
      seriesTmdbId,
      totalViewCount: events.length,
      watchedEpisodeCount: uniqueEpisodes.size,
    };
  }

  async ensureInitialMovieViewing(userId: string, tmdbId: number) {
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findFirst({
        select: { id: true },
        where: { contentType: 'MOVIE', tmdbId, userId },
      }),
    );

    if (!existing) {
      await this.createMovieViewing(userId, tmdbId, new Date());
    }
  }

  async ensureInitialEpisodeViewings(
    userId: string,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumbers: number[],
    watchedAt: Date,
  ) {
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        select: { episodeNumber: true },
        where: {
          contentType: 'EPISODE',
          episodeNumber: { in: episodeNumbers },
          seasonNumber,
          tmdbId: seriesTmdbId,
          userId,
        },
      }),
    );
    const existingNumbers = new Set(existing.map((event) => event.episodeNumber));
    const missingNumbers = episodeNumbers.filter((episodeNumber) => !existingNumbers.has(episodeNumber));

    if (missingNumbers.length === 0) {
      return;
    }

    const metadata = await this.getSeasonMetadata(seriesTmdbId, seasonNumber);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.createMany({
        data: missingNumbers.map((episodeNumber) => {
          const episode = metadata?.episodes.find((item) => item.episodeNumber === episodeNumber);

          return {
            artworkUrl: metadata?.artworkUrl ?? episode?.stillUrl ?? null,
            contentType: 'EPISODE',
            episodeNumber,
            genres: metadata?.genres ?? [],
            runtimeMinutes: episode?.runtimeMinutes ?? null,
            seasonNumber,
            subtitle: episode?.title ?? null,
            title: metadata?.title ?? null,
            tmdbId: seriesTmdbId,
            userId,
            watchedAt,
          };
        }),
      }),
    );
  }

  private async createMovieViewing(userId: string, tmdbId: number, watchedAt: Date) {
    const metadata = await this.getMovieMetadata(tmdbId);

    await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.create({
        data: {
          artworkUrl: metadata?.artworkUrl ?? null,
          contentType: 'MOVIE',
          genres: metadata?.genres ?? [],
          runtimeMinutes: metadata?.runtimeMinutes ?? null,
          title: metadata?.title ?? null,
          tmdbId,
          userId,
          watchedAt,
        },
      }),
    );
  }

  private async createEpisodeViewing(
    userId: string,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    watchedAt: Date,
  ) {
    const [seriesResult, episodeResult] = await Promise.all([
      this.catalogue.getSeries(seriesTmdbId).catch(() => null),
      this.catalogue.getEpisode(seriesTmdbId, seasonNumber, episodeNumber).catch(() => null),
    ]);
    const series = seriesResult?.item;
    const episode = episodeResult?.item;

    await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.create({
        data: {
          artworkUrl: series?.posterUrl ?? series?.backdropUrl ?? episode?.stillUrl ?? null,
          contentType: 'EPISODE',
          episodeNumber,
          genres: series?.genres ?? [],
          runtimeMinutes: episode?.runtimeMinutes ?? null,
          seasonNumber,
          subtitle: episode?.title ?? null,
          title: series?.title ?? null,
          tmdbId: seriesTmdbId,
          userId,
          watchedAt,
        },
      }),
    );
  }

  private async enrichMissingMetadata(userId: string) {
    const events = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        select: {
          contentType: true,
          episodeNumber: true,
          id: true,
          seasonNumber: true,
          tmdbId: true,
        },
        where: {
          OR: [{ runtimeMinutes: null }, { title: null }],
          userId,
        },
      }),
    );
    const movieIds = Array.from(
      new Set(events.filter((event) => event.contentType === 'MOVIE').map((event) => event.tmdbId)),
    );
    const seasonKeys = Array.from(
      new Set(
        events
          .filter((event) => event.contentType === 'EPISODE' && event.seasonNumber !== null)
          .map((event) => `${event.tmdbId}:${event.seasonNumber}`),
      ),
    );

    await Promise.all([
      ...movieIds.map(async (tmdbId) => {
        const metadata = await this.getMovieMetadata(tmdbId);

        if (!metadata) {
          return;
        }

        await this.prisma.withConnectionRetry(() =>
          this.prisma.viewingEvent.updateMany({
            data: metadata,
            where: { contentType: 'MOVIE', tmdbId, userId },
          }),
        );
      }),
      ...seasonKeys.map(async (key) => {
        const [tmdbId, seasonNumber] = key.split(':').map(Number);
        const metadata = await this.getSeasonMetadata(tmdbId, seasonNumber);

        if (!metadata) {
          return;
        }

        const matchingEvents = events.filter(
          (event) =>
            event.contentType === 'EPISODE' &&
            event.tmdbId === tmdbId &&
            event.seasonNumber === seasonNumber,
        );

        await Promise.all(
          matchingEvents.map((event) => {
            const episode = metadata.episodes.find(
              (item) => item.episodeNumber === event.episodeNumber,
            );

            return this.prisma.withConnectionRetry(() =>
              this.prisma.viewingEvent.update({
                data: {
                  artworkUrl: metadata.artworkUrl ?? episode?.stillUrl ?? null,
                  genres: metadata.genres,
                  runtimeMinutes: episode?.runtimeMinutes ?? null,
                  subtitle: episode?.title ?? null,
                  title: metadata.title,
                },
                where: { id: event.id },
              }),
            );
          }),
        );
      }),
    ]);
  }

  private async getMovieMetadata(tmdbId: number) {
    const result = await this.catalogue.getMovie(tmdbId).catch(() => null);
    const movie = result?.item;

    return movie
      ? {
          artworkUrl: movie.posterUrl ?? movie.backdropUrl,
          genres: movie.genres,
          runtimeMinutes: movie.runtimeMinutes,
          title: movie.title,
        }
      : null;
  }

  private async getSeasonMetadata(seriesTmdbId: number, seasonNumber: number) {
    const [seriesResult, seasonResult] = await Promise.all([
      this.catalogue.getSeries(seriesTmdbId).catch(() => null),
      this.catalogue.getSeason(seriesTmdbId, seasonNumber).catch(() => null),
    ]);
    const series = seriesResult?.item;
    const season = seasonResult?.item;

    if (!series && !season) {
      return null;
    }

    return {
      artworkUrl: series?.posterUrl ?? series?.backdropUrl ?? season?.posterUrl ?? null,
      episodes: season?.episodes ?? [],
      genres: series?.genres ?? [],
      title: series?.title ?? null,
    };
  }

  private async getMovieSummaryForUser(userId: string, tmdbId: number) {
    const viewCount = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.count({
        where: { contentType: 'MOVIE', tmdbId, userId },
      }),
    );

    return { tmdbId, viewCount };
  }

  private async getEpisodeSummaryForUser(
    userId: string,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const viewCount = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.count({
        where: {
          contentType: 'EPISODE',
          episodeNumber,
          seasonNumber,
          tmdbId: seriesTmdbId,
          userId,
        },
      }),
    );

    return { episodeNumber, seasonNumber, seriesTmdbId, viewCount };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}
