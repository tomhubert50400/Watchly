import assert from 'node:assert/strict';
import { communityFeed } from './community-feed';

const now = new Date('2026-09-10T00:00:00Z');
const createdAt = new Date('2026-09-09T00:00:00Z');
const cursor = (offset = 0) => Buffer.from(JSON.stringify({ at: now.toISOString(), offset })).toString('base64url');
const author = (id: string, overrides = {}) => ({ id, displayName: id, avatarObjectKey: null, suspendedAt: null, suspendedUntil: null, privacySettings: { profileVisibility: 'PUBLIC', reviewsVisibility: 'PUBLIC', ratingsVisibility: 'PUBLIC', viewingHistoryVisibility: 'PUBLIC' }, ...overrides });
const review = (id: string, tmdbId: number, user = author(id)) => ({ id, tmdbId, userId: user.id, user, body: 'A review', moderationHiddenAt: null, createdAt, updatedAt: createdAt, _count: { likes: 0 }, likes: [] });
const publicReviews = Array.from({ length: 60 }, (_, i) => review(`public-${i}`, i));
const favorites = review('favorite-review', 900);
const notified = review('notified-review', 901);
const queued = review('queued-review', 902);
const recent = review('recent-review', 903);
const hiddenRatingAuthor = author('hidden-rating', { privacySettings: { profileVisibility: 'PUBLIC', reviewsVisibility: 'PUBLIC', ratingsVisibility: 'PRIVATE', viewingHistoryVisibility: 'PUBLIC' } });
const records: Record<string, any[]> = {
  userFollow: [],
  userBlock: [{ blockerId: 'viewer', blockedUserId: 'blocked' }, { blockerId: 'reverse-block', blockedUserId: 'viewer' }],
  userContentState: [{ userId: 'viewer', contentType: 'MOVIE', tmdbId: 900, favorite: true, status: null }],
  personalWatchlistItem: [{ watchlist: { userId: 'viewer' }, contentType: 'MOVIE', tmdbId: 902 }],
  releaseAlertSubscription: [{ userId: 'viewer', contentType: 'MOVIE', tmdbId: 901 }],
  userEpisodeProgress: [{ userId: 'viewer', seriesTmdbId: 100, seasonNumber: 1, episodeNumber: 1 }],
  viewingEvent: [{ id: 'recent-viewing', userId: 'viewer', contentType: 'MOVIE', tmdbId: 903, watchedAt: createdAt, createdAt, user: author('viewer') }],
  userMovieReview: [
    ...publicReviews, favorites, notified, queued, recent,
    review('hidden-rating-review', 910, hiddenRatingAuthor),
    review('private', 920, author('private', { privacySettings: { profileVisibility: 'PRIVATE', reviewsVisibility: 'PUBLIC' } })),
    review('blocked', 921), review('reverse-block', 922),
    review('suspended', 923, author('suspended', { suspendedAt: createdAt })),
    { ...review('moderated', 924), moderationHiddenAt: createdAt },
    review('viewer', 925),
  ],
  userMovieRating: [
    { ...review('favorite-rating', 900, favorites.user), scoreHalfSteps: 9 },
    { ...review('standalone-rating', 950), scoreHalfSteps: 7 },
    { ...review('private-score', 910, hiddenRatingAuthor), scoreHalfSteps: 10 },
  ],
  userSeriesRating: [{ ...review('series-rating', 0), seriesTmdbId: 300, scoreHalfSteps: 8 }],
  userEpisodeReview: [{ ...review('episode-review', 0), seriesTmdbId: 100, seasonNumber: 1, episodeNumber: 1 }],
  userEpisodeRating: [],
};

// A small in-memory query evaluator lets fixtures exercise the actual visibility queries.
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'AND') return value.every((part: any) => matches(row, part));
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    const field = row?.[key];
    if (value === null || typeof value !== 'object') return field === value;
    if ('in' in value && !value.in.includes(field)) return false;
    if ('notIn' in value && value.notIn.includes(field)) return false;
    if ('gte' in value && !(field >= value.gte)) return false;
    if ('lte' in value && (field == null || !(field <= value.lte))) return false;
    if (Object.keys(value).some((operator) => ['in', 'notIn', 'gte', 'lte'].includes(operator))) return true;
    return matches(field, value);
  });
}
const prisma = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
  findMany: async ({ where, take }: any) => rows.filter((row) => matches(row, where)).slice(0, take),
}]));
const avatar = { getPublicUrl: () => null };

async function run() {
  const first = await communityFeed(prisma as never, avatar as never, 'viewer', cursor());
  assert.equal(first.items.length, 30, 'No follows still produces a full public feed');
  assert.deepEqual(first.items.slice(0, 4).map((item) => item.id), ['favorite-review', 'notified-review', 'queued-review', 'recent-review']);
  assert.equal(first.items[0].score, 4.5, 'Review includes its rating');
  assert.equal(first.items.find((item) => item.id === 'queued-review')?.inWatchlist, true);
  assert.equal(first.items.find((item) => item.id === 'recent-review')?.viewerHasWatched, true);
  assert.ok(first.items.every((item) => !item.followed));
  assert.ok(first.nextCursor);
  const all = [...first.items];
  let next: string | null = first.nextCursor;
  while (next) {
    const page = await communityFeed(prisma as never, avatar as never, 'viewer', next);
    all.push(...page.items);
    next = page.nextCursor;
  }
  assert.equal(new Set(all.map((item) => item.id)).size, all.length, 'Pages do not duplicate posts');
  for (const id of ['private', 'blocked', 'reverse-block', 'suspended', 'moderated', 'viewer', 'movieRating:private-score', 'movieRating:favorite-rating']) {
    assert.ok(!all.some((item) => item.id === id), `${id} must be excluded`);
  }
  assert.equal(all.find((item) => item.id === 'hidden-rating-review')?.score, null, 'Private rating is not disclosed with a public review');
  assert.ok(all.some((item) => item.id === 'movieRating:standalone-rating'));
  assert.ok(all.some((item) => item.type === 'seriesRating'));
  assert.equal(all.find((item) => item.id === 'episode-review')?.viewerHasWatched, true);
  records.userFollow.push({ followerId: 'viewer', followedUserId: 'public-1', status: 'ACCEPTED' });
  const oneFollow = await communityFeed(prisma as never, avatar as never, 'viewer', cursor());
  assert.equal(oneFollow.items.filter((item) => item.followed).length, 1, 'One followed account occupies at most 5% of the first page');
  for (let index = 0; index < 20; index++) {
    const id = `watcher-${index}`;
    records.userFollow.push({ followerId: 'viewer', followedUserId: id, status: 'ACCEPTED' });
    records.viewingEvent.push({ id, userId: id, user: author(id), contentType: 'EPISODE', tmdbId: 400 + index, seasonNumber: 1, episodeNumber: 1, createdAt, watchedAt: createdAt });
    records.viewingEvent.push({ id: `${id}-second-episode`, userId: id, user: author(id), contentType: 'EPISODE', tmdbId: 400 + index, seasonNumber: 1, episodeNumber: 2, createdAt, watchedAt: createdAt });
    records.viewingEvent.push({ id: `${id}-imported`, userId: id, user: author(id), contentType: 'MOVIE', tmdbId: 500 + index, createdAt, watchedAt: new Date('2026-08-01') });
  }
  const activity = await communityFeed(prisma as never, avatar as never, 'viewer', cursor());
  const viewingPosts = activity.items.filter((item) => item.type === 'viewing');
  assert.equal(viewingPosts.length, 3, 'Viewing activity stays at 10% or less');
  assert.ok(viewingPosts.every((item) => item.followed && !item.id.includes('imported')));
  assert.equal(new Set(viewingPosts.map((item) => `${item.author.id}:${JSON.stringify(item.content)}`)).size, viewingPosts.length, 'Episode sessions are grouped by series and author');
  records.userFollow.length = 0;
  records.userMovieReview.splice(0, records.userMovieReview.length, { ...review('older-public-review', 777), createdAt: new Date('2025-01-01') });
  const quietCommunity = await communityFeed(prisma as never, avatar as never, 'viewer', cursor());
  assert.ok(quietCommunity.items.some((item) => item.id === 'older-public-review'), 'Discovery can use older public posts when recent activity is sparse');
  const noFollowing = await communityFeed(prisma as never, avatar as never, 'viewer', undefined, 'following');
  assert.equal(noFollowing.items.length, 0, 'Following must remain empty without followed authors');
  records.userFollow.push({ followerId: 'viewer', followedUserId: 'only-follow', status: 'ACCEPTED' });
  const oldFollowed = Array.from({ length: 60 }, (_, i) => ({ ...review(`old-followed-${i}`, 800 + i, author('only-follow')), createdAt: new Date('2025-01-01') }));
  records.userMovieReview.push(...oldFollowed);
  const sparseOldFeed = await communityFeed(prisma as never, avatar as never, 'viewer');
  assert.ok(sparseOldFeed.items.some((item) => item.author.id === 'only-follow'), 'Old followed opinions remain available when discovery is sparse');
  const followedPage = await communityFeed(prisma as never, avatar as never, 'viewer', undefined, 'following');
  assert.equal(followedPage.items.length, 30, 'Following includes older opinions even from a single author');
  assert.ok(followedPage.items.every((item) => item.author.id === 'only-follow'));
  assert.ok(followedPage.nextCursor);
  const followedNext = await communityFeed(prisma as never, avatar as never, 'viewer', followedPage.nextCursor!, 'following');
  assert.equal(followedNext.items.length, 30);
  assert.equal(new Set([...followedPage.items, ...followedNext.items].map((item) => item.id)).size, 60);
  await assert.rejects(() => communityFeed(prisma as never, avatar as never, 'viewer', followedPage.nextCursor!), /Invalid community cursor/);
  console.log('Community service QA passed: discovery, interests, privacy, blocks, ratings, progress and pagination.');
}
void run();
