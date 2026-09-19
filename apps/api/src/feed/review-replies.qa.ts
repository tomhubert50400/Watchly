import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeedService } from './feed.service';

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = '33333333-3333-4333-8333-333333333333';
const REPLY_ID = '44444444-4444-4444-8444-444444444444';
const BLOCKED_ID = '55555555-5555-4555-8555-555555555555';
const createdAt = new Date('2026-09-19T12:00:00Z');
let blocked = false;
let createdData: Record<string, unknown> | null = null;
let notificationData: Record<string, unknown> | null = null;
let listArgs: Record<string, any> | null = null;
let deletedReplyId: string | null = null;
let deletedNotificationKey: string | null = null;

const reply = (index = 0) => ({
  body: `Reply ${index}`,
  containsSpoilers: index === 0,
  createdAt,
  id: index === 0 ? REPLY_ID : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  user: { avatarObjectKey: null, displayName: 'Viewer', id: VIEWER_ID },
  userId: VIEWER_ID,
});
const review = {
  _count: { likes: 3 },
  body: 'Original review',
  id: REVIEW_ID,
  likes: [{ id: 'like' }],
  moderationHiddenAt: null,
  tmdbId: 550,
  updatedAt: createdAt,
  user: {
    avatarObjectKey: null,
    displayName: 'Reviewer',
    id: AUTHOR_ID,
    privacySettings: { profileVisibility: 'PUBLIC', reviewsVisibility: 'PUBLIC' },
    suspendedAt: null,
    suspendedUntil: null,
  },
  userId: AUTHOR_ID,
};

const prisma: any = {
  $transaction: async (input: any) => typeof input === 'function' ? input(prisma) : Promise.all(input),
  notification: {
    create: async ({ data }: any) => { notificationData = data; return data; },
    deleteMany: async ({ where }: any) => { deletedNotificationKey = where.dedupeKey; return { count: 1 }; },
  },
  reviewReply: {
    create: async ({ data }: any) => { createdData = data; return reply(); },
    delete: async ({ where }: any) => { deletedReplyId = where.id; return reply(); },
    findFirst: async ({ where }: any) => where.userId === VIEWER_ID ? { id: REPLY_ID } : null,
    findMany: async (args: any) => { listArgs = args; return Array.from({ length: 31 }, (_, index) => reply(index)); },
  },
  userEpisodeRating: { findUnique: async () => null },
  userMovieRating: { findUnique: async () => ({ scoreHalfSteps: 9 }) },
  userBlock: {
    findFirst: async () => blocked ? { blockerId: AUTHOR_ID, blockedUserId: VIEWER_ID } : null,
    findMany: async () => [{ blockerId: VIEWER_ID, blockedUserId: BLOCKED_ID }],
  },
  userEpisodeReview: { findUnique: async () => null },
  userMovieReview: { findUnique: async () => review },
  withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
};
const service = new FeedService(
  { getOrCreateUser: async () => ({ displayName: 'Viewer', id: VIEWER_ID }) } as never,
  prisma,
  { getPublicUrl: () => null } as never,
);
const identity = { firebaseUid: 'viewer' } as never;

async function run() {
  const created = await service.createReviewReply(identity, 'movieReview', REVIEW_ID, {
    body: '  A thoughtful reply  ',
    containsSpoilers: true,
  });
  assert.equal(created.body, 'Reply 0');
  assert.deepEqual(createdData, {
    body: 'A thoughtful reply',
    containsSpoilers: true,
    movieReviewId: REVIEW_ID,
    userId: VIEWER_ID,
  });
  assert.equal(notificationData?.userId, AUTHOR_ID);
  assert.equal(notificationData?.actorUserId, VIEWER_ID);
  assert.deepEqual(notificationData?.routeMetadata, {
    route: 'ReviewReplies', reviewId: REVIEW_ID, reviewType: 'movieReview',
  });

  await assert.rejects(
    () => service.createReviewReply(identity, 'movieReview', REVIEW_ID, { body: '   ' }),
    BadRequestException,
  );

  const page = await service.listReviewReplies(identity, 'movieReview', REVIEW_ID);
  assert.equal(page.items.length, 30);
  assert.equal(page.nextCursor, page.items.at(-1)?.id);
  assert.equal(page.items[0].ownedByViewer, true);
  assert.deepEqual(page.review.content, { contentType: 'movie', tmdbId: 550 });
  assert.equal(page.review.likeCount, 3);
  assert.equal(page.review.likedByViewer, true);
  assert.equal(page.review.score, 4.5);
  assert.equal(page.review.updatedAt, createdAt.toISOString());
  assert.equal(listArgs?.take, 31);
  assert.deepEqual(listArgs?.where.userId.notIn, [BLOCKED_ID]);
  assert.equal(listArgs?.where.moderationHiddenAt, null);

  assert.deepEqual(await service.deleteReviewReply(identity, REPLY_ID), { deleted: true });
  assert.equal(deletedReplyId, REPLY_ID);
  assert.equal(deletedNotificationKey, `review-reply:${REPLY_ID}`);

  blocked = true;
  await assert.rejects(
    () => service.listReviewReplies(identity, 'movieReview', REVIEW_ID),
    NotFoundException,
  );

  console.log('Review replies QA passed: create, notify, paginate, block and owner delete.');
}

void run();
