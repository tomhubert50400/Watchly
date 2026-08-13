import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import {
  AuthProvider,
  NotificationKind,
  ReleaseNotificationType,
  TrackedContentType,
} from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { ReleaseEventsService } from '../release-events/release-events.service';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';

async function main() {
  const runId = Date.now();
  const ownerIdentity = createIdentity(`__notifications_smoke_owner_${runId}`);
  const memberIdentity = createIdentity(`__notifications_smoke_member_${runId}`);
  const outsiderIdentity = createIdentity(`__notifications_smoke_outsider_${runId}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const catalogueRequests = new Set<number>();
  const catalogue = {
    getMovie: async (tmdbId: number) => {
      catalogueRequests.add(tmdbId);
      return {
        item: {
          releaseDate: '2099-01-01',
          title: `Notification sync movie ${tmdbId}`,
          tmdbId,
        },
      };
    },
  } as unknown as TmdbCatalogueService;
  const releaseEvents = new ReleaseEventsService(catalogue, prisma);
  const notifications = new NotificationsService(auth, prisma, releaseEvents, config);
  const sharedWatchlists = new SharedWatchlistsService(auth, prisma);
  let userIds: string[] = [];

  try {
    const owner = await auth.getOrCreateUser(ownerIdentity);
    const member = await auth.getOrCreateUser(memberIdentity);
    const outsider = await auth.getOrCreateUser(outsiderIdentity);
    userIds = [owner.id, member.id, outsider.id];

    const preservedRelease = await prisma.notification.create({
      data: {
        body: 'Migration preservation sentinel.',
        contentType: TrackedContentType.MOVIE,
        dedupeKey: `release-preservation:${runId}`,
        kind: NotificationKind.RELEASE,
        releaseType: ReleaseNotificationType.MOVIE_RELEASE,
        title: 'Release sentinel',
        tmdbId: 603,
        userId: owner.id,
      },
    });
    const outsiderRelease = await prisma.notification.create({
      data: {
        body: 'Outsider-only notification.',
        contentType: TrackedContentType.MOVIE,
        dedupeKey: `outsider-release:${runId}`,
        kind: NotificationKind.RELEASE,
        releaseType: ReleaseNotificationType.MOVIE_RELEASE,
        title: 'Outsider release',
        tmdbId: 604,
        userId: outsider.id,
      },
    });

    const ownerList = await notifications.list(ownerIdentity);
    assert(
      ownerList.items.some((item) => item.id === preservedRelease.id),
      'Generalized listing must preserve existing release notifications.',
    );
    assert(
      !ownerList.items.some((item) => item.id === outsiderRelease.id),
      'A user must never list another user’s notifications.',
    );
    assert(
      !(await notifications.markRead(ownerIdentity, outsiderRelease.id)).updated,
      'A user must not mark another user’s notification.',
    );
    assert(
      (await notifications.markRead(ownerIdentity, preservedRelease.id)).updated,
      'A user must be able to mark their own notification.',
    );
    await notifications.markAllRead(ownerIdentity);
    const untouchedOutsider = await prisma.notification.findUniqueOrThrow({
      where: { id: outsiderRelease.id },
    });
    assert(untouchedOutsider.readAt === null, 'Mark-all-read must be scoped to the authenticated user.');

    const syncTmdbIds = Array.from({ length: 13 }, (_, index) => 10_000 + index);
    await prisma.releaseEvent.deleteMany({
      where: {
        contentType: TrackedContentType.MOVIE,
        tmdbId: { in: syncTmdbIds },
      },
    });
    await prisma.releaseAlertSubscription.createMany({
      data: syncTmdbIds.map((tmdbId) => ({
        contentType: TrackedContentType.MOVIE,
        tmdbId,
        userId: owner.id,
      })),
    });
    const firstSync = await notifications.sync(ownerIdentity);
    assert(firstSync.syncedContentCount === 13, 'Sync must report every subscribed title.');
    assert(firstSync.createdCount === 13, 'Sync must create notifications beyond the first batch of 12.');
    assert(
      syncTmdbIds.every((tmdbId) => catalogueRequests.has(tmdbId)),
      'Sync must process older subscriptions beyond the first batch of 12.',
    );
    const secondSync = await notifications.sync(ownerIdentity);
    assert(secondSync.createdCount === 0, 'A complete repeated sync must remain idempotent.');

    const watchlist = await sharedWatchlists.createSharedWatchlist(ownerIdentity, 'Notification smoke list');
    await sharedWatchlists.addMember(ownerIdentity, watchlist.id, member.id);
    await sharedWatchlists.addMember(ownerIdentity, watchlist.id, member.id);
    const invites = await prisma.notification.findMany({
      where: {
        kind: NotificationKind.SHARED_LIST_INVITE,
        sharedWatchlistId: watchlist.id,
      },
    });
    assert(invites.length === 1, 'Repeated member addition must not duplicate invite notifications.');
    assert(invites[0]?.userId === member.id, 'Only the invited member must receive the invite.');
    assert(invites[0]?.actorUserId === owner.id, 'Invite notification must identify its actor.');

    const first = await sharedWatchlists.addItem(ownerIdentity, watchlist.id, {
      contentType: 'movie',
      tmdbId: 603,
    });
    const second = await sharedWatchlists.addItem(ownerIdentity, watchlist.id, {
      contentType: 'movie',
      tmdbId: 604,
    });
    const session = await sharedWatchlists.createVotingSession(
      ownerIdentity,
      watchlist.id,
      'Notification smoke vote',
      [first.id, second.id],
    );
    await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      session.id,
      session.candidates[0]!.id,
    );
    await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      session.id,
      session.candidates[1]!.id,
    );
    await sharedWatchlists.removeVote(
      ownerIdentity,
      watchlist.id,
      session.id,
      session.candidates[0]!.id,
    );

    const memberVoteUpdates = await prisma.notification.findMany({
      where: {
        kind: NotificationKind.SHARED_VOTE_UPDATE,
        userId: member.id,
        votingSessionId: session.id,
      },
    });
    assert(
      memberVoteUpdates.length === 1,
      'Vote leader changes must upsert one notification per session and recipient.',
    );
    assert(
      memberVoteUpdates[0]?.actorUserId === owner.id,
      'Vote update must identify the latest actor.',
    );
    const memberVoteNotificationId = memberVoteUpdates[0]!.id;
    await notifications.markRead(memberIdentity, memberVoteNotificationId);
    await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      session.id,
      session.candidates[1]!.id,
    );
    const unchangedLeaderNotification = await prisma.notification.findUniqueOrThrow({
      where: { id: memberVoteNotificationId },
    });
    assert(
      unchangedLeaderNotification.readAt !== null,
      'An idempotent vote that does not change leaders must not reactivate the notification.',
    );

    console.log('Notifications security smoke passed.');
  } finally {
    await cleanup(prisma, userIds);
    await prisma.$disconnect();
  }
}

function createIdentity(providerUserId: string): AuthenticatedIdentity {
  return {
    displayName: 'Notifications smoke user',
    provider: AuthProvider.GOOGLE,
    providerUserId,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanup(prisma: PrismaService, userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { targetUserId: { in: userIds } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.releaseEvent.deleteMany({
    where: {
      contentType: TrackedContentType.MOVIE,
      tmdbId: { gte: 10_000, lte: 10_012 },
    },
  });
}

void main();
