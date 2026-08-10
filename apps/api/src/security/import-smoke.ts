import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider, DataImportStatus, TrackedContentType, UserContentStatus } from '../generated/prisma/enums';
import { ImportsService } from '../imports/imports.service';

async function main() {
  const identity: AuthenticatedIdentity = {
    displayName: 'Import smoke user',
    provider: AuthProvider.GOOGLE,
    providerUserId: `__import_smoke_${Date.now()}`,
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
    const preview = await imports.preview(identity, 'letterboxd', {
      buffer: Buffer.from([
        'tmdbID,Title,Year,Rating,WatchedDate,Review',
        '949,Heat,1995,4.5,2025-01-02,"Import smoke review."',
      ].join('\n')),
      originalname: 'watchly-import-smoke.csv',
      size: 115,
    });

    assert(preview.summary.ready === 1, 'The TMDB ID should produce one ready match.');
    const result = await imports.confirm(identity, preview.importId);
    assert(result.titlesProcessed === 1, 'The import should process one title.');
    assert(result.ratingsCreated === 1, 'The import should create the rating.');
    assert(result.reviewsCreated === 1, 'The import should create the review.');
    assert(result.viewingEventsCreated === 1, 'The import should preserve the viewing date.');

    const [rating, review, state, viewing, batch] = await Promise.all([
      prisma.userMovieRating.findUnique({ where: { userId_tmdbId: { tmdbId: 949, userId } } }),
      prisma.userMovieReview.findUnique({ where: { userId_tmdbId: { tmdbId: 949, userId } } }),
      prisma.userContentState.findUnique({
        where: {
          userId_contentType_tmdbId: {
            contentType: TrackedContentType.MOVIE,
            tmdbId: 949,
            userId,
          },
        },
      }),
      prisma.viewingEvent.findFirst({ where: { tmdbId: 949, userId } }),
      prisma.dataImport.findUnique({ where: { id: preview.importId } }),
    ]);

    assert(rating?.scoreHalfSteps === 9, 'The 4.5 rating should be stored as nine half-steps.');
    assert(review?.body === 'Import smoke review.', 'The review body should be preserved.');
    assert(state?.status === UserContentStatus.WATCHED, 'The movie should be marked watched.');
    assert(viewing?.watchedAt?.toISOString().slice(0, 10) === '2025-01-02', 'The viewing date should be preserved.');
    assert(batch?.status === DataImportStatus.COMPLETED, 'The import batch should be completed.');

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
