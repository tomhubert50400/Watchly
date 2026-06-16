import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  AuthProvider,
  PrivacyVisibility,
  ReleaseNotificationType,
  SharedWatchlistVisibility,
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const sampleFriendName = 'Maya Chen';
const samplePersonalWatchlistName = 'Weekend Queue';
const sampleSharedWatchlistName = 'Friday Shared Night';

async function main() {
  const user = await getReviewUser();
  const testUser = await getOrCreateTestUser();

  await prisma.user.update({
    data: {
      displayName: user.displayName ?? 'Tom HUb',
      onboardingCompleted: true,
      privacySettings: {
        upsert: {
          create: publicReviewPrivacy(),
          update: publicReviewPrivacy(),
        },
      },
    },
    where: { id: user.id },
  });

  await prisma.userBlock.deleteMany({
    where: {
      OR: [
        { blockedUserId: testUser.id, blockerId: user.id },
        { blockedUserId: user.id, blockerId: testUser.id },
      ],
    },
  });

  await prisma.userFollow.upsert({
    create: { followedUserId: testUser.id, followerId: user.id },
    update: {},
    where: {
      followerId_followedUserId: {
        followedUserId: testUser.id,
        followerId: user.id,
      },
    },
  });

  await seedReviews(user.id, testUser.id);
  await seedTracking(user.id);
  const personalWatchlist = await seedPersonalWatchlist(user.id);
  const sharedWatchlist = await seedSharedWatchlist(user.id, testUser.id);
  const votingSession = await seedVotingSession(user.id, testUser.id, sharedWatchlist.id);
  await seedReleaseAlerts(user.id);

  console.log(
    JSON.stringify(
      {
        personalWatchlistId: personalWatchlist.id,
        sharedWatchlistId: sharedWatchlist.id,
        testUserId: testUser.id,
        userId: user.id,
        votingSessionId: votingSession.id,
      },
      null,
      2,
    ),
  );
}

async function getReviewUser() {
  const explicitUserId = process.env.UI_REVIEW_USER_ID;

  if (explicitUserId) {
    return prisma.user.findUniqueOrThrow({ where: { id: explicitUserId } });
  }

  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    where: {
      authIdentities: {
        some: {
          providerUserId: {
            not: '__dev_block_test_profile__',
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('No signed-in review user found. Sign in once, then rerun this script.');
  }

  return user;
}

async function getOrCreateTestUser() {
  const identityKey = {
    provider: AuthProvider.GOOGLE,
    providerUserId: '__dev_block_test_profile__',
  };
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: identityKey },
  });

  if (identity) {
    return prisma.user.update({
      data: {
        displayName: sampleFriendName,
        onboardingCompleted: true,
        privacySettings: {
          upsert: {
            create: publicReviewPrivacy(),
            update: publicReviewPrivacy(),
          },
        },
      },
      where: { id: identity.userId },
    });
  }

  return prisma.user.create({
    data: {
      authIdentities: { create: identityKey },
      displayName: sampleFriendName,
      onboardingCompleted: true,
      privacySettings: { create: publicReviewPrivacy() },
    },
  });
}

async function seedReviews(userId: string, testUserId: string) {
  await prisma.userMovieReview.upsert({
    create: {
      body: 'Still sharp, stylish, and impossible not to talk about after a rewatch.',
      tmdbId: 603,
      userId: testUserId,
    },
    update: {
      body: 'Still sharp, stylish, and impossible not to talk about after a rewatch.',
    },
    where: { userId_tmdbId: { tmdbId: 603, userId: testUserId } },
  });

  await prisma.userMovieReview.upsert({
    create: {
      body: 'Matrix still feels sharp, stylish, and easy to revisit.',
      tmdbId: 603,
      userId,
    },
    update: {
      body: 'Matrix still feels sharp, stylish, and easy to revisit.',
    },
    where: { userId_tmdbId: { tmdbId: 603, userId } },
  });

  await prisma.userEpisodeReview.upsert({
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
  });
}

async function seedTracking(userId: string) {
  const states = [
    [TrackedContentType.MOVIE, 603, UserContentStatus.WATCHED, true],
    [TrackedContentType.MOVIE, 19995, UserContentStatus.WATCHLISTED, false],
    [TrackedContentType.SERIES, 1399, UserContentStatus.WATCHING, true],
    [TrackedContentType.SERIES, 84958, UserContentStatus.DROPPED, false],
  ] as const;

  for (const [contentType, tmdbId, status, favorite] of states) {
    await prisma.userContentState.upsert({
      create: { contentType, favorite, status, tmdbId, userId },
      update: { favorite, status },
      where: { userId_contentType_tmdbId: { contentType, tmdbId, userId } },
    });
  }

  await prisma.userMovieRating.upsert({
    create: { scoreHalfSteps: 9, tmdbId: 603, userId },
    update: { scoreHalfSteps: 9 },
    where: { userId_tmdbId: { tmdbId: 603, userId } },
  });

  for (const [episodeNumber, scoreHalfSteps] of [
    [1, 8],
    [2, 9],
    [3, 7],
    [4, 8],
    [5, 9],
    [6, 8],
  ] as const) {
    await prisma.userEpisodeRating.upsert({
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
    });
  }

  for (const episodeNumber of [1, 2, 3, 4, 5]) {
    await prisma.userEpisodeProgress.upsert({
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
    });
  }
}

async function seedPersonalWatchlist(userId: string) {
  const watchlist = await getOrCreatePersonalWatchlist(userId, samplePersonalWatchlistName, [
    'M11 Personal Queue',
    'UI Review Personal Queue',
  ]);

  await addPersonalItem(watchlist.id, TrackedContentType.MOVIE, 603);
  await addPersonalItem(watchlist.id, TrackedContentType.MOVIE, 19995);
  await addPersonalItem(watchlist.id, TrackedContentType.SERIES, 1399);

  return prisma.personalWatchlist.update({
    data: { updatedAt: new Date() },
    where: { id: watchlist.id },
  });
}

async function getOrCreatePersonalWatchlist(userId: string, name: string, legacyNames: string[] = []) {
  const existing = await prisma.personalWatchlist.findFirst({
    where: { name: { in: [name, ...legacyNames] }, userId },
  });

  if (existing) {
    return prisma.personalWatchlist.update({
      data: { name },
      where: { id: existing.id },
    });
  }

  return prisma.personalWatchlist.create({ data: { name, userId } });
}

async function addPersonalItem(
  watchlistId: string,
  contentType: TrackedContentType,
  tmdbId: number,
) {
  await prisma.personalWatchlistItem.upsert({
    create: { contentType, tmdbId, watchlistId },
    update: {},
    where: { watchlistId_contentType_tmdbId: { contentType, tmdbId, watchlistId } },
  });
}

async function seedSharedWatchlist(userId: string, testUserId: string) {
  const watchlist = await getOrCreateSharedWatchlist(userId, sampleSharedWatchlistName, [
    'M11 Shared Night',
    'UI Review Shared Night',
  ]);

  await prisma.sharedWatchlistMember.upsert({
    create: { userId, watchlistId: watchlist.id },
    update: {},
    where: { watchlistId_userId: { userId, watchlistId: watchlist.id } },
  });
  await prisma.sharedWatchlistMember.upsert({
    create: { userId: testUserId, watchlistId: watchlist.id },
    update: {},
    where: { watchlistId_userId: { userId: testUserId, watchlistId: watchlist.id } },
  });

  await addSharedItem(watchlist.id, TrackedContentType.MOVIE, 603);
  await addSharedItem(watchlist.id, TrackedContentType.MOVIE, 19995);
  await addSharedItem(watchlist.id, TrackedContentType.SERIES, 1399);

  return prisma.sharedWatchlist.update({
    data: { updatedAt: new Date() },
    where: { id: watchlist.id },
  });
}

async function getOrCreateSharedWatchlist(ownerId: string, name: string, legacyNames: string[] = []) {
  const existing = await prisma.sharedWatchlist.findFirst({
    where: { name: { in: [name, ...legacyNames] }, ownerId },
  });

  if (existing) {
    return prisma.sharedWatchlist.update({
      data: { name },
      where: { id: existing.id },
    });
  }

  return prisma.sharedWatchlist.create({
    data: {
      members: { create: { userId: ownerId } },
      name,
      ownerId,
    },
  });
}

async function addSharedItem(
  watchlistId: string,
  contentType: TrackedContentType,
  tmdbId: number,
) {
  return prisma.sharedWatchlistItem.upsert({
    create: { contentType, tmdbId, watchlistId },
    update: {},
    where: { watchlistId_contentType_tmdbId: { contentType, tmdbId, watchlistId } },
  });
}

async function seedVotingSession(userId: string, testUserId: string, watchlistId: string) {
  const session = await getOrCreateVotingSession(watchlistId, 'Tonight');
  const items = await prisma.sharedWatchlistItem.findMany({
    orderBy: { createdAt: 'asc' },
    where: { watchlistId },
  });
  const candidates = [];

  for (const item of items) {
    const candidate = await prisma.sharedVotingCandidate.upsert({
      create: { itemId: item.id, sessionId: session.id },
      update: {},
      where: { sessionId_itemId: { itemId: item.id, sessionId: session.id } },
    });

    candidates.push(candidate);
  }

  if (candidates[0]) {
    await vote(candidates[0].id, userId);
    await vote(candidates[0].id, testUserId);
  }

  if (candidates[1]) {
    await vote(candidates[1].id, testUserId);
  }

  return session;
}

async function getOrCreateVotingSession(watchlistId: string, title: string) {
  const existing = await prisma.sharedVotingSession.findFirst({ where: { title, watchlistId } });

  if (existing) {
    return existing;
  }

  return prisma.sharedVotingSession.create({ data: { title, watchlistId } });
}

async function vote(candidateId: string, userId: string) {
  await prisma.sharedVotingVote.upsert({
    create: { candidateId, userId },
    update: {},
    where: { candidateId_userId: { candidateId, userId } },
  });
}

async function seedReleaseAlerts(userId: string) {
  for (const [contentType, tmdbId] of [
    [TrackedContentType.MOVIE, 603],
    [TrackedContentType.SERIES, 1399],
  ] as const) {
    await prisma.releaseAlertSubscription.upsert({
      create: { contentType, tmdbId, userId },
      update: {},
      where: { userId_contentType_tmdbId: { contentType, tmdbId, userId } },
    });
  }

  await prisma.releaseNotification.deleteMany({
    where: {
      generatedKey: {
        in: ['m11:series:got:s1e6'],
      },
      userId,
    },
  });

  const notifications = [
    {
      body: 'The Matrix is ready for a release-alert card check.',
      contentType: TrackedContentType.MOVIE,
      generatedKey: 'm11:movie:matrix',
      readAt: null,
      releasedAt: new Date('1999-03-31T00:00:00.000Z'),
      title: 'The Matrix release check',
      tmdbId: 603,
      type: ReleaseNotificationType.MOVIE_RELEASE,
    },
    {
      body: 'A new-season alert is ready for the bell flow.',
      contentType: TrackedContentType.SERIES,
      generatedKey: 'm11:series:got:s1',
      readAt: null,
      releasedAt: new Date('2011-04-17T00:00:00.000Z'),
      seasonNumber: 1,
      title: 'Game of Thrones: Season 1',
      tmdbId: 1399,
      type: ReleaseNotificationType.SEASON_RELEASE,
    },
  ];

  for (const notification of notifications) {
    await prisma.releaseNotification.upsert({
      create: { ...notification, userId },
      update: notification,
      where: {
        userId_generatedKey: {
          generatedKey: notification.generatedKey,
          userId,
        },
      },
    });
  }
}

function publicReviewPrivacy() {
  return {
    profileVisibility: PrivacyVisibility.PUBLIC,
    reviewsVisibility: PrivacyVisibility.PUBLIC,
    sharedWatchlistVisibility: SharedWatchlistVisibility.MEMBERS,
  };
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
