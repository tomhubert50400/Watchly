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

type PreparedImportItem = ParsedImportItem & {
  issues: string[];
  match: ImportMatch | null;
  status: 'ambiguous' | 'ready' | 'unmatched' | 'unsupported';
};

type ImportSummary = {
  needsAttention: number;
  ratings: number;
  ready: number;
  reviews: number;
  total: number;
  watched: number;
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
  version: 1;
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
      version: 1,
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

  private async prepareItem(item: ParsedImportItem): Promise<PreparedImportItem> {
    if (item.contentHint === 'episode') {
      return {
        ...item,
        issues: [...item.warnings, 'Episode imports are not supported by this source yet.'],
        match: null,
        status: 'unsupported',
      };
    }

    const matchResult = await this.findMatch(item);
    if (matchResult.status !== 'ready') {
      return {
        ...item,
        issues: [...item.warnings, matchResult.issue],
        match: null,
        status: matchResult.status,
      };
    }

    const issues = [...item.warnings];
    if (matchResult.match.contentType === 'series' && item.rating !== null) {
      issues.push('Series ratings cannot be represented in Watchly yet and will be skipped.');
    }
    if (matchResult.match.contentType === 'series' && item.review !== null) {
      issues.push('Series reviews cannot be represented in Watchly yet and will be skipped.');
    }

    return { ...item, issues, match: matchResult.match, status: 'ready' };
  }

  private async findMatch(item: ParsedImportItem): Promise<
    | { match: ImportMatch; status: 'ready' }
    | { issue: string; status: 'ambiguous' | 'unmatched' }
  > {
    if (item.tmdbId) {
      try {
        const response = item.contentHint === 'series'
          ? await this.catalogue.getSeries(item.tmdbId)
          : await this.catalogue.getMovie(item.tmdbId);

        return { match: toImportMatch(response.item), status: 'ready' };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { issue: 'The supplied TMDB ID was not found.', status: 'unmatched' };
        }
        throw error;
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
        return { issue: 'The IMDb ID matched more than one TMDB title.', status: 'ambiguous' };
      }
    }

    if (!item.sourceTitle || item.sourceTitle.startsWith('Title ')) {
      return { issue: 'No usable title or external ID was provided.', status: 'unmatched' };
    }

    const contentType = item.contentHint === 'series' ? 'series' : 'movie';
    const response = await this.catalogue.search(item.sourceTitle, contentType);
    const titleMatches = response.items.filter(
      (candidate) => normalizeTitle(candidate.title) === normalizeTitle(item.sourceTitle),
    );
    const yearMatches = item.sourceYear
      ? titleMatches.filter((candidate) => candidate.releaseDate?.slice(0, 4) === String(item.sourceYear))
      : titleMatches;

    if (yearMatches.length === 1) {
      return { match: toImportMatch(yearMatches[0]), status: 'ready' };
    }

    if (yearMatches.length > 1 || titleMatches.length > 1) {
      return { issue: 'More than one TMDB title could match this row.', status: 'ambiguous' };
    }

    return { issue: 'No confident TMDB match was found.', status: 'unmatched' };
  }
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
  const movieIds = [...new Set(movieItems.map((item) => item.match.tmdbId))];
  const ratingItems = movieItems.filter(
    (item): item is typeof item & { rating: number } => item.rating !== null,
  );
  const reviewItems = movieItems.filter(
    (item): item is typeof item & { review: string } => item.review !== null,
  );
  const [existingRatings, existingReviews, existingStates, existingViewings] = await Promise.all([
    transaction.userMovieRating.findMany({
      select: { tmdbId: true },
      where: { tmdbId: { in: movieIds }, userId },
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
  const existingRatingIds = new Set(existingRatings.map((item) => item.tmdbId));
  const existingReviewIds = new Set(existingReviews.map((item) => item.tmdbId));
  const ratingsToCreate = ratingItems.filter((item) => !existingRatingIds.has(item.match.tmdbId));
  const reviewsToCreate = reviewItems.filter((item) => !existingReviewIds.has(item.match.tmdbId));

  if (ratingsToCreate.length > 0) {
    await transaction.userMovieRating.createMany({
      data: ratingsToCreate.map((item) => ({
        createdAt: toActivityDate(item.activityDate),
        scoreHalfSteps: Math.round(item.rating * 2),
        tmdbId: item.match.tmdbId,
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
      : item.watchlisted
        ? UserContentStatus.WATCHLISTED
        : null;

    if (!importedStatus) continue;

    if (!existing) {
      const state = await transaction.userContentState.create({
        data: {
          contentType,
          createdAt: toActivityDate(item.activityDate),
          status: importedStatus,
          tmdbId: item.match.tmdbId,
          updatedAt: toActivityDate(item.activityDate),
          userId,
        },
      });
      stateByKey.set(key, state);
      statesChanged += 1;
    } else if (
      importedStatus === UserContentStatus.WATCHED
      && existing.status === UserContentStatus.WATCHLISTED
    ) {
      const state = await transaction.userContentState.update({
        data: { status: UserContentStatus.WATCHED },
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
      ratingItems.length - ratingsToCreate.length + reviewItems.length - reviewsToCreate.length,
    ratingsCreated: ratingsToCreate.length,
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
    needsAttention: items.length - ready.length,
    ratings: ready.filter((item) => item.rating !== null && item.match.contentType === 'movie').length,
    ready: ready.length,
    reviews: ready.filter((item) => item.review !== null && item.match.contentType === 'movie').length,
    total: items.length,
    watched: ready.filter((item) => item.watched).length,
    watchlisted: ready.filter((item) => item.watchlisted).length,
  };
}

function toPublicPreview(importId: string, preview: StoredImportPreview) {
  return {
    fileName: preview.fileName,
    ignoredFileCount: preview.ignoredFileCount,
    importId,
    items: preview.items.map((item) => ({
      actions: {
        hasReview: item.review !== null && item.match?.contentType === 'movie',
        rating: item.match?.contentType === 'movie' ? item.rating : null,
        viewingCount: item.match?.contentType === 'movie' && item.watched
          ? Math.max(1, item.watchedDates.length)
          : 0,
        watched: item.watched,
        watchlisted: item.watchlisted,
      },
      issues: item.issues,
      match: item.match,
      sourceTitle: item.sourceTitle,
      sourceYear: item.sourceYear,
      status: item.status,
    })),
    source: preview.source,
    summary: preview.summary,
  };
}

function readStoredPreview(value: Prisma.JsonValue): StoredImportPreview {
  const preview = value as unknown as Partial<StoredImportPreview>;

  if (preview.version !== 1 || !Array.isArray(preview.items) || !preview.summary) {
    throw new BadRequestException('This import preview is no longer supported.');
  }

  return preview as StoredImportPreview;
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
  return source === 'letterboxd' ? DataImportSource.LETTERBOXD : DataImportSource.IMDB;
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
