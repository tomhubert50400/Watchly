import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { buildViewingStats } from './viewing-stats';
import { SaveViewingHistoryDto } from './viewing-history.dto';
import { historyMatches, resolveViewingHistory } from './viewing-history';

@Injectable()
export class ViewingsService {
  private readonly logger = new Logger(ViewingsService.name);
  private readonly statsRequests = new Map<string, Promise<ReturnType<typeof buildViewingStats>>>();

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
  ) {}

  async getStats(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);

    return this.getStatsForUser(userId);
  }

  async listJournal(identity: AuthenticatedIdentity) {
    const userId = await this.getUserId(identity);
    const items = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        orderBy: [{ watchedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          contentType: true,
          episodeNumber: true,
          id: true,
          seasonNumber: true,
          tmdbId: true,
          watchedAt: true,
        },
        where: { userId, watchedAt: { not: null } },
      }),
    );

    return {
      items: items.map((item) => ({
        contentType: item.contentType === 'MOVIE' ? 'movie' as const : 'episode' as const,
        episodeNumber: item.episodeNumber,
        id: item.id,
        seasonNumber: item.seasonNumber,
        tmdbId: item.tmdbId,
        watchedAt: item.watchedAt!.toISOString(),
      })),
    };
  }

  getStatsForUser(userId: string) {
    const existing = this.statsRequests.get(userId);
    if (existing) return existing;
    const request = this.buildStatsForUser(userId).finally(() => this.statsRequests.delete(userId));
    this.statsRequests.set(userId, request);
    return request;
  }

  private async buildStatsForUser(userId: string) {
    await this.initializeWatchedSeriesEpisodes(userId);
    await this.enrichMissingMetadata(userId);

    const [events, movieRatings, episodeRatings, seriesRatings, watchedStates] = await this.prisma.withConnectionRetry(() =>
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
        this.prisma.userSeriesRating.findMany({
          select: { scoreHalfSteps: true },
          where: { userId },
        }),
        this.prisma.userContentState.findMany({
          select: { contentType: true, tmdbId: true },
          where: { status: 'WATCHED', userId },
        }),
      ]),
    );

    const viewedMovieIds = new Set(
      events.filter((event) => event.contentType === 'MOVIE').map((event) => event.tmdbId),
    );
    const viewedSeriesIds = new Set(
      events.filter((event) => event.contentType === 'EPISODE').map((event) => event.tmdbId),
    );
    const watchedTitles = await Promise.all(
      watchedStates
        .filter((state) => state.contentType === 'MOVIE'
          ? !viewedMovieIds.has(state.tmdbId)
          : !viewedSeriesIds.has(state.tmdbId))
        .map(async (state) => {
          const metadata = state.contentType === 'MOVIE'
            ? await this.getMovieMetadata(state.tmdbId)
            : await this.getSeriesMetadata(state.tmdbId);

          return {
            artworkUrl: metadata?.artworkUrl ?? null,
            contentType: state.contentType,
            genres: metadata?.genres ?? [],
            runtimeMinutes: state.contentType === 'MOVIE'
              ? metadata?.runtimeMinutes ?? null
              : null,
            title: metadata?.title ?? null,
            tmdbId: state.tmdbId,
          };
        }),
    );

    return buildViewingStats(events, [...movieRatings, ...episodeRatings, ...seriesRatings], watchedTitles);
  }

  async initializeWatchedSeriesEpisodes(userId: string) {
    try {
      const pendingStates = await this.prisma.withConnectionRetry(() =>
        this.prisma.userContentState.findMany({
          select: { id: true, tmdbId: true },
          where: {
            contentType: 'SERIES',
            status: 'WATCHED',
            userId,
            watchedEpisodesInitializedAt: null,
          },
        }),
      );

      await mapWithConcurrency(pendingStates, 3, async (state) => {
        try {
          await this.initializeWatchedSeries(userId, state.id, state.tmdbId);
        } catch (error) {
          this.logger.warn(
            `Could not initialize watched episodes for series ${state.tmdbId}: ${getErrorMessage(error)}`,
          );
        }
      });
    } catch (error) {
      this.logger.warn(`Could not load watched series initialization state: ${getErrorMessage(error)}`);
    }
  }

  async getMovieSummary(identity: AuthenticatedIdentity, tmdbId: number) {
    return this.getMovieSummaryForUser(await this.getUserId(identity), tmdbId);
  }

  async saveHistory(identity: AuthenticatedIdentity, input: SaveViewingHistoryDto) {
    const entries = resolveViewingHistory(input);
    const userId = await this.getUserId(identity);
    const where = {
      userId, tmdbId: input.tmdbId,
      contentType: input.contentType === 'movie' ? 'MOVIE' as const : 'EPISODE' as const,
      seasonNumber: input.contentType === 'episode' ? input.seasonNumber! : null,
      episodeNumber: input.contentType === 'episode' ? input.episodeNumber! : null,
    };
    const existing = await this.prisma.viewingEvent.findFirst({ where });
    const metadata = existing ?? (input.contentType === 'movie'
      ? await this.getMovieMetadata(input.tmdbId)
      : await this.getSeasonMetadata(input.tmdbId, input.seasonNumber!));
    const episode = metadata && 'episodes' in metadata
      ? metadata.episodes.find((item) => item.episodeNumber === input.episodeNumber) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.viewingEvent.findMany({ where });
        if (!historyMatches(current, entries.map((entry) => ({ ...entry, watchedAt: entry.watchedAt.toISOString() })))) {
          if (!historyMatches(current, input.previous)) {
            throw new ConflictException('Your viewing history changed. Reopen it before saving.');
          }
          const currentIds = new Set(current.map((item) => item.id));
          const newEntries = entries.filter((entry) => !currentIds.has(entry.id));
          await tx.viewingEvent.deleteMany({ where: { ...where, id: { notIn: entries.map((entry) => entry.id) } } });
          for (const entry of entries.filter((item) => currentIds.has(item.id))) {
            if (current.find((item) => item.id === entry.id)?.watchedAt?.getTime() !== entry.watchedAt.getTime()) {
              await tx.viewingEvent.updateMany({ where: { ...where, id: entry.id }, data: { watchedAt: entry.watchedAt } });
            }
          }
          if (newEntries.length) await tx.viewingEvent.createMany({
            data: newEntries.map((entry) => ({
              ...where, ...entry, title: metadata?.title ?? null,
              artworkUrl: metadata?.artworkUrl ?? null, genres: metadata?.genres ?? [],
              runtimeMinutes: episode?.runtimeMinutes ?? (metadata && 'runtimeMinutes' in metadata ? metadata.runtimeMinutes : null),
              subtitle: episode?.title ?? (existing?.subtitle ?? null),
            })),
          });
          if (!current.length && input.contentType === 'movie') {
            await tx.userContentState.upsert({
              where: { userId_contentType_tmdbId: { userId, contentType: 'MOVIE', tmdbId: input.tmdbId } },
              create: { userId, contentType: 'MOVIE', tmdbId: input.tmdbId, status: 'WATCHED' },
              update: { status: 'WATCHED' },
            });
          }
          if (input.contentType === 'episode') {
            const watchedAt = entries.reduce((latest, entry) => entry.watchedAt > latest ? entry.watchedAt : latest, entries[0]!.watchedAt);
            const progressKey = { userId, seriesTmdbId: input.tmdbId, seasonNumber: input.seasonNumber!, episodeNumber: input.episodeNumber! };
            await tx.userEpisodeProgress.upsert({
              where: { userId_seriesTmdbId_seasonNumber_episodeNumber: progressKey },
              create: { ...progressKey, watchedAt }, update: { watchedAt },
            });
          }
        }
        const saved = await tx.viewingEvent.findMany({ where, orderBy: [{ watchedAt: 'desc' }, { id: 'asc' }] });
        return { items: saved.map((item) => ({ id: item.id, watchedAt: item.watchedAt?.toISOString() ?? null })) };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error.code === 'P2034' || error.code === 'P2002')) {
        throw new ConflictException('Your viewing history changed. Reopen it before saving.');
      }
      throw error;
    }
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
        select: { episodeNumber: true, seasonNumber: true, createdAt: true },
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
    const episodes = new Map<string, { seasonNumber: number; episodeNumber: number; viewCount: number; latestLoggedAt: string }>();
    for (const event of events) {
      if (event.seasonNumber === null || event.episodeNumber === null) continue;
      const key = `${event.seasonNumber}:${event.episodeNumber}`;
      const previous = episodes.get(key);
      const loggedAt = event.createdAt.toISOString();
      episodes.set(key, {
        seasonNumber: event.seasonNumber,
        episodeNumber: event.episodeNumber,
        viewCount: (previous?.viewCount ?? 0) + 1,
        latestLoggedAt: previous && previous.latestLoggedAt > loggedAt ? previous.latestLoggedAt : loggedAt,
      });
    }

    return {
      episodes: [...episodes.values()],
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

  private async initializeWatchedSeries(userId: string, stateId: string, seriesTmdbId: number) {
    const series = (await this.catalogue.getSeries(seriesTmdbId)).item;
    const seasons = series.seasons.filter((season) => season.seasonNumber > 0);
    const seasonResults = await mapWithConcurrency(seasons, 4, (season) =>
      this.catalogue.getSeason(seriesTmdbId, season.seasonNumber)
    );
    const today = new Date().toISOString().slice(0, 10);
    const episodes = seasonResults.flatMap(({ item: season }) =>
      season.episodes
        .filter((episode) => episode.airDate !== null && episode.airDate <= today)
        .map((episode) => ({
          artworkUrl: series.posterUrl ?? series.backdropUrl ?? season.posterUrl ?? episode.stillUrl,
          episodeNumber: episode.episodeNumber,
          genres: series.genres,
          runtimeMinutes: episode.runtimeMinutes,
          seasonNumber: episode.seasonNumber,
          subtitle: episode.title,
          title: series.title,
        })),
    );
    const markedAt = new Date();

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const existingEvents = await tx.viewingEvent.findMany({
          select: { episodeNumber: true, seasonNumber: true },
          where: { contentType: 'EPISODE', tmdbId: seriesTmdbId, userId },
        });
        const existingEventKeys = new Set(
          existingEvents.map((event) => `${event.seasonNumber}:${event.episodeNumber}`),
        );

        if (episodes.length > 0) {
          await tx.userEpisodeProgress.createMany({
            data: episodes.map((episode) => ({
              episodeNumber: episode.episodeNumber,
              seasonNumber: episode.seasonNumber,
              seriesTmdbId,
              userId,
              watchedAt: markedAt,
            })),
            skipDuplicates: true,
          });

          const missingEvents = episodes.filter(
            (episode) => !existingEventKeys.has(`${episode.seasonNumber}:${episode.episodeNumber}`),
          );
          if (missingEvents.length > 0) {
            await tx.viewingEvent.createMany({
              data: missingEvents.map((episode) => ({
                ...episode,
                contentType: 'EPISODE' as const,
                tmdbId: seriesTmdbId,
                userId,
                watchedAt: null,
              })),
            });
          }
        }

        await tx.userContentState.update({
          data: { watchedEpisodesInitializedAt: markedAt },
          where: { id: stateId },
        });
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
      mapWithConcurrency(movieIds, 5, async (tmdbId) => {
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
      mapWithConcurrency(seasonKeys, 3, async (key) => {
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

  private async getSeriesMetadata(tmdbId: number) {
    const result = await this.catalogue.getSeries(tmdbId).catch(() => null);
    const series = result?.item;

    return series
      ? {
          artworkUrl: series.posterUrl ?? series.backdropUrl,
          genres: series.genres,
          runtimeMinutes: null,
          title: series.title,
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
    const history = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        select: { id: true, watchedAt: true, createdAt: true },
        orderBy: [{ watchedAt: 'desc' }, { id: 'asc' }],
        where: { contentType: 'MOVIE', tmdbId, userId },
      }),
    );

    return {
      tmdbId,
      viewCount: history.length,
      latestLoggedAt: history.reduce<string | null>((latest, item) => {
        const loggedAt = item.createdAt.toISOString();
        return !latest || loggedAt > latest ? loggedAt : latest;
      }, null),
      history: history.map((item) => ({ id: item.id, watchedAt: item.watchedAt?.toISOString() ?? null })),
    };
  }

  private async getEpisodeSummaryForUser(
    userId: string,
    seriesTmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const history = await this.prisma.withConnectionRetry(() =>
      this.prisma.viewingEvent.findMany({
        select: { id: true, watchedAt: true },
        orderBy: [{ watchedAt: 'desc' }, { id: 'asc' }],
        where: {
          contentType: 'EPISODE',
          episodeNumber,
          seasonNumber,
          tmdbId: seriesTmdbId,
          userId,
        },
      }),
    );

    return { episodeNumber, seasonNumber, seriesTmdbId, viewCount: history.length, history: history.map((item) => ({ ...item, watchedAt: item.watchedAt?.toISOString() ?? null })) };
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
