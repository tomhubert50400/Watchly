import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.count();
    await prisma.authIdentity.count();
    await prisma.privacySettings.count();
    await prisma.userContentState.count();
    await prisma.userEpisodeProgress.count();
    await prisma.userEpisodeRating.count();
    await prisma.userEpisodeReview.count();
    await prisma.userMovieRating.count();
    await prisma.userMovieReview.count();
    await prisma.userBlock.count();
    await prisma.userFollow.count();
    await prisma.personalWatchlist.count();
    await prisma.personalWatchlistItem.count();
    await prisma.releaseNotification.count();
    await prisma.auditLog.count();
    console.log('Database connection ok');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
