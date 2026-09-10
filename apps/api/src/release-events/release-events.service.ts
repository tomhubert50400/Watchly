import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  SeriesDetails,
  TmdbCatalogueService,
} from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import {
  ReleaseDatePrecision,
  ReleaseEventStatus,
  ReleaseEventSyncStatus,
  ReleaseNotificationType,
  TrackedContentType,
} from '../generated/prisma/enums';
import { redactSensitiveText } from '../observability/structured-logger';

const CACHE_FRESHNESS_MS = 60 * 60 * 1000;
const SCHEDULE_BATCH_SIZE = 4;
const MAX_EPISODE_SEASONS_PER_SERIES = 3;

type ReleaseEventCandidate = {
  contentType: TrackedContentType;
  episodeNumber: number | null;
  precision: ReleaseDatePrecision;
  releaseDate: Date | null;
  seasonNumber: number | null;
  sourceKey: string;
  title: string;
  tmdbId: number;
  type: ReleaseNotificationType;
};

export type CanonicalReleaseEvent = ReleaseEventCandidate & {
  id: string;
  lastSyncedAt: Date;
  regionCode: string | null;
  source: string;
  status: ReleaseEventStatus;
  timeZone: string | null;
};

export type ReleaseEventSyncResult = {
  createdCount: number;
  events: CanonicalReleaseEvent[];
  failedScopeCount: number;
  updatedCount: number;
  withdrawnCount: number;
};

@Injectable()
export class ReleaseEventsService {
  private readonly logger = new Logger(ReleaseEventsService.name);
  private fullSyncPromise: Promise<FullSyncSummary> | null = null;

  constructor(
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async syncContent(
    contentType: TrackedContentType,
    tmdbId: number,
    options: { force?: boolean } = {},
  ): Promise<ReleaseEventSyncResult> {
    const cachedEvents = await this.listActiveEvents(contentType, tmdbId);
    if (!options.force && isFresh(cachedEvents)) {
      return {
        createdCount: 0,
        events: cachedEvents,
        failedScopeCount: 0,
        updatedCount: 0,
        withdrawnCount: 0,
      };
    }

    return contentType === TrackedContentType.MOVIE
      ? this.syncMovie(tmdbId)
      : this.syncSeries(tmdbId);
  }

  async expandFollowedTitles<T extends { contentType: TrackedContentType; tmdbId: number; userId?: string }>(
    subscriptions: T[],
    now = new Date(),
  ): Promise<T[]> {
    const movies = [...new Set(subscriptions
      .filter((item) => item.contentType === TrackedContentType.MOVIE)
      .map((item) => item.tmdbId))];
    const successors = new Map<number, number[]>();
    const today = now.toISOString().slice(0, 10);
    for (let offset = 0; offset < movies.length; offset += SCHEDULE_BATCH_SIZE) {
      await Promise.all(movies.slice(offset, offset + SCHEDULE_BATCH_SIZE).map(async (tmdbId) => {
        try {
          const { item: movie } = await this.catalogue.getMovie(tmdbId);
          if (!movie.collection) return;
          const collection = await this.catalogue.getCollection(movie.collection.id);
          successors.set(tmdbId, collection.items.filter((part) =>
            part.tmdbId !== tmdbId &&
            (!part.releaseDate || (part.releaseDate >= today &&
              (!movie.releaseDate || part.releaseDate > movie.releaseDate))),
          ).map((part) => part.tmdbId));
        } catch {
          this.logger.warn(JSON.stringify({ event: 'release_events.collection_sync.failed', tmdbId }));
        }
      }));
    }
    const expanded = subscriptions.flatMap((item) => [
      item,
      ...(item.contentType === TrackedContentType.MOVIE ? successors.get(item.tmdbId) ?? [] : [])
        .map((tmdbId) => ({ ...item, tmdbId })),
    ]);
    return [...new Map(expanded.map((item) =>
      [`${item.userId ?? ''}:${item.contentType}:${item.tmdbId}`, item],
    )).values()];
  }

  async syncAllTrackedContent() {
    if (this.fullSyncPromise) {
      return this.fullSyncPromise;
    }

    this.fullSyncPromise = this.performFullSync();

    try {
      return await this.fullSyncPromise;
    } finally {
      this.fullSyncPromise = null;
    }
  }

  async getLatestSyncRun() {
    const latest = await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEventSyncRun.findFirst({
        orderBy: {
          startedAt: 'desc',
        },
      }),
    );

    if (!latest) {
      return null;
    }

    return {
      completedAt: latest.completedAt?.toISOString() ?? null,
      contentCount: latest.contentCount,
      createdCount: latest.createdCount,
      failedCount: latest.failedCount,
      startedAt: latest.startedAt.toISOString(),
      status: latest.status.toLowerCase(),
      updatedCount: latest.updatedCount,
      withdrawnCount: latest.withdrawnCount,
    };
  }

  private async performFullSync(): Promise<FullSyncSummary> {
    const run = await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEventSyncRun.create({ data: {} }),
    );

    try {
      const trackedContent = await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseAlertSubscription.findMany({
          distinct: ['contentType', 'tmdbId'],
          orderBy: [{ contentType: 'asc' }, { tmdbId: 'asc' }],
          select: {
            contentType: true,
            tmdbId: true,
          },
        }),
      );
      const summary: FullSyncSummary = {
        contentCount: trackedContent.length,
        createdCount: 0,
        failedCount: 0,
        updatedCount: 0,
        withdrawnCount: 0,
      };
      const errors: string[] = [];
      let rejectedContentCount = 0;

      for (let offset = 0; offset < trackedContent.length; offset += SCHEDULE_BATCH_SIZE) {
        const batch = trackedContent.slice(offset, offset + SCHEDULE_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((item) => this.syncContent(item.contentType, item.tmdbId, { force: true })),
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            summary.createdCount += result.value.createdCount;
            summary.failedCount += result.value.failedScopeCount;
            summary.updatedCount += result.value.updatedCount;
            summary.withdrawnCount += result.value.withdrawnCount;
            return;
          }

          summary.failedCount += 1;
          rejectedContentCount += 1;
          const item = batch[index];
          errors.push(`${item.contentType.toLowerCase()}:${item.tmdbId}:${toErrorMessage(result.reason)}`);
        });
      }

      const status = getRunStatus(summary, rejectedContentCount);
      await this.finishRun(run.id, status, summary, errors.join(' | '));
      this.logger.log(JSON.stringify({ event: 'release_events.sync.completed', status, ...summary }));

      return summary;
    } catch (error) {
      const summary: FullSyncSummary = {
        contentCount: 0,
        createdCount: 0,
        failedCount: 1,
        updatedCount: 0,
        withdrawnCount: 0,
      };
      await this.finishRun(
        run.id,
        ReleaseEventSyncStatus.FAILED,
        summary,
        toErrorMessage(error),
      ).catch(() => undefined);
      throw error;
    }
  }

  private async finishRun(
    id: string,
    status: ReleaseEventSyncStatus,
    summary: FullSyncSummary,
    errorSummary: string,
  ) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEventSyncRun.update({
        data: {
          ...summary,
          completedAt: new Date(),
          errorSummary: errorSummary.slice(0, 1000) || null,
          status,
        },
        where: { id },
      }),
    );
  }

  private async syncMovie(tmdbId: number) {
    const response = await this.catalogue.getMovie(tmdbId);
    const movie = response.item;
    const candidate: ReleaseEventCandidate = {
      contentType: TrackedContentType.MOVIE,
      episodeNumber: null,
      precision: toPrecision(movie.releaseDate),
      releaseDate: parseTmdbDate(movie.releaseDate),
      seasonNumber: null,
      sourceKey: `tmdb:movie:${movie.tmdbId}:release`,
      title: truncateTitle(movie.title),
      tmdbId: movie.tmdbId,
      type: ReleaseNotificationType.MOVIE_RELEASE,
    };

    return this.persistCandidates(
      TrackedContentType.MOVIE,
      tmdbId,
      [candidate],
      [],
      0,
    );
  }

  private async syncSeries(tmdbId: number) {
    const response = await this.catalogue.getSeries(tmdbId);
    const series = response.item;
    const standardSeasons = series.seasons.filter((season) => season.seasonNumber > 0);
    const seasonCandidates = standardSeasons.map((season) => ({
      contentType: TrackedContentType.SERIES,
      episodeNumber: null,
      precision: toPrecision(season.airDate),
      releaseDate: parseTmdbDate(season.airDate),
      seasonNumber: season.seasonNumber,
      sourceKey: `tmdb:series:${series.tmdbId}:season:${season.seasonNumber}`,
      title: truncateTitle(`${series.title}: ${season.name}`),
      tmdbId: series.tmdbId,
      type: ReleaseNotificationType.SEASON_RELEASE,
    } satisfies ReleaseEventCandidate));
    const episodeSeasonNumbers = selectEpisodeSeasonNumbers(series);
    const seasonResults = await Promise.allSettled(
      episodeSeasonNumbers.map((seasonNumber) => this.catalogue.getSeason(tmdbId, seasonNumber)),
    );
    const episodeCandidates: ReleaseEventCandidate[] = [];
    let failedScopeCount = 0;
    const reconciliations: ReconciliationScope[] = [
      {
        sourceKeys: seasonCandidates.map((candidate) => candidate.sourceKey),
        type: ReleaseNotificationType.SEASON_RELEASE,
      },
    ];

    seasonResults.forEach((result, index) => {
      const seasonNumber = episodeSeasonNumbers[index];
      if (result.status === 'rejected') {
        failedScopeCount += 1;
        this.logger.warn(JSON.stringify({
          event: 'release_events.season_sync.failed',
          seasonNumber,
          tmdbId,
        }));
        return;
      }

      const candidates = result.value.item.episodes.map((episode) => ({
        contentType: TrackedContentType.SERIES,
        episodeNumber: episode.episodeNumber,
        precision: toPrecision(episode.airDate),
        releaseDate: parseTmdbDate(episode.airDate),
        seasonNumber: episode.seasonNumber,
        sourceKey: `tmdb:series:${series.tmdbId}:season:${episode.seasonNumber}:episode:${episode.episodeNumber}`,
        title: truncateTitle(`${series.title}: S${episode.seasonNumber}E${episode.episodeNumber} ${episode.title}`),
        tmdbId: series.tmdbId,
        type: ReleaseNotificationType.EPISODE_RELEASE,
      } satisfies ReleaseEventCandidate));
      episodeCandidates.push(...candidates);
      reconciliations.push({
        seasonNumber,
        sourceKeys: candidates.map((candidate) => candidate.sourceKey),
        type: ReleaseNotificationType.EPISODE_RELEASE,
      });
    });

    return this.persistCandidates(
      TrackedContentType.SERIES,
      tmdbId,
      [...seasonCandidates, ...episodeCandidates],
      reconciliations,
      failedScopeCount,
    );
  }

  private async persistCandidates(
    contentType: TrackedContentType,
    tmdbId: number,
    candidates: ReleaseEventCandidate[],
    reconciliationScopes: ReconciliationScope[],
    failedScopeCount: number,
  ): Promise<ReleaseEventSyncResult> {
    const now = new Date();

    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEvent.findMany({
        where: {
          contentType,
          tmdbId,
        },
      }),
    );
    const existingByKey = new Map(existing.map((event) => [event.sourceKey, event]));
    const createdCount = candidates.filter((candidate) =>
      !existingByKey.has(candidate.sourceKey),
    ).length;
    const updatedCount = candidates.filter((candidate) => {
      const previous = existingByKey.get(candidate.sourceKey);
      return previous ? hasCandidateChanged(previous, candidate) : false;
    }).length;

    await this.prisma.withConnectionRetry(() =>
      Promise.all(candidates.map((candidate) => {
        return this.prisma.releaseEvent.upsert({
          create: {
            ...candidate,
            lastSyncedAt: now,
            regionCode: null,
            source: 'TMDB',
            status: ReleaseEventStatus.ACTIVE,
            timeZone: null,
          },
          update: {
            ...candidate,
            lastSyncedAt: now,
            regionCode: null,
            source: 'TMDB',
            status: ReleaseEventStatus.ACTIVE,
            timeZone: null,
          },
          where: {
            sourceKey: candidate.sourceKey,
          },
        });
      })),
    );

    let withdrawnCount = 0;
    for (const scope of reconciliationScopes) {
      const withdrawn = await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseEvent.updateMany({
          data: {
            lastSyncedAt: now,
            status: ReleaseEventStatus.WITHDRAWN,
          },
          where: {
            contentType,
            seasonNumber: scope.seasonNumber,
            sourceKey: scope.sourceKeys.length > 0 ? { notIn: scope.sourceKeys } : undefined,
            status: ReleaseEventStatus.ACTIVE,
            tmdbId,
            type: scope.type,
          },
        }),
      );
      withdrawnCount += withdrawn.count;
    }

    return {
      createdCount,
      events: await this.listActiveEvents(contentType, tmdbId),
      failedScopeCount,
      updatedCount,
      withdrawnCount,
    };
  }

  private listActiveEvents(contentType: TrackedContentType, tmdbId: number) {
    return this.prisma.withConnectionRetry(() =>
      this.prisma.releaseEvent.findMany({
        orderBy: [
          { releaseDate: 'asc' },
          { seasonNumber: 'asc' },
          { episodeNumber: 'asc' },
        ],
        where: {
          contentType,
          status: ReleaseEventStatus.ACTIVE,
          tmdbId,
        },
      }),
    );
  }
}

type ReconciliationScope = {
  seasonNumber?: number;
  sourceKeys: string[];
  type: ReleaseNotificationType;
};

type FullSyncSummary = {
  contentCount: number;
  createdCount: number;
  failedCount: number;
  updatedCount: number;
  withdrawnCount: number;
};

function getRunStatus(summary: FullSyncSummary, rejectedContentCount: number) {
  if (summary.failedCount === 0) {
    return ReleaseEventSyncStatus.SUCCEEDED;
  }

  return summary.contentCount > 0 && rejectedContentCount === summary.contentCount
    ? ReleaseEventSyncStatus.FAILED
    : ReleaseEventSyncStatus.PARTIAL;
}

function isFresh(events: CanonicalReleaseEvent[]) {
  if (events.length === 0) {
    return false;
  }

  return events.every((event) =>
    Date.now() - event.lastSyncedAt.getTime() < CACHE_FRESHNESS_MS,
  );
}

export function parseTmdbDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function toPrecision(value: string | null) {
  return parseTmdbDate(value)
    ? ReleaseDatePrecision.DATE
    : ReleaseDatePrecision.UNKNOWN;
}

export function selectEpisodeSeasonNumbers(series: Pick<SeriesDetails, 'seasons'>) {
  const seasons = series.seasons.filter((season) => season.seasonNumber > 0);
  if (seasons.length === 0) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const latestSeasonNumber = Math.max(...seasons.map((season) => season.seasonNumber));

  return seasons
    .filter((season) =>
      season.seasonNumber === latestSeasonNumber
      || season.airDate === null
      || season.airDate >= today,
    )
    .sort((left, right) => right.seasonNumber - left.seasonNumber)
    .slice(0, MAX_EPISODE_SEASONS_PER_SERIES)
    .map((season) => season.seasonNumber);
}

function hasCandidateChanged(
  previous: {
    contentType: TrackedContentType;
    episodeNumber: number | null;
    precision: ReleaseDatePrecision;
    releaseDate: Date | null;
    seasonNumber: number | null;
    status: ReleaseEventStatus;
    title: string;
    tmdbId: number;
    type: ReleaseNotificationType;
  },
  candidate: ReleaseEventCandidate,
) {
  return previous.contentType !== candidate.contentType
    || previous.episodeNumber !== candidate.episodeNumber
    || previous.precision !== candidate.precision
    || toDateKey(previous.releaseDate) !== toDateKey(candidate.releaseDate)
    || previous.seasonNumber !== candidate.seasonNumber
    || previous.status !== ReleaseEventStatus.ACTIVE
    || previous.title !== candidate.title
    || previous.tmdbId !== candidate.tmdbId
    || previous.type !== candidate.type;
}

function toDateKey(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null;
}

function truncateTitle(value: string) {
  return value.slice(0, 160);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return redactSensitiveText(`${error.name}: ${error.message}`).slice(0, 300);
  }

  return redactSensitiveText(String(error)).slice(0, 300);
}
