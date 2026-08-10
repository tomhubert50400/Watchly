import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  AuthProvider,
  FollowStatus,
  NotificationKind,
  PrivacyVisibility,
  ReleaseNotificationType,
  SharedWatchlistVisibility,
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';

@Injectable()
export class DevUiReviewService {
  private readonly sampleFriendName = 'Maya Chen';
  private readonly sampleFriendHandle = 'maya_chen_ui';
  private readonly samplePersonalWatchlistName = 'Weekend Queue';
  private readonly sampleSharedWatchlistName = 'Friday Shared Night';

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async prepare(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);
    const testUser = await this.getOrCreateTestUser();

    await this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
        data: {
          displayName: user.displayName ?? identity.displayName ?? 'UI review user',
          handle: user.handle ?? `review_${user.id.replace(/-/g, '').slice(0, 10)}`,
          onboardingCompleted: true,
          privacySettings: {
            upsert: {
              create: publicReviewPrivacy(),
              update: publicReviewPrivacy(),
            },
          },
        },
        where: { id: user.id },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userBlock.deleteMany({
        where: {
          OR: [
            { blockedUserId: testUser.id, blockerId: user.id },
            { blockedUserId: user.id, blockerId: testUser.id },
          ],
        },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userFollow.upsert({
        create: { followedUserId: testUser.id, followerId: user.id, status: FollowStatus.ACCEPTED },
        update: { status: FollowStatus.ACCEPTED },
        where: {
          followerId_followedUserId: {
            followedUserId: testUser.id,
            followerId: user.id,
          },
        },
      }),
    );

    await this.seedReviews(user.id, testUser.id);
    await this.seedTracking(user.id);
    const personalWatchlist = await this.seedPersonalWatchlist(user.id);
    const sharedWatchlist = await this.seedSharedWatchlist(user.id, testUser.id);
    const votingSession = await this.seedVotingSession(user.id, testUser.id, sharedWatchlist.id);
    await this.seedReleaseAlerts(user.id);

    return {
      feedReviewSource: {
        displayName: testUser.displayName,
        userId: testUser.id,
      },
      personalWatchlistId: personalWatchlist.id,
      prepared: true,
      seededTitles: [
        { contentType: 'movie', label: 'The Matrix', tmdbId: 603 },
        { contentType: 'movie', label: 'Avatar', tmdbId: 19995 },
        { contentType: 'series', label: 'Game of Thrones', tmdbId: 1399 },
        { contentType: 'series', label: 'Loki', tmdbId: 84958 },
      ],
      sharedWatchlistId: sharedWatchlist.id,
      testUser: {
        displayName: testUser.displayName,
        userId: testUser.id,
      },
      userId: user.id,
      votingSessionId: votingSession.id,
    };
  }

  private async getOrCreateTestUser() {
    const identityKey = {
      provider: AuthProvider.GOOGLE,
      providerUserId: '__dev_ui_review_profile__',
    };
    const identity = await this.prisma.withConnectionRetry(() =>
      this.prisma.authIdentity.findUnique({
        where: { provider_providerUserId: identityKey },
      }),
    );

    if (identity) {
      return this.prisma.withConnectionRetry(() =>
        this.prisma.user.update({
        data: {
            displayName: this.sampleFriendName,
            handle: this.sampleFriendHandle,
            onboardingCompleted: true,
            privacySettings: {
              upsert: {
                create: publicReviewPrivacy(),
                update: publicReviewPrivacy(),
              },
            },
          },
          where: { id: identity.userId },
        }),
      );
    }

    return this.prisma.withConnectionRetry(() =>
      this.prisma.user.create({
        data: {
          authIdentities: { create: identityKey },
          displayName: this.sampleFriendName,
          handle: this.sampleFriendHandle,
          onboardingCompleted: true,
          privacySettings: { create: publicReviewPrivacy() },
        },
      }),
    );
  }

  private async seedReviews(userId: string, testUserId: string) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieReview.upsert({
        create: {
          body: 'Still sharp, stylish, and impossible not to talk about after a rewatch.',
          tmdbId: 603,
          userId: testUserId,
        },
        update: {
          body: 'Still sharp, stylish, and impossible not to talk about after a rewatch.',
        },
        where: { userId_tmdbId: { tmdbId: 603, userId: testUserId } },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.upsert({
        create: { scoreHalfSteps: 9, tmdbId: 603, userId: testUserId },
        update: { scoreHalfSteps: 9 },
        where: { userId_tmdbId: { tmdbId: 603, userId: testUserId } },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieReview.upsert({
        create: {
          body: 'Matrix still feels sharp, stylish, and easy to revisit.',
          tmdbId: 603,
          userId,
        },
        update: {
          body: 'Matrix still feels sharp, stylish, and easy to revisit.',
        },
        where: { userId_tmdbId: { tmdbId: 603, userId } },
      }),
    );

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userEpisodeReview.upsert({
        create: {
          body: 'A strong pilot with enough tension to make the next episode feel unavoidable.',
          episodeNumber: 1,
          seasonNumber: 1,
          seriesTmdbId: 1399,
          userId,
        },
        update: {
          body: 'A strong pilot with enough tension to make the next episode feel unavoidable.',
        },
        where: {
          userId_seriesTmdbId_seasonNumber_episodeNumber: {
            episodeNumber: 1,
            seasonNumber: 1,
            seriesTmdbId: 1399,
            userId,
          },
        },
      }),
    );
  }

  private async seedTracking(userId: string) {
    const states = [
      [TrackedContentType.MOVIE, 603, UserContentStatus.WATCHED, true],
      [TrackedContentType.MOVIE, 19995, UserContentStatus.WATCHLISTED, false],
      [TrackedContentType.SERIES, 1399, UserContentStatus.WATCHING, true],
      [TrackedContentType.SERIES, 84958, UserContentStatus.DROPPED, false],
    ] as const;

    for (const [contentType, tmdbId, status, favorite] of states) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.userContentState.upsert({
          create: { contentType, favorite, status, tmdbId, userId },
          update: { favorite, status },
          where: { userId_contentType_tmdbId: { contentType, tmdbId, userId } },
        }),
      );
    }

    await this.prisma.withConnectionRetry(() =>
      this.prisma.userMovieRating.upsert({
        create: { scoreHalfSteps: 9, tmdbId: 603, userId },
        update: { scoreHalfSteps: 9 },
        where: { userId_tmdbId: { tmdbId: 603, userId } },
      }),
    );

    for (const [episodeNumber, scoreHalfSteps] of [
      [1, 8],
      [2, 9],
      [3, 7],
      [4, 8],
      [5, 9],
      [6, 8],
    ] as const) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.userEpisodeRating.upsert({
          create: { episodeNumber, scoreHalfSteps, seasonNumber: 1, seriesTmdbId: 1399, userId },
          update: { scoreHalfSteps },
          where: {
            userId_seriesTmdbId_seasonNumber_episodeNumber: {
              episodeNumber,
              seasonNumber: 1,
              seriesTmdbId: 1399,
              userId,
            },
          },
        }),
      );
    }

    for (const episodeNumber of [1, 2, 3, 4, 5]) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.userEpisodeProgress.upsert({
          create: { episodeNumber, seasonNumber: 1, seriesTmdbId: 1399, userId },
          update: { watchedAt: new Date() },
          where: {
            userId_seriesTmdbId_seasonNumber_episodeNumber: {
              episodeNumber,
              seasonNumber: 1,
              seriesTmdbId: 1399,
              userId,
            },
          },
        }),
      );
    }
  }

  private async seedPersonalWatchlist(userId: string) {
    const watchlist = await this.getOrCreatePersonalWatchlist(
      userId,
      this.samplePersonalWatchlistName,
      'UI Review Personal Queue',
    );

    await this.addPersonalItem(watchlist.id, TrackedContentType.MOVIE, 603);
    await this.addPersonalItem(watchlist.id, TrackedContentType.MOVIE, 19995);
    await this.addPersonalItem(watchlist.id, TrackedContentType.SERIES, 1399);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.personalWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlist.id },
      }),
    );
  }

  private async getOrCreatePersonalWatchlist(userId: string, name: string, legacyName?: string) {
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.personalWatchlist.findFirst({
        where: {
          userId,
          OR: [{ name }, ...(legacyName ? [{ name: legacyName }] : [])],
        },
      }),
    );

    if (existing) {
      return this.prisma.withConnectionRetry(() =>
        this.prisma.personalWatchlist.update({
          data: { name },
          where: { id: existing.id },
        }),
      );
    }

    return this.prisma.withConnectionRetry(() =>
      this.prisma.personalWatchlist.create({ data: { name, userId } }),
    );
  }

  private async addPersonalItem(watchlistId: string, contentType: TrackedContentType, tmdbId: number) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.personalWatchlistItem.upsert({
        create: { contentType, tmdbId, watchlistId },
        update: {},
        where: { watchlistId_contentType_tmdbId: { contentType, tmdbId, watchlistId } },
      }),
    );
  }

  private async seedSharedWatchlist(userId: string, testUserId: string) {
    const watchlist = await this.getOrCreateSharedWatchlist(
      userId,
      this.sampleSharedWatchlistName,
      'UI Review Shared Night',
    );

    await this.addSharedMember(watchlist.id, userId);
    await this.addSharedMember(watchlist.id, testUserId);
    await this.addSharedItem(watchlist.id, TrackedContentType.MOVIE, 603);
    await this.addSharedItem(watchlist.id, TrackedContentType.MOVIE, 19995);
    await this.addSharedItem(watchlist.id, TrackedContentType.SERIES, 1399);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.update({
        data: { updatedAt: new Date() },
        where: { id: watchlist.id },
      }),
    );
  }

  private async getOrCreateSharedWatchlist(ownerId: string, name: string, legacyName?: string) {
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.findFirst({
        where: {
          ownerId,
          OR: [{ name }, ...(legacyName ? [{ name: legacyName }] : [])],
        },
      }),
    );

    if (existing) {
      return this.prisma.withConnectionRetry(() =>
        this.prisma.sharedWatchlist.update({
          data: { name },
          where: { id: existing.id },
        }),
      );
    }

    return this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.create({
        data: {
          members: { create: { userId: ownerId } },
          name,
          ownerId,
        },
      }),
    );
  }

  private async addSharedMember(watchlistId: string, userId: string) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlistMember.upsert({
        create: { userId, watchlistId },
        update: {},
        where: { watchlistId_userId: { userId, watchlistId } },
      }),
    );
  }

  private async addSharedItem(watchlistId: string, contentType: TrackedContentType, tmdbId: number) {
    return this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlistItem.upsert({
        create: { contentType, tmdbId, watchlistId },
        update: {},
        where: { watchlistId_contentType_tmdbId: { contentType, tmdbId, watchlistId } },
      }),
    );
  }

  private async seedVotingSession(userId: string, testUserId: string, watchlistId: string) {
    const session = await this.getOrCreateVotingSession(watchlistId, 'Tonight');
    const items = await this.prisma.withConnectionRetry(() =>
      this.prisma.sharedWatchlistItem.findMany({
        orderBy: { createdAt: 'asc' },
        where: { watchlistId },
      }),
    );
    const candidates = [];

    for (const item of items) {
      const candidate = await this.prisma.withConnectionRetry(() =>
        this.prisma.sharedVotingCandidate.upsert({
          create: { itemId: item.id, sessionId: session.id },
          update: {},
          where: { sessionId_itemId: { itemId: item.id, sessionId: session.id } },
        }),
      );

      candidates.push(candidate);
    }

    if (candidates[0]) {
      await this.vote(candidates[0].id, userId);
      await this.vote(candidates[0].id, testUserId);
    }

    if (candidates[1]) {
      await this.vote(candidates[1].id, testUserId);
    }

    return session;
  }

  private async getOrCreateVotingSession(watchlistId: string, title: string) {
    const existing = await this.prisma.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.findFirst({ where: { title, watchlistId } }),
    );

    if (existing) {
      return existing;
    }

    return this.prisma.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.create({ data: { title, watchlistId } }),
    );
  }

  private async vote(candidateId: string, userId: string) {
    await this.prisma.withConnectionRetry(() =>
      this.prisma.sharedVotingVote.upsert({
        create: { candidateId, userId },
        update: {},
        where: { candidateId_userId: { candidateId, userId } },
      }),
    );
  }

  private async seedReleaseAlerts(userId: string) {
    for (const [contentType, tmdbId] of [
      [TrackedContentType.MOVIE, 603],
      [TrackedContentType.SERIES, 1399],
    ] as const) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.releaseAlertSubscription.upsert({
          create: { contentType, tmdbId, userId },
          update: {},
          where: { userId_contentType_tmdbId: { contentType, tmdbId, userId } },
        }),
      );
    }

    const notifications = [
      {
        body: 'Sample film release alert for the detail-screen bell review.',
        contentType: TrackedContentType.MOVIE,
        dedupeKey: 'ui-review:movie:matrix',
        kind: NotificationKind.RELEASE,
        readAt: null,
        releasedAt: new Date('1999-03-31T00:00:00.000Z'),
        releaseType: ReleaseNotificationType.MOVIE_RELEASE,
        title: 'The Matrix release check',
        tmdbId: 603,
      },
      {
        body: 'Sample new-season alert for the detail-screen bell review.',
        contentType: TrackedContentType.SERIES,
        dedupeKey: 'ui-review:series:got:s1',
        kind: NotificationKind.RELEASE,
        readAt: null,
        releasedAt: new Date('2011-04-17T00:00:00.000Z'),
        releaseType: ReleaseNotificationType.SEASON_RELEASE,
        seasonNumber: 1,
        title: 'Game of Thrones: Season 1',
        tmdbId: 1399,
      },
    ];

    for (const notification of notifications) {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.notification.upsert({
          create: { ...notification, userId },
          update: notification,
          where: {
            userId_dedupeKey: {
              dedupeKey: notification.dedupeKey,
              userId,
            },
          },
        }),
      );
    }
  }
}

function publicReviewPrivacy() {
  return {
    profileVisibility: PrivacyVisibility.PUBLIC,
    reviewsVisibility: PrivacyVisibility.PUBLIC,
    sharedWatchlistVisibility: SharedWatchlistVisibility.MEMBERS,
  };
}
