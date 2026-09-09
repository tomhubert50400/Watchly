import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Prisma } from '../generated/prisma/client';
import { TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { applyImportSuggestion, commitPreparedItems, ImportsService, reconcileImportedEpisodes } from './imports.service';

async function main() {
const createdRatings: unknown[] = [];
const createdSeriesRatings: unknown[] = [];
const createdReviews: unknown[] = [];
const createdStates: unknown[] = [];
const createdViewings: unknown[] = [];
const updatedStates: unknown[] = [];
const existingDate = new Date('2025-01-01T12:00:00.000Z');
const transaction = {
  userMovieRating: {
    createMany: async ({ data }: { data: unknown[] }) => { createdRatings.push(...data); },
    findMany: async () => [{ tmdbId: 1 }],
  },
  userMovieReview: {
    createMany: async ({ data }: { data: unknown[] }) => { createdReviews.push(...data); },
    findMany: async () => [{ tmdbId: 1 }],
  },
  userSeriesRating: {
    createMany: async ({ data }: { data: unknown[] }) => { createdSeriesRatings.push(...data); },
    findMany: async () => [],
  },
  userContentState: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createdStates.push(data);
      return { ...data, favorite: false, id: 'new-state' };
    },
    findMany: async () => [
      {
        contentType: TrackedContentType.MOVIE,
        favorite: false,
        id: 'existing-state',
        status: UserContentStatus.WATCHED,
        tmdbId: 1,
      },
      {
        contentType: TrackedContentType.SERIES,
        favorite: false,
        id: 'existing-series-state',
        status: UserContentStatus.WATCHLISTED,
        tmdbId: 3,
      },
    ],
    update: async ({ data }: { data: Record<string, unknown> }) => {
      updatedStates.push(data);
      return {
        contentType: TrackedContentType.SERIES,
        favorite: data.favorite,
        id: 'existing-series-state',
        status: data.status,
        tmdbId: 3,
      };
    },
  },
  viewingEvent: {
    createMany: async ({ data }: { data: unknown[] }) => { createdViewings.push(...data); },
    findMany: async () => [{ tmdbId: 1, watchedAt: existingDate }],
  },
} as unknown as Prisma.TransactionClient;
const baseItem = {
  activityDate: '2025-01-01',
  contentHint: 'movie' as const,
  favorite: false,
  imdbId: null,
  issues: [],
  match: {
    contentType: 'movie' as const,
    posterUrl: null,
    releaseDate: '1995-12-15',
    title: 'Heat',
    tmdbId: 1,
  },
  rating: 4,
  review: 'Excellent.',
  sourceKey: 'tmdb:1',
  sourceTitle: 'Heat',
  sourceYear: 1995,
  status: 'ready' as const,
  suggestion: null,
  tmdbId: 1,
  tvdbId: null,
  watched: true,
  watchedDates: ['2025-01-01'],
  watching: false,
  watchlisted: false,
  warnings: [],
};
const acceptedSuggestion = applyImportSuggestion({
  ...baseItem,
  match: null,
  rating: 4.5,
  review: 'Still excellent.',
  status: 'ambiguous',
  suggestion: {
    contentType: 'series',
    posterUrl: 'https://image.test/breaking-bad.jpg',
    releaseDate: '2008-01-20',
    title: 'Breaking Bad',
    tmdbId: 1396,
  },
});
assert.equal(acceptedSuggestion.status, 'ready');
assert.equal(acceptedSuggestion.match?.tmdbId, 1396);
assert.equal(acceptedSuggestion.suggestion, null);
assert.equal(acceptedSuggestion.issues.length, 1);
const result = await commitPreparedItems(transaction, 'user-id', [
  baseItem,
  {
    ...baseItem,
    activityDate: '2025-02-02',
    match: { ...baseItem.match, title: 'Thief', tmdbId: 2 },
    sourceKey: 'tmdb:2',
    sourceTitle: 'Thief',
    tmdbId: 2,
    watchedDates: ['2025-02-02'],
  },
  {
    ...baseItem,
    contentHint: 'series',
    favorite: true,
    match: { ...baseItem.match, contentType: 'series', title: 'Breaking Bad', tmdbId: 3 },
    rating: 4.5,
    review: null,
    sourceKey: 'tvdb:81189',
    sourceTitle: 'Breaking Bad',
    sourceYear: null,
    tmdbId: null,
    tvdbId: 81189,
    watched: false,
    watchedDates: [],
    watching: true,
  },
]);

assert.deepEqual(result, {
  preservedExisting: 2,
  ratingsCreated: 2,
  reviewsCreated: 1,
  statesChanged: 2,
  titlesProcessed: 3,
  viewingEventsCreated: 1,
});
assert.equal(createdRatings.length, 1);
assert.equal((createdRatings[0] as { scoreHalfSteps: number }).scoreHalfSteps, 8);
assert.equal((createdRatings[0] as { tmdbId: number }).tmdbId, 2);
assert.equal(createdSeriesRatings.length, 1);
assert.equal((createdSeriesRatings[0] as { scoreHalfSteps: number }).scoreHalfSteps, 9);
assert.equal((createdSeriesRatings[0] as { seriesTmdbId: number }).seriesTmdbId, 3);
assert.equal(createdReviews.length, 1);
assert.equal(createdStates.length, 1);
assert.equal(createdViewings.length, 1);
assert.deepEqual(updatedStates, [{ favorite: true, status: UserContentStatus.WATCHING }]);
assert.match(
  readFileSync('src/imports/imports.service.ts', 'utf8'),
  /sourceRating: item\.rating/,
  'Import previews must expose the source rating for movie and series match review.',
);

const episodeItem = {
  ...baseItem, contentHint: 'series' as const, rating: null, review: null,
  match: { ...baseItem.match, contentType: 'series' as const, tmdbId: 3 },
  episodes: [1, 2].map((episodeNumber) => ({ seasonNumber: 1, episodeNumber, watchedDate: '2025-01-01' })),
};
const catalogueEpisodes = [1, 2].map((episodeNumber) => ({ seasonNumber: 1, episodeNumber, airDate: '2024-01-01' }));
assert.equal(reconcileImportedEpisodes(episodeItem, catalogueEpisodes).watched, true);
assert.equal(reconcileImportedEpisodes({ ...episodeItem, episodes: episodeItem.episodes.slice(1) }, catalogueEpisodes).watched, false, 'a gap must prevent completion');
assert.equal(reconcileImportedEpisodes(episodeItem, [...catalogueEpisodes, { seasonNumber: 2, episodeNumber: 1, airDate: '2200-01-01' }]).watched, true, 'future episodes must not prevent being caught up');
assert.equal(reconcileImportedEpisodes(episodeItem, [{ seasonNumber: 0, episodeNumber: 1, airDate: '2024-01-01' }]).watched, false);
assert.equal(reconcileImportedEpisodes(episodeItem, []).episodes?.length, 0, 'unknown episode numbers must not be written');
const storedProgress = new Map<string, unknown>([['3:1:1', { watchedAt: 'existing date' }]]);
const storedEvents: { tmdbId: number; seasonNumber: number; episodeNumber: number }[] = [{ tmdbId: 3, seasonNumber: 1, episodeNumber: 1 }];
const episodeTransaction = {
  ...transaction,
  userEpisodeProgress: {
    createMany: async ({ data, skipDuplicates }: { data: { seriesTmdbId: number; seasonNumber: number; episodeNumber: number }[]; skipDuplicates: boolean }) => {
      assert.equal(skipDuplicates, true);
      for (const row of data) {
        const key = `${row.seriesTmdbId}:${row.seasonNumber}:${row.episodeNumber}`;
        if (!storedProgress.has(key)) storedProgress.set(key, row);
      }
    },
  },
  viewingEvent: {
    findMany: async ({ where }: { where: { contentType: string } }) => where.contentType === 'EPISODE' ? storedEvents : [],
    createMany: async ({ data }: { data: typeof storedEvents }) => { storedEvents.push(...data); },
  },
} as unknown as Prisma.TransactionClient;
await commitPreparedItems(episodeTransaction, 'user-id', [episodeItem]);
await commitPreparedItems(episodeTransaction, 'user-id', [episodeItem]);
assert.equal(storedProgress.size, 2, 'reimport must fill missing episodes without duplicates');
assert.deepEqual(storedProgress.get('3:1:1'), { watchedAt: 'existing date' }, 'existing progress dates must be preserved');
assert.equal(storedEvents.length, 2, 'reimport must not duplicate episode viewing events');
const catalogue = {
  getSeries: async () => ({ item: { seasons: [{ seasonNumber: 1 }] } }),
  getSeason: async () => ({ item: { episodes: catalogueEpisodes } }),
  findEpisodeByTvdbId: async (id: number) => [{ show_id: 3, season_number: 1, episode_number: id === 101 ? 2 : 1 }],
} as unknown as ConstructorParameters<typeof ImportsService>[1];
const service = new ImportsService({} as ConstructorParameters<typeof ImportsService>[0], catalogue, {} as ConstructorParameters<typeof ImportsService>[2]);
const blockedIdentity = await service['prepareItem']({
  ...episodeItem, identityIssue: 'Conflicting episode ownership', warnings: ['Conflicting episode ownership'],
});
assert.equal(blockedIdentity.status, 'unsupported');
assert.equal(blockedIdentity.match, null);
assert.equal(blockedIdentity.suggestion, null, 'conflicting identities must not be accepted through suggestion retry');
const renumbered = await service['prepareEpisodeProgress']({
  ...episodeItem,
  episodes: [
    { seasonNumber: 1, episodeNumber: 1, tvdbId: 101, watchedDate: null },
    { seasonNumber: 8, episodeNumber: 3, tvdbId: 102, watchedDate: null },
  ],
});
assert.deepEqual(renumbered.episodes?.map((episode) => episode.episodeNumber), [2, 1], 'numbering mismatches must resolve all episodes by external ID, including plausible but wrong pairs');
assert.equal(renumbered.watched, true);
await verifyLargeImport(transaction);
console.log('Imports service QA passed.');
}

async function verifyLargeImport(transaction: Prisma.TransactionClient) {
  const id = 'b85d2207-6bd8-4ba1-8e9f-f727c86ad979';
  type RecordValue = { id: string; userId: string; status: string; createdAt: Date; preview: Prisma.JsonValue };
  let record: RecordValue;
  let failCommit = false;
  const dataImport = {
    deleteMany: async () => ({ count: 0 }),
    create: async ({ data }: { data: Omit<RecordValue, 'id' | 'createdAt' | 'status'> }) => {
      record = { ...data, id, createdAt: new Date(), status: 'PREVIEWED' };
      return structuredClone(record);
    },
    findFirst: async ({ where }: { where: { id: string; userId: string; status?: string } }) =>
      where.id === record.id && where.userId === record.userId && (!where.status || where.status === record.status)
        ? structuredClone(record) : null,
    updateMany: async ({ where, data }: { where: { preview: { equals: unknown }; status: string }; data: Partial<RecordValue> }) => {
      if (where.status !== record.status || JSON.stringify(where.preview.equals) !== JSON.stringify(record.preview)) return { count: 0 };
      record = { ...record, ...structuredClone(data) };
      return { count: 1 };
    },
    update: async ({ data }: { data: Partial<RecordValue> }) => {
      if (failCommit) throw new Error('Simulated failed commit');
      record = { ...record, ...structuredClone(data) };
      return structuredClone(record);
    },
  };
  const writtenIds = new Set<number>();
  const batchTransaction = {
    ...transaction, dataImport,
    userContentState: {
      findMany: async () => [],
      create: async ({ data }: { data: { tmdbId: number } }) => {
        assert.ok(!writtenIds.has(data.tmdbId), 'committed titles must never be replayed');
        writtenIds.add(data.tmdbId);
        return { ...data, id: String(data.tmdbId) };
      },
    },
  };
  const prisma = {
    dataImport,
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
    $transaction: async <T>(operation: (tx: typeof batchTransaction) => Promise<T>) => {
      const before = structuredClone(record);
      const beforeIds = [...writtenIds];
      try { return await operation(batchTransaction); } catch (error) {
        record = before;
        writtenIds.clear();
        beforeIds.forEach((value) => writtenIds.add(value));
        throw error;
      }
    },
  } as unknown as ConstructorParameters<typeof ImportsService>[2];
  let active = 0;
  let peak = 0;
  let searches = 0;
  const catalogue = { search: async (title: string) => {
    searches += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return { items: [{ title, tmdbId: Number(title.split(' ')[1]), mediaType: 'movie', releaseDate: '2000-01-01', posterUrl: null }] };
  } } as unknown as ConstructorParameters<typeof ImportsService>[1];
  const auth = { getOrCreateUser: async () => ({ id: 'owner' }) } as unknown as ConstructorParameters<typeof ImportsService>[0];
  const identity = {} as Parameters<ImportsService['preview']>[0];
  const service = new ImportsService(auth, catalogue, prisma);
  const csv = Buffer.from('Name,Year,Letterboxd URI\n' + Array.from({ length: 1001 }, (_, index) =>
    `Movie ${index + 100},2000,https://boxd.it/test${index}`).join('\n'));
  let preview = await service.preview(identity, 'letterboxd', { buffer: csv, originalname: 'watched.csv', size: csv.length }, true);
  assert.equal(searches, 0, 'upload must return before catalogue lookups');
  assert.equal(preview.preparation.total, 1001);
  await assert.rejects(service.confirm(identity, id, true), /Wait for all titles/);
  await Promise.all([service.prepareBatch(identity, id), service.prepareBatch(identity, id)]);
  preview = await service.getPreview(identity, id);
  assert.equal(preview.preparation.processed, 25, 'overlapping preparation requests must not append twice');
  peak = 0;
  while (preview.preparation.processed < preview.preparation.total) {
    preview = await service.prepareBatch(identity, id);
  }
  assert.ok(peak <= 5, 'each batch must bound catalogue concurrency');
  assert.equal(preview.items.length, 1001);
  assert.equal(preview.summary.ready, 1001);
  let result = await service.confirm(identity, id, true);
  assert.equal(result.completed, false);
  assert.equal(result.titlesProcessed, 25);
  await assert.rejects(service.retry(identity, id, 0), /cannot be changed/);
  failCommit = true;
  await assert.rejects(service.confirm(identity, id, true), /Simulated failed commit/);
  assert.equal(writtenIds.size, 25, 'failed batches must roll back');
  failCommit = false;
  const resumed = new ImportsService(auth, catalogue, prisma);
  while (!result.completed) result = await resumed.confirm(identity, id, true);
  assert.equal(result.titlesProcessed, 1001);
  assert.equal(writtenIds.size, 1001);
  assert.equal((await resumed.confirm(identity, id, true)).alreadyCompleted, true);
  const foreignAuth = { getOrCreateUser: async () => ({ id: 'other-user' }) } as unknown as typeof auth;
  await assert.rejects(new ImportsService(foreignAuth, catalogue, prisma).confirm(identity, id, true), /not found/);
}

void main();
