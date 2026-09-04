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
    await prisma.contentReport.count();
    await prisma.privacySettings.count();
    await prisma.userContentState.count();
    await prisma.userEpisodeProgress.count();
    await prisma.userEpisodeRating.count();
    await prisma.userEpisodeReview.count();
    await prisma.userMovieRating.count();
    await prisma.userMovieReview.count();
    await prisma.userSeriesRating.count();
    await prisma.userBlock.count();
    await prisma.userFollow.count();
    await prisma.personalWatchlist.count();
    await prisma.personalWatchlistItem.count();
    await prisma.sharedWatchlist.count();
    await prisma.sharedWatchlistMember.count();
    await prisma.sharedWatchlistItem.count();
    await prisma.sharedVotingSession.count();
    await prisma.sharedVotingCandidate.count();
    await prisma.sharedVotingVote.count();
    await prisma.releaseAlertSubscription.count();
    await prisma.notification.count();
    await prisma.auditLog.count();
    await prisma.adminAuditLog.count();
    const [adminAuditTrigger] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'admin_audit_logs_append_only'
          AND NOT tgisinternal
      ) AS "exists"
    `;

    if (!adminAuditTrigger?.exists) {
      throw new Error('Admin audit append-only trigger is missing.');
    }
    console.log('Database connection ok');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
