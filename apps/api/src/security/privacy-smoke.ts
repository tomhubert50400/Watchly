import 'dotenv/config';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { FeedService } from '../feed/feed.service';
import { FollowsService } from '../follows/follows.service';
import { AuthProvider } from '../generated/prisma/enums';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { ProfileService } from '../profile/profile.service';
import { ProgressService } from '../progress/progress.service';
import { RatingsService } from '../ratings/ratings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { WatchlistsService } from '../watchlists/watchlists.service';

async function main() {
  const runId = Date.now();
  const actorIdentity = createIdentity(`__privacy_smoke_actor_${runId}`);
  const viewerIdentity = createIdentity(`__privacy_smoke_viewer_${runId}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const avatarStorage = new AvatarStorageService(config);
  const profile = new ProfileService(auth, config, prisma, avatarStorage);
  const follows = new FollowsService(auth, prisma);
  const feed = new FeedService(auth, prisma, avatarStorage);
  const blocks = new BlocksService(auth, prisma);
  const ratings = new RatingsService(auth, prisma);
  const progress = new ProgressService(auth, prisma);
  const reviews = new ReviewsService(auth, prisma, avatarStorage);
  const watchlists = new WatchlistsService(auth, prisma);
  let userIds: string[] = [];

  try {
    const actor = await auth.getOrCreateUser(actorIdentity);
    const viewer = await auth.getOrCreateUser(viewerIdentity);
    userIds = [actor.id, viewer.id];

    await assertDefaultPrivacy(profile, actorIdentity);
    await profile.updatePrivacy(actorIdentity, { profileVisibility: 'public' });
    await assertPublicProfileProjection(profile, viewerIdentity, actor.id);
    await assertOwnerOnlyPersonalData(
      profile,
      ratings,
      progress,
      watchlists,
      actorIdentity,
      viewerIdentity,
      actor.id,
    );
    await assertFeedPrivacyAndBlocking(
      profile,
      follows,
      feed,
      blocks,
      ratings,
      reviews,
      actorIdentity,
      viewerIdentity,
      actor.id,
      viewer.id,
    );
    await assertAccountDataExport(profile, actorIdentity);

    console.log('Privacy smoke passed.');
  } finally {
    await cleanup(prisma, userIds);
    await prisma.$disconnect();
  }
}

async function assertAccountDataExport(
  profile: ProfileService,
  identity: AuthenticatedIdentity,
) {
  const exported = await profile.exportAccountData(identity);

  assert(exported.formatVersion === 1, 'Account exports should use a versioned format.');
  assert(
    exported.account.movieRatings.length > 0,
    'Account exports should include the owner ratings.',
  );
  assert(
    exported.account.episodeProgress.length > 0,
    'Account exports should include the owner episode progress.',
  );
  assert(
    exported.account.personalWatchlists.length > 0,
    'Account exports should include personal watchlists and their items.',
  );
  assert(
    exported.account.personalWatchlists.every((watchlist) => 'visibility' in watchlist),
    'Account exports should include personal watchlist visibility.',
  );
  assert(
    exported.account.authIdentities.length > 0,
    'Account exports should identify the linked authentication provider.',
  );
}

async function assertDefaultPrivacy(profile: ProfileService, identity: AuthenticatedIdentity) {
  const me = await profile.getProfile(identity);

  assert(me.privacy.profileVisibility === 'private', 'Profiles should default to private.');
  assert(
    me.privacy.viewingHistoryVisibility === 'private',
    'Viewing history should default to private.',
  );
  assert(
    me.privacy.episodeProgressVisibility === 'private',
    'Episode progress should default to private.',
  );
  assert(me.privacy.ratingsVisibility === 'private', 'Standalone ratings should default to private.');
  assert(
    me.privacy.sharedWatchlistVisibility === 'members',
    'Shared watchlist visibility should default to members.',
  );
  assert(
    me.privacy.reviewsFollowProfileVisibility,
    'Written review visibility should follow profile visibility.',
  );
}

async function assertPublicProfileProjection(
  profile: ProfileService,
  viewerIdentity: AuthenticatedIdentity,
  actorUserId: string,
) {
  const publicProfile = await profile.getPublicProfile(viewerIdentity, actorUserId);
  const keys = Object.keys(publicProfile).sort();

  assert(
    keys.join(',') === 'avatarUrl,canViewContent,displayName,handle,id,media,opinions,profileBackdrop,profileVisibility,stats,viewingStats,watchlists',
    `Public profile projection leaked unexpected fields: ${keys.join(',')}`,
  );
  const statsKeys = Object.keys(publicProfile.stats).sort();
  assert(
    statsKeys.join(',') === 'followersCount,followingCount,postsCount,reviewsCount',
    `Public profile stats leaked unexpected fields: ${statsKeys.join(',')}`,
  );
  const mediaKeys = Object.keys(publicProfile.media).sort();
  assert(
    mediaKeys.join(',') === 'movieRatings,releaseAlerts,seriesProgress,trackingStates',
    `Public profile media leaked unexpected fields: ${mediaKeys.join(',')}`,
  );
}

async function assertOwnerOnlyPersonalData(
  profile: ProfileService,
  ratings: RatingsService,
  progress: ProgressService,
  watchlists: WatchlistsService,
  actorIdentity: AuthenticatedIdentity,
  viewerIdentity: AuthenticatedIdentity,
  actorUserId: string,
) {
  await ratings.upsertMovieRating(actorIdentity, 603, 4.5);
  await progress.markEpisodeWatched(actorIdentity, 1399, 1, 2);
  const watchlist = await watchlists.createWatchlist(actorIdentity, 'Privacy smoke list');
  await watchlists.addItem(actorIdentity, watchlist.id, { contentType: 'movie', tmdbId: 603 });

  assert(watchlist.visibility === 'private', 'Personal watchlists should default to private.');
  assert(
    (await profile.getPublicProfile(viewerIdentity, actorUserId)).watchlists.length === 0,
    'Private personal watchlists must stay off the public profile.',
  );

  const publicWatchlist = await watchlists.updateVisibility(actorIdentity, watchlist.id, 'public');
  assert(publicWatchlist.visibility === 'public', 'Owners should be able to publish a personal watchlist.');
  assert(
    (await profile.getPublicProfile(viewerIdentity, actorUserId)).watchlists.some(
      (item) => item.id === watchlist.id,
    ),
    'A public personal watchlist should appear on the public profile.',
  );

  assert(
    (await ratings.getMovieRating(viewerIdentity, 603)) === null,
    'Movie ratings should be owner-only.',
  );
  assert(
    (await progress.getEpisodeProgress(viewerIdentity, 1399, 1, 2)) === null,
    'Episode progress should be owner-only.',
  );
  assert(
    (await watchlists.listWatchlists(viewerIdentity)).items.length === 0,
    'Personal watchlists should not list for other users.',
  );
  await assertNotFound(
    () => watchlists.getWatchlist(viewerIdentity, watchlist.id),
    'Personal watchlist detail should be owner-only.',
  );
}

async function assertFeedPrivacyAndBlocking(
  profile: ProfileService,
  follows: FollowsService,
  feed: FeedService,
  blocks: BlocksService,
  ratings: RatingsService,
  reviews: ReviewsService,
  actorIdentity: AuthenticatedIdentity,
  viewerIdentity: AuthenticatedIdentity,
  actorUserId: string,
  viewerUserId: string,
) {
  await ratings.upsertMovieRating(actorIdentity, 603, 4);
  await reviews.upsertMovieReview(actorIdentity, 603, 'Privacy smoke public review.');
  await follows.followUser(viewerIdentity, actorUserId);
  await assertFeedContainsAuthor(feed, viewerIdentity, actorUserId, true);
  const initialFeed = await feed.listFeed(viewerIdentity);
  const review = initialFeed.items.find(
    (item) => item.author.id === actorUserId && item.type === 'movieReview',
  );

  assert(Boolean(review), 'Feed should expose the public movie review.');
  if (!review) return;
  assert(review.likeCount === 0, 'A new review should start without likes.');
  assert(!review.likedByViewer, 'A new review should not be liked by the viewer.');

  const liked = await feed.likeMovieReview(viewerIdentity, review.id);
  assert(liked.likeCount === 1 && liked.likedByViewer, 'The viewer should be able to like a public review.');
  const repeatedLike = await feed.likeMovieReview(viewerIdentity, review.id);
  assert(repeatedLike.likeCount === 1, 'Repeated likes should stay idempotent.');
  const likedFeed = await feed.listFeed(viewerIdentity);
  const likedReview = likedFeed.items.find((item) => item.id === review.id);
  assert(
    likedReview?.likeCount === 1 && likedReview.likedByViewer,
    'Feed projection should include the current like count and viewer state.',
  );

  await profile.updatePrivacy(actorIdentity, { profileVisibility: 'private' });
  const acceptedPrivateProjection = await profile.getPublicProfile(viewerIdentity, actorUserId);
  assert(
    acceptedPrivateProjection.profileVisibility === 'private' && acceptedPrivateProjection.canViewContent,
    'An accepted follower should retain access when a profile becomes private.',
  );

  await follows.unfollowUser(viewerIdentity, actorUserId);
  const privateProjection = await profile.getPublicProfile(viewerIdentity, actorUserId);
  assert(
    privateProjection.profileVisibility === 'private' && !privateProjection.canViewContent,
    'A private public projection should report its privacy state.',
  );
  assert(
    privateProjection.avatarUrl === acceptedPrivateProjection.avatarUrl &&
      privateProjection.displayName === acceptedPrivateProjection.displayName &&
      privateProjection.handle === acceptedPrivateProjection.handle &&
      privateProjection.media.movieRatings.length === 0 &&
      privateProjection.media.releaseAlerts.length === 0 &&
      privateProjection.media.seriesProgress.length === 0 &&
      privateProjection.media.trackingStates.length === 0 &&
      privateProjection.opinions.length === 0 &&
      privateProjection.profileBackdrop === null &&
      privateProjection.viewingStats === null &&
      privateProjection.watchlists.length === 0,
    'A private public projection must retain identity while hiding media, opinions, viewing stats, and watchlists.',
  );
  assert(
    privateProjection.stats.followersCount === 0 &&
      privateProjection.stats.followingCount === 0 &&
      privateProjection.stats.postsCount === 0 &&
      privateProjection.stats.reviewsCount === 0,
    'A private public projection must retain social counts without exposing activity totals.',
  );

  const pendingFollow = await follows.followUser(viewerIdentity, actorUserId);
  assert(
    pendingFollow.status === 'pending' && !pendingFollow.following,
    'Following a private profile should create a pending request.',
  );
  const requests = await follows.listPendingRequests(actorIdentity);
  assert(
    requests.items.some((request) => request.userId === viewerUserId),
    'The private profile owner should receive the follow request.',
  );
  await follows.acceptRequest(actorIdentity, viewerUserId);
  const approvedProjection = await profile.getPublicProfile(viewerIdentity, actorUserId);
  assert(
    approvedProjection.canViewContent && approvedProjection.displayName !== null,
    'An accepted requester should be able to view the private profile.',
  );
  await assertFeedContainsAuthor(feed, viewerIdentity, actorUserId, false);
  await assertNotFound(
    () => feed.likeMovieReview(viewerIdentity, review.id),
    'Private reviews should not accept likes.',
  );

  await profile.updatePrivacy(actorIdentity, { profileVisibility: 'public' });
  await assertFeedContainsAuthor(feed, viewerIdentity, actorUserId, true);
  const unliked = await feed.unlikeMovieReview(viewerIdentity, review.id);
  assert(
    unliked.likeCount === 0 && !unliked.likedByViewer,
    'The viewer should be able to remove a like from a visible review.',
  );

  await blocks.blockUser(viewerIdentity, actorUserId);
  await assertFeedContainsAuthor(feed, viewerIdentity, actorUserId, false);
  await assertNotFound(
    () => feed.likeMovieReview(viewerIdentity, review.id),
    'Blocked reviews should not accept likes.',
  );

  const followState = await follows.getFollowState(viewerIdentity, actorUserId);
  assert(!followState.following, 'Blocking should clear follow state between the two users.');
}

async function assertFeedContainsAuthor(
  feed: FeedService,
  viewerIdentity: AuthenticatedIdentity,
  authorId: string,
  expected: boolean,
) {
  const result = await feed.listFeed(viewerIdentity);
  const containsAuthor = result.items.some((item) => item.author.id === authorId);

  assert(
    containsAuthor === expected,
    expected ? 'Feed should include visible followed reviews.' : 'Feed should hide this author.',
  );
}

async function assertNotFound<T>(operation: () => Promise<T>, message: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof NotFoundException) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

function createIdentity(providerUserId: string): AuthenticatedIdentity {
  return {
    displayName: 'Privacy smoke user',
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
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          targetUserId: {
            in: userIds,
          },
        },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds,
      },
    },
  });
}

void main();
