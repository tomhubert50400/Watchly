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
  const profile = new ProfileService(auth, config, prisma);
  const follows = new FollowsService(auth, prisma);
  const feed = new FeedService(auth, prisma);
  const blocks = new BlocksService(auth, prisma);
  const ratings = new RatingsService(auth, prisma);
  const progress = new ProgressService(auth, prisma);
  const reviews = new ReviewsService(auth, prisma);
  const watchlists = new WatchlistsService(auth, prisma);
  let userIds: string[] = [];

  try {
    const actor = await auth.getOrCreateUser(actorIdentity);
    const viewer = await auth.getOrCreateUser(viewerIdentity);
    userIds = [actor.id, viewer.id];

    await assertDefaultPrivacy(profile, actorIdentity);
    await assertPublicProfileProjection(profile, viewerIdentity, actor.id);
    await assertOwnerOnlyPersonalData(
      ratings,
      progress,
      watchlists,
      actorIdentity,
      viewerIdentity,
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
    );

    console.log('Privacy smoke passed.');
  } finally {
    await cleanup(prisma, userIds);
    await prisma.$disconnect();
  }
}

async function assertDefaultPrivacy(profile: ProfileService, identity: AuthenticatedIdentity) {
  const me = await profile.getProfile(identity);

  assert(me.privacy.profileVisibility === 'public', 'Profiles should default to public.');
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
    keys.join(',') === 'displayName,id,profileVisibility,stats',
    `Public profile projection leaked unexpected fields: ${keys.join(',')}`,
  );
  const statsKeys = Object.keys(publicProfile.stats).sort();
  assert(
    statsKeys.join(',') === 'followersCount,followingCount,postsCount,reviewsCount',
    `Public profile stats leaked unexpected fields: ${statsKeys.join(',')}`,
  );
}

async function assertOwnerOnlyPersonalData(
  ratings: RatingsService,
  progress: ProgressService,
  watchlists: WatchlistsService,
  actorIdentity: AuthenticatedIdentity,
  viewerIdentity: AuthenticatedIdentity,
) {
  await ratings.upsertMovieRating(actorIdentity, 603, 4.5);
  await progress.markEpisodeWatched(actorIdentity, 1399, 1, 2);
  const watchlist = await watchlists.createWatchlist(actorIdentity, 'Privacy smoke list');
  await watchlists.addItem(actorIdentity, watchlist.id, { contentType: 'movie', tmdbId: 603 });

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
