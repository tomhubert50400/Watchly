import 'dotenv/config';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { FeedService } from '../feed/feed.service';
import { AuthProvider } from '../generated/prisma/enums';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { ProgressService } from '../progress/progress.service';
import { RatingsService } from '../ratings/ratings.service';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';
import { TrackingService } from '../tracking/tracking.service';
import { WatchlistsService } from '../watchlists/watchlists.service';

const identity: AuthenticatedIdentity = {
  displayName: 'Prisma reset smoke user',
  provider: AuthProvider.GOOGLE,
  providerUserId: `__prisma_reset_smoke_${Date.now()}`,
};

async function main() {
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const feed = new FeedService(auth, prisma, new AvatarStorageService(config));
  const progress = new ProgressService(auth, prisma);
  const ratings = new RatingsService(auth, prisma);
  const sharedWatchlists = new SharedWatchlistsService(auth, prisma);
  const tracking = new TrackingService(auth, prisma);
  const watchlists = new WatchlistsService(auth, prisma);
  let userId: string | null = null;

  try {
    const user = await auth.getOrCreateUser(identity);

    userId = user.id;

    await tracking.upsertState(identity, {
      contentType: 'movie',
      status: 'watchlisted',
      tmdbId: 603,
    });

    const beforeReset = await tracking.listStates(identity);

    await closeCurrentPool(prisma);

    await Promise.all([
      feed.listFeed(identity),
      progress.listSeriesProgressSummaries(identity),
      ratings.listMovieRatings(identity),
      sharedWatchlists.listSharedWatchlists(identity, 'movie', 603),
      watchlists.listWatchlists(identity, 'movie', 603),
    ]);

    const personalLists = await Promise.all([
      watchlists.createWatchlist(identity, 'Prisma reset personal A'),
      watchlists.createWatchlist(identity, 'Prisma reset personal B'),
    ]);
    const sharedList = await sharedWatchlists.createSharedWatchlist(
      identity,
      'Prisma reset shared',
    );
    const additions = [
      () => watchlists.addItem(
        identity,
        personalLists[0]!.id,
        { contentType: 'movie', tmdbId: 603 },
      ),
      () => watchlists.addItem(
        identity,
        personalLists[1]!.id,
        { contentType: 'movie', tmdbId: 603 },
      ),
      () => sharedWatchlists.addItem(
        identity,
        sharedList.id,
        { contentType: 'movie', tmdbId: 603 },
      ),
    ];

    for (const add of additions) await add();
    for (const add of additions) await add();

    const [personalA, personalB, shared] = await Promise.all([
      watchlists.getWatchlist(identity, personalLists[0]!.id),
      watchlists.getWatchlist(identity, personalLists[1]!.id),
      sharedWatchlists.getSharedWatchlist(identity, sharedList.id),
    ]);
    [personalA, personalB, shared].forEach((watchlist) => {
      assert.equal(
        watchlist.items.filter((item) => item.contentType === 'movie' && item.tmdbId === 603).length,
        1,
        'repeated multi-list additions must stay idempotent',
      );
    });

    const afterReset = await tracking.listStates(identity);
    const recoveredState = afterReset.find((state) => state.contentType === 'movie' && state.tmdbId === 603);

    if (beforeReset.length === 0 || !recoveredState) {
      throw new Error(`Unexpected tracking state after Prisma reset: ${JSON.stringify(afterReset)}`);
    }

    console.log('Prisma connection reset smoke passed.');
  } finally {
    if (userId) {
      const cleanupUserId = userId;

      await prisma.withConnectionRetry(() =>
        prisma.user.delete({
          where: {
            id: cleanupUserId,
          },
        }),
      );
    }

    await prisma.$disconnect();
  }
}

async function closeCurrentPool(prisma: PrismaService) {
  await (prisma as unknown as { pool: { end: () => Promise<void> } }).pool.end();
}

void main();
