import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';

async function main() {
  const runId = Date.now();
  const ownerIdentity = createIdentity(`__shared_watchlist_smoke_owner_${runId}`);
  const memberIdentity = createIdentity(`__shared_watchlist_smoke_member_${runId}`);
  const outsiderIdentity = createIdentity(`__shared_watchlist_smoke_outsider_${runId}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const sharedWatchlists = new SharedWatchlistsService(auth, prisma);
  let userIds: string[] = [];

  try {
    const owner = await auth.getOrCreateUser(ownerIdentity);
    const member = await auth.getOrCreateUser(memberIdentity);
    const outsider = await auth.getOrCreateUser(outsiderIdentity);
    userIds = [owner.id, member.id, outsider.id];

    const watchlist = await sharedWatchlists.createSharedWatchlist(ownerIdentity, 'Shared smoke list');
    await assertNotFound(
      () => sharedWatchlists.getSharedWatchlist(outsiderIdentity, watchlist.id),
      'Shared watchlist detail should be member-only.',
    );

    await sharedWatchlists.addMember(ownerIdentity, watchlist.id, member.id);
    const memberList = await sharedWatchlists.getSharedWatchlist(memberIdentity, watchlist.id);

    assert(memberList.memberCount === 2, 'Shared watchlist should include owner and added member.');

    const matrix = await sharedWatchlists.addItem(memberIdentity, watchlist.id, {
      contentType: 'movie',
      tmdbId: 603,
    });
    const got = await sharedWatchlists.addItem(ownerIdentity, watchlist.id, {
      contentType: 'series',
      tmdbId: 1399,
    });

    await assertBadRequest(
      () => sharedWatchlists.createVotingSession(ownerIdentity, watchlist.id, 'Tonight', [outsider.id]),
      'Voting candidates should be limited to shared list items.',
    );

    const session = await sharedWatchlists.createVotingSession(ownerIdentity, watchlist.id, 'Tonight', [
      matrix.id,
      got.id,
    ]);
    const matrixCandidate = session.candidates.find((candidate) => candidate.itemId === matrix.id);

    assert(Boolean(matrixCandidate), 'Voting session should include the movie candidate.');

    const votedOnce = await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      session.id,
      matrixCandidate!.id,
    );
    const votedTwice = await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      session.id,
      matrixCandidate!.id,
    );
    const memberVoted = await sharedWatchlists.voteForCandidate(
      memberIdentity,
      watchlist.id,
      session.id,
      matrixCandidate!.id,
    );

    assert(
      getVoteCount(votedOnce, matrixCandidate!.id) === 1,
      'First vote should count for the owner.',
    );
    assert(
      getVoteCount(votedTwice, matrixCandidate!.id) === 1,
      'Duplicate owner vote should not increase the count.',
    );
    assert(
      getVoteCount(memberVoted, matrixCandidate!.id) === 2,
      'Member vote should increase the candidate count.',
    );

    await assertNotFound(
      () => sharedWatchlists.voteForCandidate(outsiderIdentity, watchlist.id, session.id, matrixCandidate!.id),
      'Non-members should not vote.',
    );

    console.log('Shared watchlist smoke passed.');
  } finally {
    await cleanup(prisma, userIds);
    await prisma.$disconnect();
  }
}

type VotingSession = Awaited<ReturnType<SharedWatchlistsService['voteForCandidate']>>;

function getVoteCount(session: VotingSession, candidateId: string) {
  return session.candidates.find((candidate) => candidate.id === candidateId)?.voteCount ?? 0;
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

async function assertBadRequest<T>(operation: () => Promise<T>, message: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof BadRequestException) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

function createIdentity(providerUserId: string): AuthenticatedIdentity {
  return {
    displayName: 'Shared watchlist smoke user',
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
