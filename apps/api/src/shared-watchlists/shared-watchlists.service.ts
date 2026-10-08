import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import { TmdbCatalogueService } from '../catalogue/tmdb-catalogue.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { PushService } from '../push/push.service';
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
export class SharedWatchlistsService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private finalizing = false;
  private readonly logger = new Logger(SharedWatchlistsService.name);

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.finalizeDueVotes(), 60_000);
    this.timer.unref();
    void this.finalizeDueVotes();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async finalizeDueVotes() {
    if (this.finalizing) return;
    this.finalizing = true;
    try {
      const sessions = await this.prisma.sharedVotingSession.findMany({
        where: { OR: [
          { status: SharedVotingStatus.OPEN, closesAt: { lte: new Date() } },
          { status: SharedVotingStatus.CLOSED, closedAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
        ] }, select: { id: true, watchlistId: true },
      });
      for (const session of sessions) {
        try { await this.finalizeVotingSession(session.watchlistId, session.id, true); }
        catch { this.logger.warn(`Could not finalize shared vote ${session.id}; retrying next minute.`); }
      }
    } catch { this.logger.warn('Could not load due shared votes; retrying next minute.'); }
    finally { this.finalizing = false; }
  }

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvatarStorageService) private readonly avatars?: AvatarStorageService,
    @Inject(PushService) private readonly push?: PushService,
    @Inject(TmdbCatalogueService) private readonly catalogue?: TmdbCatalogueService,
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
        members: { take: 5, orderBy: { createdAt: 'asc' }, select: {
          user: { select: { id: true, displayName: true, avatarObjectKey: true } },
        } },
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
      items: watchlists.map((watchlist) => ({ ...toSummary(watchlist, userId, Boolean(itemFilter)),
        members: watchlist.members.map(({ user }) => ({ id: user.id, displayName: user.displayName,
          avatarUrl: this.avatars?.getPublicUrl(user.avatarObjectKey) ?? null })),
      })),
    };
  }

  async createSharedWatchlist(identity: AuthenticatedIdentity, name: string) {
    const cleanName = name.trim();

    if (cleanName.length === 0) {
      throw new BadRequestException('name must not be empty.');
    }

    const userId = await this.getUserId(identity);
    const watchlist = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
        const count = await transaction.sharedWatchlistMember.count({ where: { userId } });
        if (count >= 5) {
          throw new BadRequestException('You can belong to up to 5 shared watchlists, including lists you create.');
        }
        return transaction.sharedWatchlist.create({
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
        });
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
          where: { dismissals: { none: { userId } } },
          include: {
            candidates: {
              include: {
                item: true,
                votes: {
                  select: {
                    userId: true,
                    user: { select: { displayName: true, avatarObjectKey: true } },
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
      backgroundItemId: watchlist.items.some((item) => item.id === watchlist.backgroundItemId)
        ? watchlist.backgroundItemId
        : null,
      createdAt: watchlist.createdAt.toISOString(),
      id: watchlist.id,
      isOwner: watchlist.ownerId === userId,
      items: watchlist.items.map(toItem),
      coverItemIds: watchlist.coverItemIds.filter((id) => watchlist.items.some((item) => item.id === id)),
      memberCount: watchlist.members.length,
      members: watchlist.members.map((member) => ({
        displayName: member.user.displayName,
        avatarUrl: this.avatars?.getPublicUrl(member.user.avatarObjectKey) ?? null,
        id: member.userId,
      })),
      name: watchlist.name,
      updatedAt: watchlist.updatedAt.toISOString(),
      votingSessions: watchlist.votingSessions.map((session) => toVotingSession(session, userId, key => this.avatars?.getPublicUrl(key) ?? null)),
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

  async leaveSharedWatchlist(identity: AuthenticatedIdentity, watchlistId: string) {
    const userId = await this.getUserId(identity);
    await this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
      const watchlist = await transaction.sharedWatchlist.findFirst({
        where: { id: watchlistId, members: { some: { userId } } },
        select: { ownerId: true },
      });
      if (!watchlist) throw new NotFoundException('Shared watchlist not found.');
      if (watchlist.ownerId === userId) {
        throw new BadRequestException('You own this watchlist. Delete it instead of leaving it.');
      }
      await transaction.sharedWatchlistMember.deleteMany({ where: { userId, watchlistId } });
      await transaction.notification.updateMany({
        where: { userId, sharedWatchlistId: watchlistId, kind: NotificationKind.SHARED_LIST_INVITE },
        data: { readAt: new Date(), body: 'You left this watchlist.',
          routeMetadata: { route: 'Notifications', watchlistId, invitationStatus: 'declined' } },
      });
    }));
    return { left: true };
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

    const result = await this.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const items = await transaction.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM "shared_watchlist_items" WHERE "watchlistId" = $1::uuid AND "contentType" = $2::"TrackedContentType" AND "tmdbId" = $3 FOR UPDATE',
          watchlistId,
          toTrackedContentType(contentType),
          tmdbId,
        );

        if (items.length === 0) {
          return 'NOT_FOUND' as const;
        }

        const votingCandidate = await transaction.sharedVotingCandidate.findFirst({
          select: { id: true },
          where: { itemId: items[0]!.id },
        });

        if (votingCandidate) {
          return 'VOTING_CANDIDATE' as const;
        }

        await transaction.sharedWatchlistItem.delete({
          where: { id: items[0]!.id },
        });

        return 'DELETED' as const;
      }),
    );

    if (result === 'VOTING_CANDIDATE') {
      throw new BadRequestException('Items used in a voting session cannot be removed.');
    }

    await this.touchSharedWatchlist(watchlistId);
  }

  async createVotingSession(
    identity: AuthenticatedIdentity,
    watchlistId: string,
    title: string,
    itemIds: string[],
    options: { durationMinutes?: number; isAnonymous?: boolean; allowMultipleVotes?: boolean; titles?: SharedWatchlistItemDto[] } = {},
  ) {
    const cleanTitle = title.trim();
    const durationMinutes = options.durationMinutes ?? 10080;
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 10080) {
      throw new BadRequestException('Voting duration must be between 15 minutes and 7 days.');
    }
    if (options.isAnonymous !== undefined && typeof options.isAnonymous !== 'boolean') {
      throw new BadRequestException('isAnonymous must be a boolean.');
    }
    if (options.allowMultipleVotes !== undefined && typeof options.allowMultipleVotes !== 'boolean') {
      throw new BadRequestException('allowMultipleVotes must be a boolean.');
    }
    if (itemIds.length + (options.titles?.length ?? 0) > 10) throw new BadRequestException('Choose up to 10 titles.');

    if (cleanTitle.length === 0) {
      throw new BadRequestException('title must not be empty.');
    }

    if (itemIds.length === 0 && !options.titles?.length) {
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

    await this.validateCatalogueTitles(watchlistId, options.titles ?? []);
    const session = await this.withConnectionRetry(() => this.prisma.$transaction(async tx => {
      const candidateIds = await this.resolveVoteItems(tx, watchlistId, itemIds, options.titles ?? []);
      const watchlist = await tx.sharedWatchlist.findUniqueOrThrow({ where: { id: watchlistId },
        include: { members: { select: { userId: true } } } });
      const created = await tx.sharedVotingSession.create({
      data: {
        candidates: {
          create: candidateIds.map((itemId) => ({
            itemId,
          })),
        },
        title: cleanTitle,
        closesAt: new Date(Date.now() + durationMinutes * 60_000),
        isAnonymous: options.isAnonymous ?? true,
        allowMultipleVotes: options.allowMultipleVotes ?? true,
        creatorId: userId,
        watchlistId,
      },
      });
      await tx.notification.createMany({ data: watchlist.members.filter(member => member.userId !== userId).map(member => ({
        userId: member.userId, actorUserId: userId, kind: NotificationKind.SHARED_VOTE_UPDATE,
        title: 'New watchlist vote', body: `Vote in “${cleanTitle}” in “${watchlist.name}”.`,
        dedupeKey: `shared-vote-start:${created.id}`, sharedWatchlistId: watchlistId, votingSessionId: created.id,
        routeMetadata: { route: 'SharedWatchlist', watchlistId, watchlistName: watchlist.name, votingSessionId: created.id, started: true },
      })), skipDuplicates: true });
      return created;
    }));

    const notifications = await this.prisma.notification.findMany({ where: { dedupeKey: `shared-vote-start:${session.id}` }, select: { id: true, userId: true } });
    for (const notification of notifications) await this.push?.enqueueWatchlistVote(notification.userId, notification.id);

    await this.touchSharedWatchlist(watchlistId);

    return this.getVotingSession(identity, watchlistId, session.id);
  }

  async deleteVotingSession(identity: AuthenticatedIdentity, watchlistId: string, sessionId: string) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    await this.withConnectionRetry(() => this.prisma.$transaction(async tx => {
      const sessions = await tx.$queryRawUnsafe<{ creatorId: string | null }[]>(
        'SELECT "creatorId" FROM "shared_voting_sessions" WHERE id = $1::uuid AND "watchlistId" = $2::uuid FOR UPDATE', sessionId, watchlistId,
      );
      if (!sessions[0]) throw new NotFoundException('Voting session not found.');
      if (sessions[0].creatorId !== userId) throw new ForbiddenException('Only the vote creator can delete this vote.');
      await tx.sharedVotingSession.delete({ where: { id: sessionId } });
      await tx.sharedWatchlist.update({ where: { id: watchlistId }, data: { updatedAt: new Date() } });
    }));
    return { deleted: true };
  }

  async dismissVotingSession(identity: AuthenticatedIdentity, watchlistId: string, sessionId: string) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    await this.closeExpiredVotingSession(watchlistId, sessionId);
    const session = await this.prisma.sharedVotingSession.findFirst({ where: { id: sessionId, watchlistId }, select: { status: true } });
    if (!session) throw new NotFoundException('Voting session not found.');
    if (session.status !== SharedVotingStatus.CLOSED) throw new BadRequestException('Only completed votes can be hidden.');
    await this.prisma.sharedVotingDismissal.upsert({
      where: { sessionId_userId: { sessionId, userId } }, create: { sessionId, userId }, update: {},
    });
    return { hidden: true };
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
                user: { select: { displayName: true, avatarObjectKey: true } },
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

    return toVotingSession(session, userId, key => this.avatars?.getPublicUrl(key) ?? null);
  }

  private async validateCatalogueTitles(watchlistId: string, titles: SharedWatchlistItemDto[]) {
    if (!titles.length) return;
    const existing = await this.prisma.sharedWatchlistItem.findMany({ where: { watchlistId,
      OR: titles.map(title => ({ contentType: toTrackedContentType(title.contentType), tmdbId: title.tmdbId })),
    }, select: { contentType: true, tmdbId: true } });
    await Promise.all(titles.filter(title => !existing.some(item => item.contentType === toTrackedContentType(title.contentType) && item.tmdbId === title.tmdbId)).map(async title => {
      if (title.contentType === 'movie') await this.catalogue!.getMovie(title.tmdbId);
      else await this.catalogue!.getSeries(title.tmdbId);
    }));
  }

  private async resolveVoteItems(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], watchlistId: string, itemIds: string[], titles: SharedWatchlistItemDto[]) {
    const ids = new Set(itemIds);
    for (const title of titles) {
      const contentType = toTrackedContentType(title.contentType);
      const row = await tx.sharedWatchlistItem.upsert({
        where: { watchlistId_contentType_tmdbId: { watchlistId, contentType, tmdbId: title.tmdbId } },
        create: { watchlistId, contentType, tmdbId: title.tmdbId }, update: {},
      });
      ids.add(row.id);
    }
    return [...ids];
  }

  async addVotingCandidates(identity: AuthenticatedIdentity, watchlistId: string, sessionId: string, itemIds: string[], titles: SharedWatchlistItemDto[] = []) {
    const userId = await this.getUserId(identity);
    await this.assertMember(userId, watchlistId);
    if (!(itemIds.length + titles.length) || itemIds.length + titles.length > 10) throw new BadRequestException('Choose between 1 and 10 titles.');
    await this.validateCatalogueTitles(watchlistId, titles);
    await this.prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "shared_voting_sessions" WHERE id = ${sessionId}::uuid AND "watchlistId" = ${watchlistId}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Voting session not found.');
      const session = await tx.sharedVotingSession.findUniqueOrThrow({ where: { id: sessionId }, include: { candidates: true } });
      if (session.status !== SharedVotingStatus.OPEN || session.closesAt <= new Date()) throw new BadRequestException('Voting session is closed.');
      const ids = await this.resolveVoteItems(tx, watchlistId, itemIds, titles);
      if (await tx.sharedWatchlistItem.count({ where: { watchlistId, id: { in: ids } } }) !== ids.length) {
        throw new BadRequestException('Voting candidates must belong to this shared watchlist.');
      }
      const existing = new Set(session.candidates.map(candidate => candidate.itemId));
      const added = ids.filter(id => !existing.has(id));
      if (existing.size + added.length > 10) throw new BadRequestException('A vote can include up to 10 titles.');
      await tx.sharedVotingCandidate.createMany({ data: added.map(itemId => ({ itemId, sessionId })), skipDuplicates: true });
      await tx.sharedVotingSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    });
    await this.touchSharedWatchlist(watchlistId);
    return this.getVotingSession(identity, watchlistId, sessionId);
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
          select: { closesAt: true, status: true, allowMultipleVotes: true },
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

        if (votingSession.allowMultipleVotes === false) {
          await transaction.sharedVotingVote.deleteMany({ where: { userId, candidate: { sessionId }, candidateId: { not: candidateId } } });
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
            closedAt: new Date(Math.min(Date.now(), session.closesAt.getTime())),
            status: SharedVotingStatus.CLOSED,
            winningCandidateId,
          },
          where: { id: sessionId },
        });

        return { closed: true, found: true, transitioned: true };
      }),
    );

    if (result.closed) {
      try { await this.createFinalVoteNotifications(watchlistId, sessionId); }
      catch { this.logger.warn(`Result notification for ${sessionId} will be retried by the vote worker.`); }
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

    if (!session.closedAt || session.closedAt.getTime() < Date.now() - 6 * 3600_000) return;
    const dedupeKey = `shared-vote-final:${sessionId}`;
    const recipients = session.watchlist.members;
    const existing = await this.prisma.notification.findMany({ where: { dedupeKey }, select: { id: true, userId: true, title: true } });
    const notificationTitle = `Vote result for: ${session.watchlist.name}`.slice(0, 160);
    if (recipients.every(member => existing.some(row => row.userId === member.userId && row.title === notificationTitle))) {
      for (const notification of existing) await this.push?.enqueueWatchlistVote(notification.userId, notification.id);
      return;
    }
    const maxVotes = Math.max(0, ...session.candidates.map(candidate => candidate.votes.length));
    const leaders = await Promise.all(session.candidates.filter(candidate => maxVotes > 0 && candidate.votes.length === maxVotes).map(async candidate => {
      const contentType = fromTrackedContentType(candidate.item.contentType);
      const media = contentType === 'movie' ? await this.catalogue!.getMovie(candidate.item.tmdbId) : await this.catalogue!.getSeries(candidate.item.tmdbId);
      return { contentType, tmdbId: candidate.item.tmdbId, title: media.item.title };
    }));
    const body = leaders.length ? leaders.map(leader => leader.title).join(', ') : 'No votes cast';
    await this.withConnectionRetry(() =>
      this.prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          actorUserId: null,
          body: body.slice(0, 500),
          dedupeKey,
          kind: NotificationKind.SHARED_VOTE_UPDATE,
          routeMetadata: {
            final: true,
            leaders,
            route: 'SharedWatchlist',
            watchlistName: session.watchlist.name,
            votingSessionId: sessionId,
            watchlistId,
            winningCandidateId: session.winningCandidateId,
          },
          sharedWatchlistId: watchlistId,
          title: notificationTitle,
          userId: recipient.userId,
          votingSessionId: sessionId,
        })),
        skipDuplicates: true,
      }),
    );
    await this.prisma.notification.updateMany({ where: { dedupeKey }, data: { title: notificationTitle, body: body.slice(0, 500) } });
    const notifications = await this.prisma.notification.findMany({ where: { dedupeKey }, select: { id: true, userId: true } });
    for (const notification of notifications) await this.push?.enqueueWatchlistVote(notification.userId, notification.id);
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
    const notificationActorId = session.isAnonymous ? null : actorUserId;
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
              actorUserId: notificationActorId,
              body,
              dedupeKey,
              kind: NotificationKind.SHARED_VOTE_UPDATE,
              routeMetadata,
              sharedWatchlistId: watchlistId,
              title: `Vote update for: ${session.watchlist.name}`.slice(0, 160),
              userId: recipient.userId,
              votingSessionId: sessionId,
            },
            update: {
              actorUserId: notificationActorId,
              body,
              readAt: null,
              routeMetadata,
              title: `Vote update for: ${session.watchlist.name}`.slice(0, 160),
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

  async updateCover(identity: AuthenticatedIdentity, watchlistId: string, itemIds: string[]) {
    if (itemIds.length > 4 || new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Choose up to 4 different titles.');
    }
    const userId = await this.getUserId(identity);
    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      const watchlist = await transaction.sharedWatchlist.findFirst({
        where: { id: watchlistId, ownerId: userId },
        include: { items: { select: { id: true } } },
      });
      if (!watchlist) throw new NotFoundException('Watchlist not found.');
      if (itemIds.some((id) => !watchlist.items.some((item) => item.id === id))) {
        throw new BadRequestException('Cover titles must belong to this watchlist.');
      }
      await transaction.sharedWatchlist.update({
        where: { id: watchlistId },
        data: { coverItemIds: itemIds },
      });
      return { coverItemIds: itemIds };
    }));
  }

  async updateBackground(identity: AuthenticatedIdentity, watchlistId: string, itemId: string | null) {
    const userId = await this.getUserId(identity);
    return this.withConnectionRetry(() => this.prisma.$transaction(async (transaction) => {
      const watchlist = await transaction.sharedWatchlist.findFirst({
        where: { id: watchlistId, ownerId: userId },
        include: { items: { select: { id: true } } },
      });
      if (!watchlist) throw new NotFoundException('Watchlist not found.');
      if (itemId && !watchlist.items.some((item) => item.id === itemId)) {
        throw new BadRequestException('The background title must belong to this watchlist.');
      }
      await transaction.sharedWatchlist.update({
        where: { id: watchlistId },
        data: { backgroundItemId: itemId },
      });
      return { backgroundItemId: itemId };
    }));
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
  creatorId?: string | null;
  candidates: {
    createdAt: Date;
    id: string;
    itemId: string;
    item: {
      contentType: TrackedContentType;
      tmdbId: number;
    };
    votes: { userId: string; user: { displayName: string | null; avatarObjectKey?: string | null } }[];
  }[];
  closedAt: Date | null;
  closesAt: Date;
  createdAt: Date;
  id: string;
  status: SharedVotingStatus;
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  title: string;
  updatedAt: Date;
  winningCandidateId: string | null;
};

function toVotingSession(session: SharedVotingSessionRecord, userId: string, avatarUrl: (key: string | null) => string | null) {
  const candidates = session.candidates.map((candidate) => ({
    contentType: fromTrackedContentType(candidate.item.contentType),
    id: candidate.id,
    itemId: candidate.itemId,
    tmdbId: candidate.item.tmdbId,
    userHasVoted: candidate.votes.some((vote) => vote.userId === userId),
    voteCount: candidate.votes.length,
    ...(session.isAnonymous ? {} : { voters: candidate.votes.map((vote) => ({
      id: vote.userId, displayName: vote.user.displayName ?? 'Watchly member', avatarUrl: avatarUrl(vote.user.avatarObjectKey ?? null),
    })) }),
  }));
  const maxVotes = Math.max(0, ...candidates.map((candidate) => candidate.voteCount));
  const leaders =
    maxVotes === 0 ? [] : candidates.filter((candidate) => candidate.voteCount === maxVotes);

  return {
    candidates,
    isCreator: session.creatorId === userId,
    closedAt: session.closedAt?.toISOString() ?? null,
    closesAt: session.closesAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    id: session.id,
    leaders,
    status: session.status,
    isAnonymous: session.isAnonymous,
    allowMultipleVotes: session.allowMultipleVotes,
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
