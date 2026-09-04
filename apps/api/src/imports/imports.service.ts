import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { basename } from 'node:path';
import { assertUuid } from '../blocks/blocks.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  DataImportSource,
  DataImportStatus,
  TrackedContentType,
  UserContentStatus,
  ViewingContentType,
} from '../generated/prisma/enums';
import {
  ImportSourceValue,
  ParsedImportItem,
  parseImportFile,
} from './import-file.parser';

type ImportMatch = {
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  releaseDate: string | null;
  title: string;
  tmdbId: number;
};

export type PreparedImportItem = ParsedImportItem & {
  issues: string[];
  match: ImportMatch | null;
  status: 'ambiguous' | 'ready' | 'unmatched' | 'unsupported';
  suggestion: ImportMatch | null;
};

type ImportSummary = {
  favorites: number;
  needsAttention: number;
  ratings: number;
  ready: number;
  reviews: number;
  total: number;
  watched: number;
  watching: number;
  watchlisted: number;
};

type ImportResult = {
  alreadyCompleted?: boolean;
  preservedExisting: number;
  ratingsCreated: number;
  reviewsCreated: number;
  statesChanged: number;
  titlesProcessed: number;
  viewingEventsCreated: number;
};

type StoredImportPreview = {
  fileName: string;
  ignoredFileCount: number;
  items: PreparedImportItem[];
  result?: ImportResult;
  source: ImportSourceValue;
  summary: ImportSummary;
  version: 2;
};

export type ImportUpload = {
  buffer: Buffer;
  originalname: string;
  size: number;
};

@Injectable()
export class ImportsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async preview(
    identity: AuthenticatedIdentity,
    source: ImportSourceValue,
    file: ImportUpload,
  ) {
    if (!file) {
      throw new BadRequestException('Choose an export file to continue.');
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new BadRequestException('The import file must be 5 MB or smaller.');
    }

    const user = await this.authService.getOrCreateUser(identity);
    await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - IMPORT_PREVIEW_TTL_MS) },
          status: DataImportStatus.PREVIEWED,
          userId: user.id,
        },
      }),
    );
    const parsed = parseImportFile(source, file.originalname, file.buffer);
    const items = await mapWithConcurrency(
      parsed.items,
      MATCH_CONCURRENCY,
      (item) => this.prepareItem(item),
    );
    const preview: StoredImportPreview = {
      fileName: basename(file.originalname).slice(0, 255),
      ignoredFileCount: parsed.ignoredFileCount,
      items,
      source,
      summary: buildImportSummary(items),
      version: 2,
    };
    const record = await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.create({
        data: {
          fileName: preview.fileName,
          preview: preview as unknown as Prisma.InputJsonValue,
          source: toDataImportSource(source),
          userId: user.id,
        },
      }),
    );

    return toPublicPreview(record.id, preview);
  }

  async confirm(identity: AuthenticatedIdentity, importId: string) {
    assertUuid(importId);
    const user = await this.authService.getOrCreateUser(identity);
    const record = await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.findFirst({
        where: { id: importId, userId: user.id },
      }),
    );

    if (!record) {
      throw new NotFoundException('Import preview not found.');
    }

    const preview = readStoredPreview(record.preview);
    if (record.status === DataImportStatus.COMPLETED) {
      if (!preview.result) {
        throw new ConflictException('This import was already completed.');
      }

      return { ...preview.result, alreadyCompleted: true };
    }

    if (record.createdAt.getTime() < Date.now() - IMPORT_PREVIEW_TTL_MS) {
      throw new BadRequestException('This import preview expired. Choose the file again.');
    }

    return this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const claim = await transaction.dataImport.updateMany({
          data: { completedAt: new Date(), status: DataImportStatus.COMPLETED },
          where: { id: record.id, status: DataImportStatus.PREVIEWED, userId: user.id },
        });

        if (claim.count !== 1) {
          throw new ConflictException('This import is already being completed.');
        }

        const result = await commitPreparedItems(transaction, user.id, preview.items);
        const completedPreview: StoredImportPreview = { ...preview, items: [], result };

        await transaction.dataImport.update({
          data: { preview: completedPreview as unknown as Prisma.InputJsonValue },
          where: { id: record.id },
        });

        return result;
      }),
    );
  }

  async getPreview(identity: AuthenticatedIdentity, importId: string) {
    assertUuid(importId);
    const user = await this.authService.getOrCreateUser(identity);
    const record = await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.findFirst({
        where: { id: importId, status: DataImportStatus.PREVIEWED, userId: user.id },
      }),
    );

    if (!record) {
      throw new NotFoundException('Import preview not found.');
    }

    if (record.createdAt.getTime() < Date.now() - IMPORT_PREVIEW_TTL_MS) {
      throw new BadRequestException('This import preview expired. Choose the file again.');
    }

    return toPublicPreview(record.id, readStoredPreview(record.preview));
  }

  async retry(identity: AuthenticatedIdentity, importId: string, itemIndex: number) {
    assertUuid(importId);
    const user = await this.authService.getOrCreateUser(identity);
    const record = await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.findFirst({
        where: { id: importId, status: DataImportStatus.PREVIEWED, userId: user.id },
      }),
    );

    if (!record) {
      throw new NotFoundException('Import preview not found.');
    }

    if (record.createdAt.getTime() < Date.now() - IMPORT_PREVIEW_TTL_MS) {
      throw new BadRequestException('This import preview expired. Choose the file again.');
    }

    const preview = readStoredPreview(record.preview);
    const item = preview.items[itemIndex];
    if (!item) {
      throw new NotFoundException('Skipped import title not found.');
    }

    if (item.status === 'ready') {
      return toPublicPreview(record.id, preview);
    }

    const items = preview.items.map((current, index) =>
      index === itemIndex ? applyImportSuggestion(current) : current,
    );
    const updatedPreview: StoredImportPreview = {
      ...preview,
      items,
      summary: buildImportSummary(items),
    };
    const update = await this.prisma.withConnectionRetry(() =>
      this.prisma.dataImport.updateMany({
        data: { preview: updatedPreview as unknown as Prisma.InputJsonValue },
        where: { id: record.id, status: DataImportStatus.PREVIEWED, userId: user.id },
      }),
    );

    if (update.count !== 1) {
      throw new ConflictException('This import preview is already being completed.');
    }

    return toPublicPreview(record.id, updatedPreview);
  }

  private async prepareItem(item: ParsedImportItem): Promise<PreparedImportItem> {
    if (item.contentHint === 'episode') {
      return {
        ...item,
        issues: [...item.warnings, 'Episode imports are not supported by this source yet.'],
        match: null,
        status: 'unsupported',
        suggestion: null,
      };
    }

    const matchResult = await this.findMatch(item);
    if (matchResult.status !== 'ready') {
      return {
        ...item,
        issues: [...item.warnings, matchResult.issue],
        match: null,
        status: matchResult.status,
        suggestion: matchResult.suggestion,
      };
    }

    return prepareMatchedItem(item, matchResult.match);
  }

  private async findMatch(item: ParsedImportItem): Promise<
    | { match: ImportMatch; status: 'ready' }
    | { issue: string; status: 'ambiguous' | 'unmatched'; suggestion: ImportMatch | null }
  > {
    let identifierIssue: string | null = null;

    if (item.tmdbId) {
      try {
        const response = item.contentHint === 'series'
          ? await this.catalogue.getSeries(item.tmdbId)
          : await this.catalogue.getMovie(item.tmdbId);

        return { match: toImportMatch(response.item), status: 'ready' };
      } catch (error) {
        if (error instanceof NotFoundException) {
          identifierIssue = 'The supplied TMDB ID was not found.';
        } else {
          throw error;
        }
      }
    }

    if (item.imdbId) {
      const response = await this.catalogue.findByImdbId(item.imdbId);
      const candidates = response.items.filter(
        (candidate) => candidate.mediaType === item.contentHint,
      );

      if (candidates.length === 1) {
        return { match: toImportMatch(candidates[0]), status: 'ready' };
      }

      if (candidates.length > 1) {
        return {
          issue: 'The IMDb ID matched more than one TMDB title.',
          status: 'ambiguous',
          suggestion: toImportMatch(candidates[0]),
        };
      }
    }

    if (item.tvdbId) {
      const response = await this.catalogue.findByTvdbId(item.tvdbId);
      const candidates = response.items.filter(
        (candidate) => candidate.mediaType === 'series',
      );

      if (candidates.length === 1) {
        return { match: toImportMatch(candidates[0]), status: 'ready' };
      }

      if (candidates.length > 1) {
        return {
          issue: 'The TVDB ID matched more than one TMDB series.',
          status: 'ambiguous',
          suggestion: toImportMatch(candidates[0]),
        };
      }
    }

    if (!item.sourceTitle || item.sourceTitle.startsWith('Title ')) {
      return {
        issue: identifierIssue ?? 'No usable title or external ID was provided.',
        status: 'unmatched',
        suggestion: null,
      };
    }

    const contentType = item.contentHint === 'series' ? 'series' : 'movie';
    const response = await this.catalogue.search(item.sourceTitle, contentType);
    const candidates = response.items.filter((candidate) => candidate.mediaType === contentType);
    const titleMatches = candidates.filter(
      (candidate) => normalizeTitle(candidate.title) === normalizeTitle(item.sourceTitle),
    );
    const yearMatches = item.sourceYear
      ? titleMatches.filter((candidate) => candidate.releaseDate?.slice(0, 4) === String(item.sourceYear))
      : titleMatches;

    if (yearMatches.length === 1) {
      return { match: toImportMatch(yearMatches[0]), status: 'ready' };
    }

    if (yearMatches.length > 1 || titleMatches.length > 1) {
      return {
        issue: 'More than one TMDB title could match this row.',
        status: 'ambiguous',
        suggestion: toImportMatch(yearMatches[0] ?? titleMatches[0]),
      };
    }

    const probable = titleMatches[0] ?? candidates[0];
    return {
      issue: identifierIssue ?? 'No confident TMDB match was found.',
      status: 'unmatched',
      suggestion: probable ? toImportMatch(probable) : null,
    };
  }
}

export function applyImportSuggestion(item: PreparedImportItem): PreparedImportItem {
  if (!item.suggestion) {
    throw new BadRequestException('No probable match is available for this title.');
  }

  return prepareMatchedItem(item, item.suggestion);
}

function prepareMatchedItem(
  item: ParsedImportItem | PreparedImportItem,
  match: ImportMatch,
): PreparedImportItem {
  const issues = [...item.warnings];
  if (match.contentType === 'series' && item.review !== null) {
    issues.push('Series reviews cannot be represented in Watchly yet and will be skipped.');
  }

  return { ...item, issues, match, status: 'ready', suggestion: null };
}

export async function commitPreparedItems(
  transaction: Prisma.TransactionClient,
  userId: string,
  items: PreparedImportItem[],
): Promise<ImportResult> {
  const ready = items.filter(
    (item): item is PreparedImportItem & { match: ImportMatch } => item.status === 'ready' && item.match !== null,
  );
  const movieItems = ready.filter((item) => item.match.contentType === 'movie');
  const seriesItems = ready.filter((item) => item.match.contentType === 'series');
  const movieIds = [...new Set(movieItems.map((item) => item.match.tmdbId))];
  const seriesIds = [...new Set(seriesItems.map((item) => item.match.tmdbId))];
  const movieRatingItems = movieItems.filter(
    (item): item is typeof item & { rating: number } => item.rating !== null,
  );
  const seriesRatingItems = seriesItems.filter(
    (item): item is typeof item & { rating: number } => item.rating !== null,
  );
  const reviewItems = movieItems.filter(
    (item): item is typeof item & { review: string } => item.review !== null,
  );
  const [existingMovieRatings, existingSeriesRatings, existingReviews, existingStates, existingViewings] = await Promise.all([
    transaction.userMovieRating.findMany({
      select: { tmdbId: true },
      where: { tmdbId: { in: movieIds }, userId },
    }),
    transaction.userSeriesRating.findMany({
      select: { seriesTmdbId: true },
      where: { seriesTmdbId: { in: seriesIds }, userId },
    }),
    transaction.userMovieReview.findMany({
      select: { tmdbId: true },
      where: { tmdbId: { in: movieIds }, userId },
    }),
    transaction.userContentState.findMany({
      where: {
        OR: ready.map((item) => ({
          contentType: toTrackedContentType(item.match.contentType),
          tmdbId: item.match.tmdbId,
        })),
        userId,
      },
    }),
    transaction.viewingEvent.findMany({
      select: { tmdbId: true, watchedAt: true },
      where: { contentType: ViewingContentType.MOVIE, tmdbId: { in: movieIds }, userId },
    }),
  ]);
  const existingMovieRatingIds = new Set(existingMovieRatings.map((item) => item.tmdbId));
  const existingSeriesRatingIds = new Set(existingSeriesRatings.map((item) => item.seriesTmdbId));
  const existingReviewIds = new Set(existingReviews.map((item) => item.tmdbId));
  const movieRatingsToCreate = movieRatingItems.filter(
    (item) => !existingMovieRatingIds.has(item.match.tmdbId),
  );
  const seriesRatingsToCreate = seriesRatingItems.filter(
    (item) => !existingSeriesRatingIds.has(item.match.tmdbId),
  );
  const reviewsToCreate = reviewItems.filter((item) => !existingReviewIds.has(item.match.tmdbId));

  if (movieRatingsToCreate.length > 0) {
    await transaction.userMovieRating.createMany({
      data: movieRatingsToCreate.map((item) => ({
        createdAt: toActivityDate(item.activityDate),
        scoreHalfSteps: Math.round(item.rating * 2),
        tmdbId: item.match.tmdbId,
        updatedAt: toActivityDate(item.activityDate),
        userId,
      })),
    });
  }

  if (seriesRatingsToCreate.length > 0) {
    await transaction.userSeriesRating.createMany({
      data: seriesRatingsToCreate.map((item) => ({
        createdAt: toActivityDate(item.activityDate),
        scoreHalfSteps: Math.round(item.rating * 2),
        seriesTmdbId: item.match.tmdbId,
        updatedAt: toActivityDate(item.activityDate),
        userId,
      })),
    });
  }

  if (reviewsToCreate.length > 0) {
    await transaction.userMovieReview.createMany({
      data: reviewsToCreate.map((item) => ({
        body: item.review,
        createdAt: toActivityDate(item.activityDate),
        tmdbId: item.match.tmdbId,
        updatedAt: toActivityDate(item.activityDate),
        userId,
      })),
    });
  }

  const stateByKey = new Map(
    existingStates.map((state) => [getStateKey(state.contentType, state.tmdbId), state]),
  );
  let statesChanged = 0;

  for (const item of ready) {
    const contentType = toTrackedContentType(item.match.contentType);
    const key = getStateKey(contentType, item.match.tmdbId);
    const existing = stateByKey.get(key);
    const importedStatus = item.watched
      ? UserContentStatus.WATCHED
      : item.watching
        ? UserContentStatus.WATCHING
        : item.watchlisted
          ? UserContentStatus.WATCHLISTED
          : null;

    if (!importedStatus) continue;

    if (!existing) {
      const state = await transaction.userContentState.create({
        data: {
          contentType,
          createdAt: toActivityDate(item.activityDate),
          favorite: item.favorite,
          status: importedStatus,
          tmdbId: item.match.tmdbId,
          updatedAt: toActivityDate(item.activityDate),
          userId,
        },
      });
      stateByKey.set(key, state);
      statesChanged += 1;
    } else {
      const nextStatus = shouldPromoteImportedStatus(existing.status, importedStatus)
        ? importedStatus
        : existing.status;
      const nextFavorite = existing.favorite || item.favorite;

      if (nextStatus === existing.status && nextFavorite === existing.favorite) continue;

      const state = await transaction.userContentState.update({
        data: { favorite: nextFavorite, status: nextStatus },
        where: { id: existing.id },
      });
      stateByKey.set(key, state);
      statesChanged += 1;
    }
  }

  const existingViewingKeys = new Set(
    existingViewings.map((event) => getViewingKey(event.tmdbId, event.watchedAt)),
  );
  const viewingRows: Prisma.ViewingEventCreateManyInput[] = [];

  movieItems.filter((item) => item.watched).forEach((item) => {
    const dates = item.watchedDates.length > 0 ? item.watchedDates : [null];

    dates.forEach((date) => {
      const watchedAt = date ? toActivityDate(date) : null;
      const key = getViewingKey(item.match.tmdbId, watchedAt);
      const hasAnyExistingViewing = existingViewings.some((event) => event.tmdbId === item.match.tmdbId);

      if (existingViewingKeys.has(key) || (date === null && hasAnyExistingViewing)) return;

      existingViewingKeys.add(key);
      viewingRows.push({
        artworkUrl: item.match.posterUrl,
        contentType: ViewingContentType.MOVIE,
        title: item.match.title,
        tmdbId: item.match.tmdbId,
        userId,
        watchedAt,
      });
    });
  });

  if (viewingRows.length > 0) {
    await transaction.viewingEvent.createMany({ data: viewingRows });
  }

  return {
    preservedExisting:
      movieRatingItems.length - movieRatingsToCreate.length
      + seriesRatingItems.length - seriesRatingsToCreate.length
      + reviewItems.length - reviewsToCreate.length,
    ratingsCreated: movieRatingsToCreate.length + seriesRatingsToCreate.length,
    reviewsCreated: reviewsToCreate.length,
    statesChanged,
    titlesProcessed: ready.length,
    viewingEventsCreated: viewingRows.length,
  };
}

function buildImportSummary(items: PreparedImportItem[]): ImportSummary {
  const ready = items.filter(
    (item): item is PreparedImportItem & { match: ImportMatch } => item.status === 'ready' && item.match !== null,
  );

  return {
    favorites: ready.filter((item) => item.favorite).length,
    needsAttention: items.length - ready.length,
    ratings: ready.filter((item) => item.rating !== null).length,
    ready: ready.length,
    reviews: ready.filter((item) => item.review !== null && item.match.contentType === 'movie').length,
    total: items.length,
    watched: ready.filter((item) => item.watched).length,
    watching: ready.filter((item) => item.watching).length,
    watchlisted: ready.filter((item) => item.watchlisted).length,
  };
}

function toPublicPreview(importId: string, preview: StoredImportPreview) {
  return {
    fileName: preview.fileName,
    ignoredFileCount: preview.ignoredFileCount,
    importId,
    items: preview.items.map((item, itemIndex) => ({
      actions: {
        hasReview: item.review !== null && item.match?.contentType === 'movie',
        rating: item.rating,
        sourceRating: item.rating,
        viewingCount: item.match?.contentType === 'movie' && item.watched
          ? Math.max(1, item.watchedDates.length)
          : 0,
        watched: item.watched,
        watching: item.watching,
        watchlisted: item.watchlisted,
        favorite: item.favorite,
      },
      issues: item.issues,
      importId,
      itemIndex,
      match: item.match,
      sourceTitle: item.sourceTitle,
      sourceYear: item.sourceYear,
      status: item.status,
      suggestion: item.suggestion ?? null,
    })),
    source: preview.source,
    summary: preview.summary,
  };
}

function readStoredPreview(value: Prisma.JsonValue): StoredImportPreview {
  const preview = value as unknown as Partial<StoredImportPreview>;

  if (preview.version !== 2 || !Array.isArray(preview.items) || !preview.summary) {
    throw new BadRequestException('This import preview is no longer supported.');
  }

  return {
    ...preview,
    items: preview.items.map((item) => ({ ...item, suggestion: item.suggestion ?? null })),
  } as StoredImportPreview;
}

function toImportMatch(item: {
  firstAirDate?: string | null;
  mediaType: 'movie' | 'series';
  posterUrl: string | null;
  releaseDate?: string | null;
  title: string;
  tmdbId: number;
}): ImportMatch {
  return {
    contentType: item.mediaType,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate ?? item.firstAirDate ?? null,
    title: item.title,
    tmdbId: item.tmdbId,
  };
}

function toDataImportSource(source: ImportSourceValue) {
  if (source === 'letterboxd') return DataImportSource.LETTERBOXD;
  if (source === 'tv-time') return DataImportSource.TV_TIME;
  return DataImportSource.IMDB;
}

function shouldPromoteImportedStatus(
  existing: UserContentStatus | null,
  imported: UserContentStatus,
) {
  if (existing === UserContentStatus.DROPPED) return false;

  return getStatusPriority(imported) > getStatusPriority(existing);
}

function getStatusPriority(status: UserContentStatus | null) {
  if (status === UserContentStatus.WATCHED) return 3;
  if (status === UserContentStatus.WATCHING) return 2;
  if (status === UserContentStatus.WATCHLISTED) return 1;
  return 0;
}

function toTrackedContentType(contentType: ImportMatch['contentType']) {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function getStateKey(contentType: TrackedContentType, tmdbId: number) {
  return `${contentType}:${tmdbId}`;
}

function getViewingKey(tmdbId: number, watchedAt: Date | null) {
  return `${tmdbId}:${watchedAt?.toISOString().slice(0, 10) ?? 'unknown'}`;
}

function toActivityDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00.000Z`) : new Date();
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MATCH_CONCURRENCY = 5;
const IMPORT_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
