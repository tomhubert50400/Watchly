import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { TrackedContentType } from '../generated/prisma/enums';
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
      votingSessions: watchlist.votingSessions.map((session) => ({
        createdAt: session.createdAt.toISOString(),
        id: session.id,
        title: session.title,
        candidates: session.candidates.map((candidate) => ({
          contentType: fromTrackedContentType(candidate.item.contentType),
          id: candidate.id,
          itemId: candidate.itemId,
          tmdbId: candidate.item.tmdbId,
          userHasVoted: candidate.votes.some((vote) => vote.userId === userId),
          voteCount: candidate.votes.length,
        })),
      })),
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

    return {
      createdAt: session.createdAt.toISOString(),
      id: session.id,
      title: session.title,
      candidates: session.candidates.map((candidate) => ({
        contentType: fromTrackedContentType(candidate.item.contentType),
        id: candidate.id,
        itemId: candidate.itemId,
        tmdbId: candidate.item.tmdbId,
        userHasVoted: candidate.votes.some((vote) => vote.userId === userId),
        voteCount: candidate.votes.length,
      })),
    };
  }

  async voteForCandidate(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    sessionId: string,
    candidateId: string,
  ) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    const candidate = await this.withConnectionRetry(() =>
      this.prisma.sharedVotingCandidate.findFirst({
      select: {
        id: true,
      },
      where: {
        id: candidateId,
        session: {
          id: sessionId,
          watchlistId,
        },
      },
      }),
    );

    if (!candidate) {
      throw new NotFoundException('Voting candidate not found.');
    }

    await this.withConnectionRetry(() =>
      this.prisma.sharedVotingVote.upsert({
      create: {
        candidateId,
        userId,
      },
      update: {},
      where: {
        candidateId_userId: {
          candidateId,
          userId,
        },
      },
      }),
    );

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
    await this.withConnectionRetry(() =>
      this.prisma.sharedVotingVote.deleteMany({
      where: {
        candidateId,
        userId,
        candidate: {
          session: {
            id: sessionId,
            watchlistId,
          },
        },
      },
      }),
    );

    return this.getVotingSession(identity, watchlistId, sessionId);
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
