import 'dotenv/config';
import { strToU8, zipSync } from 'fflate';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider, DataImportStatus, TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { ImportsService } from '../imports/imports.service';

async function main() {
  const providerUserId = `__import_smoke_${Date.now()}`;
  const identity: AuthenticatedIdentity = {
    displayName: 'Import smoke user',
    emailVerified: false,
    firebaseUid: providerUserId,
    provider: AuthProvider.GOOGLE,
    providerUserId,
  };
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const catalogue = new TmdbCatalogueService(config, prisma);
  const imports = new ImportsService(auth, catalogue, prisma);
  let userId: string | null = null;

  try {
    const user = await auth.getOrCreateUser(identity);
    userId = user.id;
    const persistedUserId = user.id;
    const preview = await imports.preview(identity, 'letterboxd', {
      buffer: Buffer.from([
        'tmdbID,Title,Year,Rating,WatchedDate,Review',
        '949,Heat,1995,4.5,2025-01-02,"Import smoke review."',
      ].join('\n')),
      originalname: 'diary.csv',
      size: 115,
    });

    assert(preview.summary.ready === 1, 'The TMDB ID should produce one ready match.');
    const result = await imports.confirm(identity, preview.importId);
    assert(result.titlesProcessed === 1, 'The import should process one title.');
    assert(result.ratingsCreated === 1, 'The import should create the rating.');
    assert(result.reviewsCreated === 1, 'The import should create the review.');
    assert(result.viewingEventsCreated === 1, 'The import should preserve the viewing date.');

    const rating = await prisma.withConnectionRetry(() =>
      prisma.userMovieRating.findUnique({ where: { userId_tmdbId: { tmdbId: 949, userId: persistedUserId } } }),
    );
    const review = await prisma.withConnectionRetry(() =>
      prisma.userMovieReview.findUnique({ where: { userId_tmdbId: { tmdbId: 949, userId: persistedUserId } } }),
    );
    const state = await prisma.withConnectionRetry(() =>
      prisma.userContentState.findUnique({
        where: {
          userId_contentType_tmdbId: {
            contentType: TrackedContentType.MOVIE,
            tmdbId: 949,
            userId: persistedUserId,
          },
        },
      }),
    );
    const viewing = await prisma.withConnectionRetry(() =>
      prisma.viewingEvent.findFirst({ where: { tmdbId: 949, userId: persistedUserId } }),
    );
    const batch = await prisma.withConnectionRetry(() =>
      prisma.dataImport.findUnique({ where: { id: preview.importId } }),
    );

    assert(rating?.scoreHalfSteps === 9, 'The 4.5 rating should be stored as nine half-steps.');
    assert(review?.body === 'Import smoke review.', 'The review body should be preserved.');
    assert(state?.status === UserContentStatus.WATCHED, 'The movie should be marked watched.');
    assert(viewing?.watchedAt?.toISOString().slice(0, 10) === '2025-01-02', 'The viewing date should be preserved.');
    assert(batch?.status === DataImportStatus.COMPLETED, 'The import batch should be completed.');

    await prisma.personalWatchlist.createMany({ data: [1, 2, 3].map((index) => ({ userId: persistedUserId, name: `Existing ${index}` })) });
    const listBuffer = Buffer.from(zipSync({
      'lists/Crime.csv': strToU8('Position,Name,Year,tmdbID\n1,Heat,1995,949\n2,Thief,1981,11524'),
      'lists/Classics.csv': strToU8('Position,Name,Year,tmdbID\n1,Heat,1995,949'),
      'lists/Overflow.csv': strToU8('Position,Name,Year,tmdbID\n1,Heat,1995,949'),
    }));
    const file = { buffer: listBuffer, originalname: 'lists.zip', size: listBuffer.length };
    const listPreview = await imports.preview(identity, 'letterboxd', file);
    assert(listPreview.watchlists.length === 3, 'Every source list must be detected.');
    const listResult = await imports.confirm(identity, listPreview.importId);
    assert(listResult.watchlistsImported === 2, 'Only two places are available.');
    assert(listResult.watchlistsSkipped?.[0] === 'Overflow', 'Overflow must be reported.');
    const importedLists = await prisma.personalWatchlist.findMany({ where: { userId: persistedUserId }, include: { items: true } });
    assert(importedLists.length === 5, 'The personal watchlist limit must hold.');
    assert(importedLists.find((list) => list.name === 'Crime')?.items.length === 2, 'Every movie must be added to Crime.');
    assert(importedLists.find((list) => list.name === 'Classics')?.items.some((item) => item.tmdbId === 949) === true, 'Already-watched movies must remain in imported lists.');
    const repeatPreview = await imports.preview(identity, 'letterboxd', file);
    await imports.confirm(identity, repeatPreview.importId);
    assert(await prisma.personalWatchlist.count({ where: { userId: persistedUserId } }) === 5, 'Reimport must not create duplicate lists.');
    assert(await prisma.personalWatchlistItem.count({ where: { watchlist: { userId: persistedUserId } } }) === 3, 'Reimport must not duplicate membership.');

    console.log('Import smoke passed.');
  } finally {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main();
