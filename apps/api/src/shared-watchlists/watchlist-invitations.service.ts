import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { FollowStatus, NotificationKind } from '../generated/prisma/enums';
import { AvatarStorageService } from '../media/avatar-storage.service';
import { activeAccountWhere } from '../moderation/account-suspension';
import { PushService } from '../push/push.service';

const REINVITE_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 30;

export function invitationStatus(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const status = (metadata as Record<string, unknown>).invitationStatus;
  return status === 'pending' || status === 'accepted' || status === 'declined' ? status : null;
}

@Injectable()
export class WatchlistInvitationsService {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvatarStorageService) private readonly avatars: AvatarStorageService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  async search(identity: AuthenticatedIdentity, watchlistId: string, value = '') {
    const userId = (await this.auth.getOrCreateUser(identity)).id;
    await this.assertMember(this.prisma, userId, watchlistId);
    const query = value.trim().replace(/^@/, '');
    if (query.length > 80) throw new BadRequestException('Search must be 80 characters or fewer.');
    if (query && query.length < 2) return { items: [] };
    const literalQuery = query.replace(/[\\%_]/g, '\\$&');
    const connected: Prisma.UserWhereInput = {
      OR: [
        { following: { some: { followedUserId: userId, status: FollowStatus.ACCEPTED } } },
        { followers: { some: { followerId: userId, status: FollowStatus.ACCEPTED } } },
      ],
    };
    // Rank exact handles before prefixes and name matches, without truncating before ranking.
    const tiers: Prisma.UserWhereInput[] = query ? [
      { handle: { equals: literalQuery, mode: 'insensitive' } },
      { handle: { startsWith: literalQuery, mode: 'insensitive' } },
      { displayName: { startsWith: literalQuery, mode: 'insensitive' } },
      { OR: [
        { handle: { contains: literalQuery, mode: 'insensitive' } },
        { displayName: { contains: literalQuery, mode: 'insensitive' } },
      ] },
    ] : [connected];
    const items = [];
    const ids = [userId];
    for (const tier of tiers) {
      const users = await this.prisma.withConnectionRetry(() => this.prisma.user.findMany({
        where: {
          AND: [activeAccountWhere(), tier], id: { notIn: ids },
          onboardingCompleted: true, handle: { not: null },
          blockedUsers: { none: { blockedUserId: userId } },
          blockedBy: { none: { blockerId: userId } },
        },
        orderBy: [{ handle: 'asc' }, { id: 'asc' }], take: SEARCH_LIMIT - items.length,
        select: {
          id: true, handle: true, displayName: true, avatarObjectKey: true,
          privacySettings: { select: { allowWatchlistInvitesFromAnyone: true } },
          followers: { where: { followerId: userId, status: FollowStatus.ACCEPTED }, select: { id: true } },
          following: { where: { followedUserId: userId, status: FollowStatus.ACCEPTED }, select: { id: true } },
          sharedWatchlistMemberships: { where: { watchlistId }, select: { id: true } },
          notifications: {
            where: { dedupeKey: `shared-list-invite:${watchlistId}`, kind: NotificationKind.SHARED_LIST_INVITE },
            select: { routeMetadata: true, updatedAt: true },
          },
        },
      }));
      for (const user of users) {
        ids.push(user.id);
        const isFollowing = user.followers.length > 0;
        const followsYou = user.following.length > 0;
        const previous = user.notifications[0];
        const status = invitationStatus(previous?.routeMetadata);
        const state = user.sharedWatchlistMemberships.length ? 'member'
          : status === 'pending' ? 'pending'
          : status && previous && previous.updatedAt.getTime() > Date.now() - REINVITE_DELAY_MS ? 'recently_invited'
          : user.privacySettings?.allowWatchlistInvitesFromAnyone || followsYou ? 'available'
          : 'restricted';
        items.push({
          id: user.id, handle: user.handle, displayName: user.displayName ?? 'Watchly member',
          avatarUrl: this.avatars.getPublicUrl(user.avatarObjectKey), isFollowing, followsYou, state,
        });
      }
      if (items.length === SEARCH_LIMIT) break;
    }
    return { items };
  }

  async invite(identity: AuthenticatedIdentity, watchlistId: string, recipientId: string) {
    const actor = await this.auth.getOrCreateUser(identity);
    if (actor.id === recipientId) throw new BadRequestException('You already belong to this watchlist.');
    const notification = await this.prisma.withConnectionRetry(() => this.prisma.$transaction(async (tx) => {
      // Serialize the sender's quota and invitations from different members of this list.
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${actor.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "shared_watchlists" WHERE id = ${watchlistId}::uuid FOR UPDATE`;
      const watchlist = await this.assertMember(tx, actor.id, watchlistId);
      await this.assertCanInvite(tx, actor.id, recipientId);
      if (await tx.sharedWatchlistMember.findUnique({ where: { watchlistId_userId: { watchlistId, userId: recipientId } } })) {
        throw new BadRequestException('This person is already a member.');
      }
      const dedupeKey = `shared-list-invite:${watchlistId}`;
      const existing = await tx.notification.findUnique({ where: { userId_dedupeKey: { userId: recipientId, dedupeKey } } });
      if (invitationStatus(existing?.routeMetadata) === 'pending') return existing!;
      if (existing && invitationStatus(existing.routeMetadata) && existing.updatedAt.getTime() > Date.now() - REINVITE_DELAY_MS) {
        throw new BadRequestException('Please wait 7 days before inviting this person again.');
      }
      const recent = await tx.notification.count({ where: {
        actorUserId: actor.id, kind: NotificationKind.SHARED_LIST_INVITE,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      } });
      if (recent >= 20) throw new BadRequestException('You can send up to 20 watchlist invitations a day.');
      // Replacing a resolved invitation gives the new request its own push deduplication key.
      if (existing) await tx.notification.delete({ where: { id: existing.id } });
      return tx.notification.create({ data: {
        actorUserId: actor.id, userId: recipientId, dedupeKey, sharedWatchlistId: watchlistId,
        kind: NotificationKind.SHARED_LIST_INVITE, title: 'Watchlist invitation',
        body: `${actor.displayName || 'A Watchly member'} invited you to join “${watchlist.name}”.`,
        routeMetadata: { route: 'Notifications', watchlistId, watchlistName: watchlist.name, invitationStatus: 'pending' },
      } });
    }));
    await this.push.enqueueWatchlistInvitation(recipientId, notification.id);
    return { invited: true as const };
  }

  async respond(identity: AuthenticatedIdentity, notificationId: string, accept: boolean) {
    const userId = (await this.auth.getOrCreateUser(identity)).id;
    return this.prisma.withConnectionRetry(() => this.prisma.$transaction(async (tx) => {
      // Share the membership quota lock with watchlist creation and leaving.
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
      const notification = await tx.notification.findFirst({
        where: { id: notificationId, userId, kind: NotificationKind.SHARED_LIST_INVITE },
        include: { sharedWatchlist: true },
      });
      if (!notification?.sharedWatchlist || !notification.actorUserId || !invitationStatus(notification.routeMetadata)) {
        throw new NotFoundException('Invitation not found.');
      }
      const status = accept ? 'accepted' : 'declined';
      const currentStatus = invitationStatus(notification.routeMetadata);
      if (currentStatus !== 'pending' && currentStatus !== status) {
        throw new BadRequestException('This invitation has already been answered.');
      }
      const watchlist = notification.sharedWatchlist;
      if (currentStatus === status) return { status, watchlistId: watchlist.id, title: watchlist.name };
      if (accept) {
        await this.assertMember(tx, notification.actorUserId, watchlist.id);
        await this.assertCanInvite(tx, notification.actorUserId, userId);
        const existing = await tx.sharedWatchlistMember.findUnique({ where: { watchlistId_userId: { watchlistId: watchlist.id, userId } } });
        if (!existing) {
          const count = await tx.sharedWatchlistMember.count({ where: { userId } });
          if (count >= 5) throw new BadRequestException('You can belong to up to 5 shared watchlists. Leave one before accepting.');
          await tx.sharedWatchlistMember.create({ data: { userId, watchlistId: watchlist.id } });
        }
        await tx.sharedWatchlist.update({ where: { id: watchlist.id }, data: { updatedAt: new Date() } });
      }
      await tx.notification.update({ where: { id: notification.id }, data: {
        body: accept ? `You joined “${watchlist.name}”.` : `You declined the invitation to “${watchlist.name}”.`,
        readAt: new Date(), routeMetadata: {
          route: accept ? 'SharedWatchlist' : 'Notifications', watchlistId: watchlist.id,
          watchlistName: watchlist.name, invitationStatus: status,
        },
      } });
      return { status, watchlistId: watchlist.id, title: watchlist.name };
    }));
  }

  private async assertMember(tx: Pick<Prisma.TransactionClient, 'sharedWatchlist'>, userId: string, watchlistId: string) {
    const watchlist = await tx.sharedWatchlist.findFirst({ where: { id: watchlistId, owner: activeAccountWhere(),
      members: { some: { userId, user: activeAccountWhere() } } } });
    if (!watchlist) throw new NotFoundException('Shared watchlist not found.');
    return watchlist;
  }

  private async assertCanInvite(tx: Prisma.TransactionClient, actorId: string, recipientId: string) {
    const recipient = await tx.user.findFirst({
      where: { id: recipientId, AND: [activeAccountWhere()], onboardingCompleted: true,
        blockedUsers: { none: { blockedUserId: actorId } }, blockedBy: { none: { blockerId: actorId } } },
      include: { privacySettings: true },
    });
    if (!recipient) throw new NotFoundException('This account is unavailable.');
    if (recipient.privacySettings?.allowWatchlistInvitesFromAnyone) return;
    const connection = await tx.userFollow.findFirst({ where: {
      status: FollowStatus.ACCEPTED, followerId: recipientId, followedUserId: actorId,
    } });
    if (!connection) throw new ForbiddenException('This person only accepts invitations from people they follow.');
  }
}
