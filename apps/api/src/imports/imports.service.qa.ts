import assert from 'node:assert/strict';
import { Prisma } from '../generated/prisma/client';
import { TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { commitPreparedItems } from './imports.service';

async function main() {
const createdRatings: unknown[] = [];
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
  tmdbId: 1,
  tvdbId: null,
  watched: true,
  watchedDates: ['2025-01-01'],
  watching: false,
  watchlisted: false,
  warnings: [],
};
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
    rating: null,
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
  ratingsCreated: 1,
  reviewsCreated: 1,
  statesChanged: 2,
  titlesProcessed: 3,
  viewingEventsCreated: 1,
});
assert.equal(createdRatings.length, 1);
assert.equal((createdRatings[0] as { scoreHalfSteps: number }).scoreHalfSteps, 8);
assert.equal((createdRatings[0] as { tmdbId: number }).tmdbId, 2);
assert.equal(createdReviews.length, 1);
assert.equal(createdStates.length, 1);
assert.equal(createdViewings.length, 1);
assert.deepEqual(updatedStates, [{ favorite: true, status: UserContentStatus.WATCHING }]);

console.log('Imports service QA passed.');
}

void main();
