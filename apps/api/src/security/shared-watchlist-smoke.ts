import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import { WatchlistInvitationsService } from '../shared-watchlists/watchlist-invitations.service';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { SharedWatchlistsService } from '../shared-watchlists/shared-watchlists.service';

async function main() {
  const runId = Date.now();
  const ownerIdentity = createIdentity(`__shared_watchlist_smoke_owner_${runId}`);
  const memberIdentity = createIdentity(`__shared_watchlist_smoke_member_${runId}`);
  const secondMemberIdentity = createIdentity(`__shared_watchlist_smoke_second_member_${runId}`);
  const outsiderIdentity = createIdentity(`__shared_watchlist_smoke_outsider_${runId}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const sharedWatchlists = new SharedWatchlistsService(auth, prisma, undefined, undefined, new TmdbCatalogueService(config, prisma));
  const invitations = new WatchlistInvitationsService(auth, prisma, {} as never, { enqueueWatchlistInvitation: async () => 0 } as never);
  let userIds: string[] = [];

  try {
    const owner = await auth.getOrCreateUser(ownerIdentity);
    const member = await auth.getOrCreateUser(memberIdentity);
    const secondMember = await auth.getOrCreateUser(secondMemberIdentity);
    const outsider = await auth.getOrCreateUser(outsiderIdentity);
    userIds = [owner.id, member.id, secondMember.id, outsider.id];

    const watchlist = await sharedWatchlists.createSharedWatchlist(ownerIdentity, 'Shared smoke list');
    await assertNotFound(
      () => sharedWatchlists.getSharedWatchlist(outsiderIdentity, watchlist.id),
      'Shared watchlist detail should be member-only.',
    );

    for (const [person, identity] of [[member, memberIdentity], [secondMember, secondMemberIdentity]] as const) {
      await prisma.user.update({ where: { id: person.id }, data: { onboardingCompleted: true } });
      await prisma.userFollow.create({ data: { followerId: person.id, followedUserId: owner.id } });
      await invitations.invite(ownerIdentity, watchlist.id, person.id);
      await assertNotFound(() => sharedWatchlists.getSharedWatchlist(identity, watchlist.id), 'Pending invitations must not grant access.');
      const invitation = await prisma.notification.findUniqueOrThrow({ where: { userId_dedupeKey: { userId: person.id, dedupeKey: `shared-list-invite:${watchlist.id}` } } });
      await invitations.respond(identity, invitation.id, true);
    }
    const memberList = await sharedWatchlists.getSharedWatchlist(memberIdentity, watchlist.id);

    assert(memberList.memberCount === 3, 'Shared watchlist should include owner and added members.');

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

    assert(session.status === 'OPEN', 'New voting sessions should be open.');
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const lifecycleMs = new Date(session.closesAt).getTime() - new Date(session.createdAt).getTime();
    assert(
      Math.abs(lifecycleMs - sevenDaysMs) < 1_000,
      'New voting sessions should close seven days after creation by default.',
    );
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

    await assertBadRequest(
      () => sharedWatchlists.removeItem(memberIdentity, watchlist.id, 'movie', 603),
      'Members must not remove an item while it is a candidate in an open voting session.',
    );
    const preservedOpenSession = await sharedWatchlists.getVotingSession(
      memberIdentity,
      watchlist.id,
      session.id,
    );
    assert(
      preservedOpenSession.candidates.some(
        (candidate) =>
          candidate.id === matrixCandidate!.id && candidate.voteCount === 2,
      ),
      'Rejected item removal must preserve the open candidate and its votes.',
    );

    await assertNotFound(
      () => sharedWatchlists.voteForCandidate(outsiderIdentity, watchlist.id, session.id, matrixCandidate!.id),
      'Non-members should not vote.',
    );
    await assertNotFound(
      () => sharedWatchlists.getVotingSession(outsiderIdentity, watchlist.id, session.id),
      'Non-members should not read voting sessions.',
    );
    await assertNotFound(
      () => sharedWatchlists.closeVotingSession(memberIdentity, watchlist.id, session.id),
      'Members must not close voting sessions they do not own.',
    );
    await assertNotFound(
      () => sharedWatchlists.closeVotingSession(outsiderIdentity, watchlist.id, session.id),
      'Outsiders must not close voting sessions.',
    );

    const closed = await sharedWatchlists.closeVotingSession(ownerIdentity, watchlist.id, session.id);
    assert(closed.status === 'CLOSED', 'Owner close should return a closed session.');
    assert(Boolean(closed.closedAt), 'Owner close should record closedAt.');
    assert(
      closed.winningCandidateId === matrixCandidate!.id,
      'A uniquely leading candidate should be persisted as the winner.',
    );
    assert(getVoteCount(closed, matrixCandidate!.id) === 2, 'Closing must preserve votes.');
    assert(closed.candidates.length === 2, 'Candidates must remain readable after close.');

    await assertBadRequest(
      () => sharedWatchlists.voteForCandidate(ownerIdentity, watchlist.id, session.id, matrixCandidate!.id),
      'Closed sessions must reject votes.',
    );
    await assertBadRequest(
      () => sharedWatchlists.removeVote(ownerIdentity, watchlist.id, session.id, matrixCandidate!.id),
      'Closed sessions must reject vote removal.',
    );

    const finalBeforeRepeat = await prisma.notification.findMany({
      where: {
        dedupeKey: `shared-vote-final:${session.id}`,
        votingSessionId: session.id,
      },
    });
    assert(finalBeforeRepeat.length === 3, 'Final result should notify every member exactly once.');
    assert(
      finalBeforeRepeat.every((notification) => notification.actorUserId === null),
      'Final result must consistently identify the watchlist owner, never the member who triggers expiry.',
    );
    assert(
      new Set(finalBeforeRepeat.map((notification) => notification.userId)).size === 3 &&
        finalBeforeRepeat.some((notification) => notification.userId === member.id) &&
        finalBeforeRepeat.some((notification) => notification.userId === secondMember.id),
      'Final result must target all other members and no outsider.',
    );
    const closedAgain = await sharedWatchlists.closeVotingSession(ownerIdentity, watchlist.id, session.id);
    const finalAfterRepeat = await prisma.notification.findMany({
      where: {
        dedupeKey: `shared-vote-final:${session.id}`,
        votingSessionId: session.id,
      },
    });
    assert(closedAgain.winningCandidateId === matrixCandidate!.id, 'Repeated close must preserve the result.');
    assert(finalAfterRepeat.length === 3, 'Repeated close must not spam final notifications.');

    const tieSession = await sharedWatchlists.createVotingSession(ownerIdentity, watchlist.id, 'Tie', [
      matrix.id,
      got.id,
    ]);
    await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      tieSession.id,
      tieSession.candidates[0]!.id,
    );
    await sharedWatchlists.voteForCandidate(
      ownerIdentity,
      watchlist.id,
      tieSession.id,
      tieSession.candidates[1]!.id,
    );
    const tied = await sharedWatchlists.closeVotingSession(ownerIdentity, watchlist.id, tieSession.id);
    assert(tied.leaders.length === 2, 'Tied leaders must remain visible.');
    assert(tied.winningCandidateId === null, 'A tied session must not persist an arbitrary winner.');

    const expiringSession = await sharedWatchlists.createVotingSession(
      ownerIdentity,
      watchlist.id,
      'Expired',
      [matrix.id],
    );
    await prisma.sharedVotingSession.update({
      data: { closesAt: new Date(Date.now() - 60_000) },
      where: { id: expiringSession.id },
    });
    await assertBadRequest(
      () =>
        sharedWatchlists.voteForCandidate(
          memberIdentity,
          watchlist.id,
          expiringSession.id,
          expiringSession.candidates[0]!.id,
        ),
      'Expired sessions must reject mutations.',
    );
    const expired = await sharedWatchlists.getVotingSession(memberIdentity, watchlist.id, expiringSession.id);
    assert(expired.status === 'CLOSED', 'Reading an expired session should close it automatically.');
    assert(Boolean(expired.closedAt), 'Automatic expiry should record closedAt.');

    console.log('Shared watchlist lifecycle security smoke passed.');
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
    emailVerified: false,
    firebaseUid: providerUserId,
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
