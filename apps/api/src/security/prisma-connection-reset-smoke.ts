import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { FeedService } from '../feed/feed.service';
import { AuthProvider } from '../generated/prisma/enums';
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
  const prisma = new PrismaService(new ConfigService(process.env));
  const auth = new AuthService(prisma);
  const feed = new FeedService(auth, prisma);
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
