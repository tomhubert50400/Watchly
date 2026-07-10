import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  NotificationKind,
  SharedVotingStatus,
  TrackedContentType,
} from '../generated/prisma/enums';
import {
  SharedWatchlistContentType,
  SharedWatchlistItemDto,
} from './shared-watchlists.dto';

@Injectable()
export class SharedWatchlistsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listSharedWatchlists(
    identity: AuthenticatedIdentity,
    contentTypeFilter?: SharedWatchlistContentType,
    tmdbIdFilter?: number,
  ) {
    const userId = await this.getUserId(identity);
    const itemFilter =
      contentTypeFilter && tmdbIdFilter
        ? {
            contentType: toTrackedContentType(contentTypeFilter),
            tmdbId: tmdbIdFilter,
          }
        : undefined;
    const watchlists = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.findMany({
        include: {
          _count: {
            select: {
              items: true,
              members: true,
            },
          },
          items: {
            select: {
              id: true,
            },
            where: itemFilter,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
      }),
    );

    return {
      items: watchlists.map((watchlist) => toSummary(watchlist, userId, Boolean(itemFilter))),
    };
  }

  async createSharedWatchlist(identity: AuthenticatedIdentity, name: string) {
    const cleanName = name.trim();

    if (cleanName.length === 0) {
      throw new BadRequestException('name must not be empty.');
    }

    const userId = await this.getUserId(identity);
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.create({
      data: {
        members: {
          create: {
            userId,
          },
        },
        name: cleanName,
        ownerId: userId,
      },
      include: {
        _count: {
          select: {
            items: true,
            members: true,
          },
        },
      },
      }),
    );

    return toSummary(watchlist, userId);
  }

  async getSharedWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    await this.closeExpiredVotingSessions(watchlistId);

    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.findUnique({
      include: {
        items: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        members: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        votingSessions: {
          include: {
            candidates: {
              include: {
                item: true,
                votes: {
                  select: {
                    userId: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      where: {
        id: watchlistId,
      },
      }),
    );

    if (!watchlist) {
      throw new NotFoundException('Shared watchlist not found.');
    }

    return {
      createdAt: watchlist.createdAt.toISOString(),
      id: watchlist.id,
      isOwner: watchlist.ownerId === userId,
      items: watchlist.items.map(toItem),
      memberCount: watchlist.members.length,
      members: watchlist.members.map((member) => ({
        displayName: member.user.displayName,
        id: member.userId,
      })),
      name: watchlist.name,
      updatedAt: watchlist.updatedAt.toISOString(),
      votingSessions: watchlist.votingSessions.map((session) => toVotingSession(session, userId)),
    };
  }

  async deleteSharedWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);
    await this.assertOwner(userId, watchlistId);

    await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.delete({
      where: {
        id: watchlistId,
      },
      }),
    );
  }

  async addMember(identity: AuthenticatedIdentity, watchlistId: string, memberUserId: string) {
    const userId = await this.getUserId(identity);
    await this.assertOwner(userId, watchlistId);

    const member = await this.withConnectionRetry(() =>
      this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: memberUserId,
      },
      }),
    );

    if (!member) {
      throw new NotFoundException('User not found.');
    }

    await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlistMember.upsert({
      create: {
        userId: memberUserId,
        watchlistId,
      },
      update: {},
      where: {
        watchlistId_userId: {
          userId: memberUserId,
          watchlistId,
        },
      },
      }),
    );

    await this.touchSharedWatchlist(watchlistId);
    await this.upsertInviteNotification(userId, memberUserId, watchlistId);

    return { added: true };
  }

  async addItem(identity: AuthenticatedIdentity, watchlistId: string, input: SharedWatchlistItemDto) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);

    const contentType = toTrackedContentType(input.contentType);
    const item = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlistItem.upsert({
      create: {
        contentType,
        tmdbId: input.tmdbId,
        watchlistId,
      },
      update: {},
      where: {
        watchlistId_contentType_tmdbId: {
          contentType,
          tmdbId: input.tmdbId,
          watchlistId,
        },
      },
      }),
    );

    await this.touchSharedWatchlist(watchlistId);

    return toItem(item);
  }

  async removeItem(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    contentType: SharedWatchlistContentType,
    tmdbId: number,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);

    await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlistItem.deleteMany({
      where: {
        contentType: toTrackedContentType(contentType),
        tmdbId,
        watchlistId,
      },
      }),
    );

    await this.touchSharedWatchlist(watchlistId);
  }

  async createVotingSession(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    title: string,
    itemIds: string[],
  ) {
    const cleanTitle = title.trim();

    if (cleanTitle.length === 0) {
      throw new BadRequestException('title must not be empty.');
    }

    if (itemIds.length === 0) {
      throw new BadRequestException('itemIds must include at least one item.');
    }

    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    const itemCount = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlistItem.count({
      where: {
        id: {
          in: itemIds,
        },
        watchlistId,
      },
      }),
    );

    if (itemCount !== new Set(itemIds).size) {
      throw new BadRequestException('Voting candidates must belong to this shared watchlist.');
    }

    const session = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.create({
      data: {
        candidates: {
          create: Array.from(new Set(itemIds)).map((itemId) => ({
            itemId,
          })),
        },
        title: cleanTitle,
        watchlistId,
      },
      }),
    );

    await this.touchSharedWatchlist(watchlistId);

    return this.getVotingSession(identity, watchlistId, session.id);
  }

  async getVotingSession(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sessionId: string,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    await this.closeExpiredVotingSession(watchlistId, sessionId);

    const session = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.findFirst({
      include: {
        candidates: {
          include: {
            item: true,
            votes: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      where: {
        id: sessionId,
        watchlistId,
      },
      }),
    );

    if (!session) {
      throw new NotFoundException('Voting session not found.');
    }

    return toVotingSession(session, userId);
  }

  async voteForCandidate(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sessionId: string,
    candidateId: string,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    const result = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "shared_voting_sessions" WHERE id = $1::uuid AND "watchlistId" = $2::uuid FOR UPDATE',
          sessionId,
          watchlistId,
        );

        if (locked.length === 0) {
          return 'SESSION_NOT_FOUND' as const;
        }

        const votingSession = await transaction.sharedVotingSession.findUniqueOrThrow({
          select: { closesAt: true, status: true },
          where: { id: sessionId },
        });

        if (
          votingSession.status === SharedVotingStatus.CLOSED ||
          votingSession.closesAt <= new Date()
        ) {
          return 'CLOSED' as const;
        }

        const candidate = await transaction.sharedVotingCandidate.findFirst({
          select: { id: true },
          where: { id: candidateId, sessionId },
        });

        if (!candidate) {
          return 'CANDIDATE_NOT_FOUND' as const;
        }

        await transaction.sharedVotingVote.upsert({
          create: { candidateId, userId },
          update: {},
          where: { candidateId_userId: { candidateId, userId } },
        });

        return 'UPDATED' as const;
      }),
    );

    if (result === 'SESSION_NOT_FOUND') {
      throw new NotFoundException('Voting session not found.');
    }

    if (result === 'CANDIDATE_NOT_FOUND') {
      throw new NotFoundException('Voting candidate not found.');
    }

    if (result === 'CLOSED') {
      await this.closeExpiredVotingSession(watchlistId, sessionId);
      throw new BadRequestException('Voting session is closed.');
    }

    await this.upsertVoteLeaderNotifications(userId, watchlistId, sessionId);

    return this.getVotingSession(identity, watchlistId, sessionId);
  }

  async removeVote(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sessionId: string,
    candidateId: string,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    const result = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "shared_voting_sessions" WHERE id = $1::uuid AND "watchlistId" = $2::uuid FOR UPDATE',
          sessionId,
          watchlistId,
        );

        if (locked.length === 0) {
          return 'SESSION_NOT_FOUND' as const;
        }

        const votingSession = await transaction.sharedVotingSession.findUniqueOrThrow({
          select: { closesAt: true, status: true },
          where: { id: sessionId },
        });

        if (
          votingSession.status === SharedVotingStatus.CLOSED ||
          votingSession.closesAt <= new Date()
        ) {
          return 'CLOSED' as const;
        }

        await transaction.sharedVotingVote.deleteMany({
          where: { candidateId, userId, candidate: { sessionId } },
        });

        return 'UPDATED' as const;
      }),
    );

    if (result === 'SESSION_NOT_FOUND') {
      throw new NotFoundException('Voting session not found.');
    }

    if (result === 'CLOSED') {
      await this.closeExpiredVotingSession(watchlistId, sessionId);
      throw new BadRequestException('Voting session is closed.');
    }

    await this.upsertVoteLeaderNotifications(userId, watchlistId, sessionId);

    return this.getVotingSession(identity, watchlistId, sessionId);
  }

  async closeVotingSession(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sessionId: string,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertOwner(userId, watchlistId);
    const result = await this.finalizeVotingSession(watchlistId, sessionId, false);

    if (!result.found) {
      throw new NotFoundException('Voting session not found.');
    }

    return this.getVotingSession(identity, watchlistId, sessionId);
  }

  private async closeExpiredVotingSessions(watchlistId: string) {
    const expired = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.findMany({
        select: { id: true },
        where: {
          closesAt: { lte: new Date() },
          status: SharedVotingStatus.OPEN,
          watchlistId,
        },
      }),
    );

    for (const session of expired) {
      await this.finalizeVotingSession(watchlistId, session.id, true);
    }
  }

  private async closeExpiredVotingSession(
    watchlistId: string,
    sessionId: string,
  ) {
    await this.finalizeVotingSession(watchlistId, sessionId, true);
  }

  private async finalizeVotingSession(
    watchlistId: string,
    sessionId: string,
    expiredOnly: boolean,
  ) {
    const result = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "shared_voting_sessions" WHERE id = $1::uuid AND "watchlistId" = $2::uuid FOR UPDATE',
          sessionId,
          watchlistId,
        );

        if (locked.length === 0) {
          return { closed: false, found: false, transitioned: false };
        }

        const session = await transaction.sharedVotingSession.findUniqueOrThrow({
          include: {
            candidates: {
              include: { votes: { select: { id: true } } },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
          where: { id: sessionId },
        });

        if (session.status === SharedVotingStatus.CLOSED) {
          return { closed: true, found: true, transitioned: false };
        }

        if (expiredOnly && session.closesAt > new Date()) {
          return { closed: false, found: true, transitioned: false };
        }

        const maxVotes = Math.max(0, ...session.candidates.map((candidate) => candidate.votes.length));
        const leaders =
          maxVotes === 0
            ? []
            : session.candidates.filter((candidate) => candidate.votes.length === maxVotes);
        const winningCandidateId = leaders.length === 1 ? leaders[0]!.id : null;

        await transaction.sharedVotingSession.update({
          data: {
            closedAt: new Date(),
            status: SharedVotingStatus.CLOSED,
            winningCandidateId,
          },
          where: { id: sessionId },
        });

        return { closed: true, found: true, transitioned: true };
      }),
    );

    if (result.closed) {
      await this.createFinalVoteNotifications(watchlistId, sessionId);
    }

    return result;
  }

  private async createFinalVoteNotifications(
    watchlistId: string,
    sessionId: string,
  ) {
    const session = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.findFirst({
        include: {
          candidates: {
            include: {
              item: true,
              votes: { select: { id: true } },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
          watchlist: {
            include: { members: { select: { userId: true } } },
          },
        },
        where: { id: sessionId, watchlistId },
      }),
    );

    if (!session) {
      return;
    }

    const maxVotes = Math.max(0, ...session.candidates.map((candidate) => candidate.votes.length));
    const leaders =
      maxVotes === 0
        ? []
        : session.candidates
            .filter((candidate) => candidate.votes.length === maxVotes)
            .map((candidate) => ({
              contentType: fromTrackedContentType(candidate.item.contentType),
              tmdbId: candidate.item.tmdbId,
            }));
    const body =
      leaders.length === 0
        ? `“${session.title}” closed without a winner.`
        : leaders.length === 1
          ? `“${session.title}” has a final winner.`
          : `“${session.title}” closed with a tie.`;
    const dedupeKey = `shared-vote-final:${sessionId}`;
    const actorUserId = session.watchlist.ownerId;
    const recipients = session.watchlist.members.filter((member) => member.userId !== actorUserId);

    if (recipients.length === 0) {
      return;
    }

    await this.withConnectionRetry(() =>
      this.prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          actorUserId,
          body,
          dedupeKey,
          kind: NotificationKind.SHARED_VOTE_UPDATE,
          routeMetadata: {
            final: true,
            leaders,
            route: 'SharedVote',
            votingSessionId: sessionId,
            watchlistId,
            winningCandidateId: session.winningCandidateId,
          },
          sharedWatchlistId: watchlistId,
          title: 'Shared vote result',
          userId: recipient.userId,
          votingSessionId: sessionId,
        })),
        skipDuplicates: true,
      }),
    );
  }

  private async upsertInviteNotification(
    actorUserId: string,
    recipientUserId: string,
    watchlistId: string,
  ) {
    if (actorUserId === recipientUserId) {
      return;
    }

    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.findUniqueOrThrow({
        select: { name: true },
        where: { id: watchlistId },
      }),
    );
    const dedupeKey = `shared-list-invite:${watchlistId}`;
    const data = {
      actorUserId,
      body: `You were added to the shared list “${watchlist.name}”.`,
      kind: NotificationKind.SHARED_LIST_INVITE,
      readAt: null,
      routeMetadata: { route: 'SharedWatchlist', watchlistId },
      sharedWatchlistId: watchlistId,
      title: 'Shared list invitation',
    };

    await this.withConnectionRetry(() =>
      this.prisma.notification.upsert({
        create: {
          ...data,
          dedupeKey,
          userId: recipientUserId,
        },
        update: data,
        where: {
          userId_dedupeKey: {
            dedupeKey,
            userId: recipientUserId,
          },
        },
      }),
    );
  }

  private async upsertVoteLeaderNotifications(
    actorUserId: string,
    watchlistId: string,
    sessionId: string,
  ) {
    const session = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingSession.findFirst({
        include: {
          candidates: {
            include: {
              item: true,
              votes: { select: { id: true } },
            },
          },
          watchlist: {
            include: {
              members: { select: { userId: true } },
            },
          },
        },
        where: { id: sessionId, watchlistId },
      }),
    );

    if (!session || session.status === SharedVotingStatus.CLOSED) {
      return;
    }

    const maxVotes = Math.max(0, ...session.candidates.map((candidate) => candidate.votes.length));
    const leaders =
      maxVotes === 0
        ? []
        : session.candidates
            .filter((candidate) => candidate.votes.length === maxVotes)
            .map((candidate) => ({
              contentType: fromTrackedContentType(candidate.item.contentType),
              tmdbId: candidate.item.tmdbId,
            }));
    const body =
      leaders.length === 0
        ? `“${session.title}” does not have a voting leader yet.`
        : leaders.length === 1
          ? `The voting leader changed in “${session.title}”.`
          : `The voting leaders changed in “${session.title}”.`;
    const dedupeKey = `shared-vote-update:${sessionId}`;
    const leaderKey = leaders
      .map((leader) => `${leader.contentType}:${leader.tmdbId}`)
      .sort()
      .join('|');
    const routeMetadata = {
      leaderKey,
      leaders,
      route: 'SharedVote',
      votingSessionId: sessionId,
      watchlistId,
    };
    const recipients = session.watchlist.members.filter((member) => member.userId !== actorUserId);

    await this.withConnectionRetry(() =>
      Promise.all(
        recipients.map(async (recipient) => {
          const existing = await this.prisma.notification.findUnique({
            select: { routeMetadata: true },
            where: {
              userId_dedupeKey: {
                dedupeKey,
                userId: recipient.userId,
              },
            },
          });

          if (getNotificationLeaderKey(existing?.routeMetadata) === leaderKey) {
            return;
          }

          await this.prisma.notification.upsert({
            create: {
              actorUserId,
              body,
              dedupeKey,
              kind: NotificationKind.SHARED_VOTE_UPDATE,
              routeMetadata,
              sharedWatchlistId: watchlistId,
              title: 'Shared vote update',
              userId: recipient.userId,
              votingSessionId: sessionId,
            },
            update: {
              actorUserId,
              body,
              readAt: null,
              routeMetadata,
              title: 'Shared vote update',
            },
            where: {
              userId_dedupeKey: {
                dedupeKey,
                userId: recipient.userId,
              },
            },
          });
        }),
      ),
    );
  }

  private async getUserId(identity: AuthenticatedIdentity) {
    const user = await this.authService.getOrCreateUser(identity);

    return user.id;
  }

  private async withConnectionRetry<T>(operation: () => Promise<T>) {
    return this.prisma.withConnectionRetry(operation);
  }

  private async assertMember(userId: string, watchlistId: string) {
    const membership = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlistMember.findUnique({
      select: {
        id: true,
      },
      where: {
        watchlistId_userId: {
          userId,
          watchlistId,
        },
      },
      }),
    );

    if (!membership) {
      throw new NotFoundException('Shared watchlist not found.');
    }
  }

  private async assertOwner(userId: string, watchlistId: string) {
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.findFirst({
      select: {
        id: true,
      },
      where: {
        id: watchlistId,
        ownerId: userId,
      },
      }),
    );

    if (!watchlist) {
      throw new NotFoundException('Shared watchlist not found.');
    }
  }

  private async touchSharedWatchlist(watchlistId: string) {
    await this.withConnectionRetry(() =>
      this.prisma.sharedWatchlist.update({
      data: {
        updatedAt: new Date(),
      },
      where: {
        id: watchlistId,
      },
      }),
    );
  }
}

function getNotificationLeaderKey(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const leaderKey = (metadata as Record<string, unknown>).leaderKey;
  return typeof leaderKey === 'string' ? leaderKey : null;
}

type SharedVotingSessionRecord = {
  candidates: {
    createdAt: Date;
    id: string;
    itemId: string;
    item: {
      contentType: TrackedContentType;
      tmdbId: number;
    };
    votes: { userId: string }[];
  }[];
  closedAt: Date | null;
  closesAt: Date;
  createdAt: Date;
  id: string;
  status: SharedVotingStatus;
  title: string;
  updatedAt: Date;
  winningCandidateId: string | null;
};

function toVotingSession(session: SharedVotingSessionRecord, userId: string) {
  const candidates = session.candidates.map((candidate) => ({
    contentType: fromTrackedContentType(candidate.item.contentType),
    id: candidate.id,
    itemId: candidate.itemId,
    tmdbId: candidate.item.tmdbId,
    userHasVoted: candidate.votes.some((vote) => vote.userId === userId),
    voteCount: candidate.votes.length,
  }));
  const maxVotes = Math.max(0, ...candidates.map((candidate) => candidate.voteCount));
  const leaders =
    maxVotes === 0 ? [] : candidates.filter((candidate) => candidate.voteCount === maxVotes);

  return {
    candidates,
    closedAt: session.closedAt?.toISOString() ?? null,
    closesAt: session.closesAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    id: session.id,
    leaders,
    status: session.status,
    title: session.title,
    updatedAt: session.updatedAt.toISOString(),
    winningCandidateId: session.winningCandidateId,
  };
}

type SharedWatchlistSummaryRecord = {
  _count: {
    items: number;
    members: number;
  };
  createdAt: Date;
  id: string;
  items?: {
    id: string;
  }[];
  name: string;
  ownerId: string;
  updatedAt: Date;
};

type SharedWatchlistItemRecord = {
  contentType: TrackedContentType;
  createdAt: Date;
  id: string;
  tmdbId: number;
};

function toSummary(
  watchlist: SharedWatchlistSummaryRecord,
  userId: string,
  includeContainsTitle = false,
) {
  return {
    ...(includeContainsTitle ? { containsTitle: (watchlist.items?.length ?? 0) > 0 } : {}),
    createdAt: watchlist.createdAt.toISOString(),
    id: watchlist.id,
    isOwner: watchlist.ownerId === userId,
    itemCount: watchlist._count.items,
    memberCount: watchlist._count.members,
    name: watchlist.name,
    updatedAt: watchlist.updatedAt.toISOString(),
  };
}

function toItem(item: SharedWatchlistItemRecord) {
  return {
    contentType: fromTrackedContentType(item.contentType),
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    tmdbId: item.tmdbId,
  };
}

function toTrackedContentType(contentType: SharedWatchlistContentType): TrackedContentType {
  return contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES;
}

function fromTrackedContentType(contentType: TrackedContentType): SharedWatchlistContentType {
  return contentType === TrackedContentType.MOVIE ? 'movie' : 'series';
}
