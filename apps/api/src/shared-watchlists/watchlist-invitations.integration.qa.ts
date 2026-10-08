import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type User } from '../generated/prisma/client';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { ProfileService } from '../profile/profile.service';
import { SharedWatchlistsService } from './shared-watchlists.service';
import { invitationStatus, WatchlistInvitationsService } from './watchlist-invitations.service';

async function run() {
  const connectionString = process.env.DATABASE_URL!;
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname), 'Use a local test database');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const rollback = new Error('Rollback invitation QA fixtures');
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const suffix = randomUUID().slice(0, 8);
      const users: User[] = [];
      for (const name of ['owner', 'friend', 'follower', 'stranger', 'blocked', 'suspended', 'pending', 'guest']) {
        users.push(await tx.user.create({ data: { firebaseUid: `invitation-${name}-${suffix}`, displayName: `${name} Person`,
          handle: `${name}_${suffix}`, onboardingCompleted: true } }));
      }
      const [owner, friend, follower, stranger, blocked, suspended, pending, guest] = users;
      const identity = (id: string) => ({ firebaseUid: id }) as AuthenticatedIdentity;
      const auth = { getOrCreateUser: async (input: AuthenticatedIdentity) => users.find((user) => user.id === input.firebaseUid)! };
      let savepoint = 0;
      const database = new Proxy(tx, { get(target, key) {
        if (key === 'withConnectionRetry') return (operation: () => unknown) => operation();
        if (key === '$transaction') return async (operation: (transaction: typeof tx) => unknown) => {
          const name = `qa_${++savepoint}`;
          await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
          try { const result = await operation(tx); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); return result; }
          catch (error) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); throw error; }
        };
        return Reflect.get(target, key);
      } });
      const pushes = new Set<string>();
      const invitations = new WatchlistInvitationsService(auth as never, database as never,
        { getPublicUrl: () => null } as never,
        { enqueueWatchlistInvitation: async (_userId: string, id: string) => pushes.add(id) } as never);
      const votePushes: string[] = [];
      let catalogueUnavailable = false;
      const lists = new SharedWatchlistsService(auth as never, database as never,
        { getPublicUrl: (key: string | null) => key ? `https://images.example/${key}` : null } as never,
        { enqueueWatchlistVote: async (_userId: string, id: string) => votePushes.push(id) } as never,
        { getMovie: async (id: number) => { if (catalogueUnavailable) throw new Error('Catalogue unavailable'); return { item: { title: `Movie ${id}` } }; }, getSeries: async (id: number) => ({ item: { title: `Series ${id}` } }) } as never);
      const profiles = new ProfileService(auth as never, {} as never, database as never, { getPublicUrl: () => null } as never);
      const inbox = new NotificationsService(auth as never, database as never, {} as never, {} as never, {} as never);
      const list = await lists.createSharedWatchlist(identity(owner!.id), 'Movie night');
      const invite = (userId: string) => invitations.invite(identity(owner!.id), list.id, userId);
      const request = (userId: string) => tx.notification.findUniqueOrThrow({ where: {
        userId_dedupeKey: { userId, dedupeKey: `shared-list-invite:${list.id}` },
      } });
      const privacy = await tx.privacySettings.create({ data: { userId: stranger!.id } });
      assert.equal(privacy.allowWatchlistInvitesFromAnyone, false, 'Default must deny invitations from strangers');
      await assert.rejects(invite(stranger!.id), ForbiddenException);
      await tx.userFollow.createMany({ data: [
        { followerId: owner!.id, followedUserId: friend!.id },
        { followerId: follower!.id, followedUserId: owner!.id },
        { followerId: pending!.id, followedUserId: owner!.id, status: 'PENDING' },
      ] });
      await assert.rejects(invite(friend!.id), ForbiddenException, 'Following the recipient must not authorize invitations');
      assert.equal(await tx.notification.count({ where: { userId: friend!.id } }), 0);
      assert.equal(pushes.size, 0, 'An unauthorized invitation must not enqueue a push');
      await assert.rejects(invite(pending!.id), ForbiddenException, 'Pending follow requests do not count as connections');
      await assert.rejects(invitations.invite(identity(stranger!.id), list.id, friend!.id), NotFoundException);
      await assert.rejects(invitations.search(identity(stranger!.id), list.id), NotFoundException);
      await assert.rejects(invite(owner!.id), BadRequestException);
      await tx.userBlock.create({ data: { blockerId: owner!.id, blockedUserId: blocked!.id } });
      await tx.user.update({ where: { id: suspended!.id }, data: { suspendedAt: new Date() } });
      const suggestions = (await invitations.search(identity(owner!.id), list.id)).items;
      assert.deepEqual(new Set(suggestions.map((item) => item.id)), new Set([friend!.id, follower!.id]));
      const results = (await invitations.search(identity(owner!.id), list.id, 'person')).items;
      assert.ok(!results.some((item) => [owner!.id, blocked!.id, suspended!.id].includes(item.id)));
      assert.equal(results.find((item) => item.id === stranger!.id)?.state, 'restricted');
      assert.equal(results.find((item) => item.id === friend!.id)?.state, 'restricted', 'Following someone does not make them invitable');
      assert.equal(results.find((item) => item.id === follower!.id)?.state, 'available', 'A recipient who follows the sender can be invited');
      assert.equal((await invitations.search(identity(owner!.id), list.id, `@${friend!.handle!.toUpperCase()}`)).items[0]?.id, friend!.id);
      assert.equal((await invitations.search(identity(owner!.id), list.id, 'x')).items.length, 0);
      assert.equal((await invitations.search(identity(owner!.id), list.id, '%%')).items.length, 0, 'Search treats wildcard characters literally');
      await tx.userFollow.create({ data: { followerId: friend!.id, followedUserId: owner!.id } });
      await invite(friend!.id);
      await invite(friend!.id);
      assert.equal(pushes.size, 1, 'A duplicate invitation keeps the same push identity');
      assert.equal((await lists.listSharedWatchlists(identity(friend!.id))).items.length, 0);
      await assert.rejects(lists.getSharedWatchlist(identity(friend!.id), list.id), NotFoundException);
      const first = await request(friend!.id);
      assert.equal(invitationStatus(first.routeMetadata), 'pending');
      await tx.notification.update({ where: { id: first.id }, data: { readAt: new Date() } });
      await tx.notification.createMany({ data: Array.from({ length: 35 }, (_, i) => ({
        userId: friend!.id, kind: 'RELEASE' as const, title: 'Other alert', body: 'Release', dedupeKey: `qa-${i}`,
      })) });
      assert.ok((await inbox.list(identity(friend!.id))).items.some((item) => item.id === first.id), 'A read pending invitation survives inbox truncation');
      await assert.rejects(invitations.respond(identity(stranger!.id), first.id, true), NotFoundException);
      await tx.userFollow.delete({ where: { followerId_followedUserId: { followerId: friend!.id, followedUserId: owner!.id } } });
      await assert.rejects(invitations.respond(identity(friend!.id), first.id, true), ForbiddenException, 'The sender still following the recipient cannot authorize acceptance');
      assert.equal(await tx.sharedWatchlistMember.count({ where: { userId: friend!.id, watchlistId: list.id } }), 0);
      await tx.userFollow.create({ data: { followerId: friend!.id, followedUserId: owner!.id } });
      await invitations.respond(identity(friend!.id), first.id, true);
      await invitations.respond(identity(friend!.id), first.id, true);
      assert.equal((await lists.getSharedWatchlist(identity(friend!.id), list.id)).memberCount, 2);
      await assert.rejects(invitations.respond(identity(friend!.id), first.id, false), BadRequestException);
      await tx.user.update({ where: { id: owner!.id }, data: { avatarObjectKey: 'owner.jpg' } });
      const movie = await lists.addItem(identity(friend!.id), list.id, { contentType: 'movie', tmdbId: 603 });
      const series = await lists.addItem(identity(owner!.id), list.id, { contentType: 'series', tmdbId: 1399 });
      for (const durationMinutes of [14, 10081, 15.5]) {
        await assert.rejects(lists.createVotingSession(identity(friend!.id), list.id, 'Invalid', [movie.id], { durationMinutes }), BadRequestException);
      }
      await assert.rejects(lists.createVotingSession(identity(stranger!.id), list.id, 'Outsider', [movie.id]), NotFoundException);
      const beforeVote = Date.now();
      const named = await lists.createVotingSession(identity(friend!.id), list.id, 'Member vote', [movie.id, series.id], { durationMinutes: 60, isAnonymous: false });
      assert.equal(named.isAnonymous, false);
      assert.ok(Date.parse(named.closesAt) >= beforeVote + 60 * 60_000 && Date.parse(named.closesAt) <= Date.now() + 60 * 60_000);
      const namedResult = await lists.voteForCandidate(identity(owner!.id), list.id, named.id, named.candidates[0]!.id);
      assert.equal(namedResult.candidates[0]!.voters?.[0]?.id, owner!.id);
      assert.equal(namedResult.candidates[0]!.voters?.[0]?.avatarUrl, 'https://images.example/owner.jpg');
      const anonymous = await lists.createVotingSession(identity(friend!.id), list.id, 'Anonymous', [movie.id], { durationMinutes: 15, isAnonymous: true });
      const anonymousResult = await lists.voteForCandidate(identity(owner!.id), list.id, anonymous.id, anonymous.candidates[0]!.id);
      assert.equal(anonymousResult.candidates[0]!.voteCount, 1);
      assert.ok(!('voters' in anonymousResult.candidates[0]!), 'Anonymous vote responses must not disclose voters');
      assert.ok(!('voters' in anonymousResult.leaders[0]!), 'Anonymous leaders must not disclose voters');
      assert.equal((await tx.notification.findFirstOrThrow({ where: { dedupeKey: `shared-vote-update:${anonymous.id}` } })).actorUserId, null, 'Anonymous vote alerts must not identify the voter');
      const memberView = await lists.getSharedWatchlist(identity(friend!.id), list.id);
      assert.equal(memberView.members.find(row => row.id === owner!.id)?.avatarUrl, 'https://images.example/owner.jpg');
      assert.ok(!('voters' in memberView.votingSessions.find(row => row.id === anonymous.id)!.candidates[0]!));
      assert.equal(memberView.votingSessions.find(row => row.id === named.id)!.candidates[0]!.voters?.[0]?.id, owner!.id);
      const summary = (await lists.listSharedWatchlists(identity(friend!.id))).items.find(row => row.id === list.id)!;
      assert.equal(summary.members.find(row => row.id === owner!.id)?.avatarUrl, 'https://images.example/owner.jpg');
      const startAlerts = await tx.notification.findMany({ where: { dedupeKey: `shared-vote-start:${named.id}` } });
      assert.deepEqual(startAlerts.map(row => row.userId), [owner!.id], 'Starting a vote notifies other members only');
      assert.ok(votePushes.includes(startAlerts[0]!.id), 'Starting a vote must enqueue its notification');
      assert.equal((startAlerts[0]!.routeMetadata as { route: string }).route, 'SharedWatchlist');
      assert.equal(named.allowMultipleVotes, true);
      const multiple = await lists.voteForCandidate(identity(owner!.id), list.id, named.id, named.candidates[1]!.id);
      assert.equal(multiple.candidates.filter(row => row.userHasVoted).length, 2, 'Multiple voting keeps previous choices');
      const single = await lists.createVotingSession(identity(friend!.id), list.id, 'Single choice', [movie.id, series.id], { allowMultipleVotes: false });
      await lists.voteForCandidate(identity(owner!.id), list.id, single.id, single.candidates[0]!.id);
      await lists.voteForCandidate(identity(friend!.id), list.id, single.id, single.candidates[0]!.id);
      const replacement = await lists.voteForCandidate(identity(owner!.id), list.id, single.id, single.candidates[1]!.id);
      assert.equal(replacement.allowMultipleVotes, false);
      assert.deepEqual(replacement.candidates.filter(row => row.userHasVoted).map(row => row.id), [single.candidates[1]!.id]);
      assert.equal(replacement.candidates[0]!.voteCount, 1, 'Replacing a choice preserves other members votes');
      await assert.rejects(lists.voteForCandidate(identity(owner!.id), list.id, single.id, named.candidates[0]!.id), NotFoundException);
      assert.equal((await lists.getVotingSession(identity(owner!.id), list.id, single.id)).candidates[1]!.userHasVoted, true, 'An invalid choice must not erase the existing vote');
      const extra = await lists.addItem(identity(friend!.id), list.id, { contentType: 'movie', tmdbId: 11 });
      await assert.rejects(lists.addVotingCandidates(identity(stranger!.id), list.id, single.id, [extra.id]), NotFoundException);
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, single.id, []), BadRequestException);
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, single.id, [randomUUID()]), BadRequestException);
      const extended = await lists.addVotingCandidates(identity(friend!.id), list.id, single.id, [extra.id, extra.id]);
      assert.equal(extended.candidates.length, 3, 'A regular member can add titles to an active vote');
      assert.equal(extended.candidates.find(row => row.itemId === movie.id)!.voteCount, 1, 'Adding titles preserves votes');
      assert.equal((await lists.addVotingCandidates(identity(friend!.id), list.id, single.id, [extra.id])).candidates.length, 3, 'Repeated additions are idempotent');
      const otherList = await lists.createSharedWatchlist(identity(owner!.id), 'Other list');
      const otherItem = await lists.addItem(identity(owner!.id), otherList.id, { contentType: 'movie', tmdbId: 12 });
      await assert.rejects(lists.addVotingCandidates(identity(owner!.id), list.id, single.id, [otherItem.id]), BadRequestException);
      const extras = await tx.sharedWatchlistItem.createManyAndReturn({ data: Array.from({ length: 18 }, (_, i) => ({ watchlistId: list.id, contentType: 'MOVIE' as const, tmdbId: 100 + i })) });
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, single.id, extras.map(row => row.id)), BadRequestException);
      assert.equal((await lists.getVotingSession(identity(owner!.id), list.id, single.id)).candidates.length, 3, 'The limit must reject the entire addition');
      await lists.closeVotingSession(identity(owner!.id), list.id, single.id);
      const finalAlerts = await tx.notification.findMany({ where: { dedupeKey: `shared-vote-final:${single.id}` } });
      assert.deepEqual(new Set(finalAlerts.map(row => row.userId)), new Set([owner!.id, friend!.id]), 'Final results notify every member, including the owner');
      assert.match(finalAlerts[0]!.body, /Movie 603/);
      assert.match(finalAlerts[0]!.body, /Series 1399/);
      assert.ok(finalAlerts.every(row => row.actorUserId === null && votePushes.includes(row.id)));
      assert.equal(finalAlerts[0]!.title, 'Vote result for: Movie night');
      await assert.rejects(lists.dismissVotingSession(identity(stranger!.id), list.id, single.id), NotFoundException);
      await assert.rejects(lists.dismissVotingSession(identity(friend!.id), otherList.id, single.id), NotFoundException);
      await assert.rejects(lists.dismissVotingSession(identity(friend!.id), list.id, named.id), BadRequestException);
      await lists.dismissVotingSession(identity(friend!.id), list.id, single.id);
      await lists.dismissVotingSession(identity(friend!.id), list.id, single.id);
      assert.equal(await tx.sharedVotingDismissal.count({ where: { sessionId: single.id } }), 1, 'Repeated dismissal is idempotent');
      assert.ok(!(await lists.getSharedWatchlist(identity(friend!.id), list.id)).votingSessions.some(vote => vote.id === single.id), 'The result stays hidden on a fresh account read');
      assert.ok((await lists.getSharedWatchlist(identity(owner!.id), list.id)).votingSessions.some(vote => vote.id === single.id), 'Other members still see the result');
      assert.equal((await lists.getVotingSession(identity(owner!.id), list.id, single.id)).candidates.length, 3, 'Hiding does not delete the vote or choices');
      const extraMembers = [follower!.id, stranger!.id, pending!.id, guest!.id];
      await tx.sharedWatchlistMember.createMany({ data: extraMembers.map(userId => ({ userId, watchlistId: list.id })) });
      const card = (await lists.listSharedWatchlists(identity(owner!.id))).items.find(row => row.id === list.id)!;
      assert.equal(card.memberCount, 6); assert.equal(card.members.length, 5, 'Cards receive five avatars plus an accurate overflow count');
      await tx.sharedWatchlistMember.deleteMany({ where: { watchlistId: list.id, userId: { in: extraMembers } } });
      const fromCatalogue = await lists.createVotingSession(identity(friend!.id), list.id, 'Global search', [], {
        titles: [{ contentType: 'movie', tmdbId: 222 }],
      });
      assert.equal(fromCatalogue.candidates.length, 1);
      assert.equal(await tx.sharedWatchlistItem.count({ where: { watchlistId: list.id, tmdbId: 222 } }), 1);
      const globalAdded = await lists.addVotingCandidates(identity(friend!.id), list.id, fromCatalogue.id, [], [{ contentType: 'movie', tmdbId: 333 }]);
      assert.equal(globalAdded.candidates.length, 2);
      assert.equal((await lists.addVotingCandidates(identity(friend!.id), list.id, fromCatalogue.id, [], [{ contentType: 'movie', tmdbId: 333 }])).candidates.length, 2);
      const eight = Array.from({ length: 8 }, (_, i) => ({ contentType: 'movie' as const, tmdbId: 400 + i }));
      assert.equal((await lists.addVotingCandidates(identity(friend!.id), list.id, fromCatalogue.id, [], eight)).candidates.length, 10);
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, fromCatalogue.id, [], [{ contentType: 'movie', tmdbId: 999 }]), BadRequestException);
      assert.equal(await tx.sharedWatchlistItem.count({ where: { watchlistId: list.id, tmdbId: 999 } }), 0, 'Rejected additions must not leave a new title in the watchlist');
      await assert.rejects(lists.createVotingSession(identity(friend!.id), list.id, 'Too many', [], { titles: [...eight, { contentType: 'movie', tmdbId: 222 }, { contentType: 'movie', tmdbId: 333 }, { contentType: 'movie', tmdbId: 999 }] }), BadRequestException);
      await lists.voteForCandidate(identity(owner!.id), list.id, fromCatalogue.id, fromCatalogue.candidates[0]!.id);
      const endedAt = new Date(Date.now() - 1000);
      await tx.sharedVotingSession.update({ where: { id: fromCatalogue.id }, data: { closesAt: endedAt } });
      await lists.finalizeDueVotes();
      assert.equal((await tx.sharedVotingSession.findUniqueOrThrow({ where: { id: fromCatalogue.id } })).closedAt!.getTime(), endedAt.getTime());
      const finished = await tx.notification.findMany({ where: { dedupeKey: `shared-vote-final:${fromCatalogue.id}` } });
      assert.equal(finished.length, 2, 'Expiration sends results without any member opening the watchlist');
      assert.equal(finished[0]!.title, 'Vote result for: Movie night');
      assert.equal(finished[0]!.body, 'Movie 222');
      await lists.finalizeDueVotes();
      assert.equal(await tx.notification.count({ where: { dedupeKey: `shared-vote-final:${fromCatalogue.id}` } }), 2, 'The background worker must not duplicate final alerts');
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, single.id, [extras[0]!.id]), BadRequestException);
      const retryResult = await lists.createVotingSession(identity(friend!.id), list.id, 'Retry final notification', [movie.id]);
      await lists.voteForCandidate(identity(owner!.id), list.id, retryResult.id, retryResult.candidates[0]!.id);
      catalogueUnavailable = true;
      assert.equal((await lists.closeVotingSession(identity(owner!.id), list.id, retryResult.id)).status, 'CLOSED', 'Notification delivery failures must not roll back a successful close');
      assert.equal(await tx.notification.count({ where: { dedupeKey: `shared-vote-final:${retryResult.id}` } }), 0);
      catalogueUnavailable = false;
      await lists.finalizeDueVotes();
      assert.equal(await tx.notification.count({ where: { dedupeKey: `shared-vote-final:${retryResult.id}` } }), 2, 'The worker retries final notifications after a catalogue outage');
      assert.equal(named.isCreator, true, 'A regular member is recorded as the vote creator');
      assert.equal((await lists.getVotingSession(identity(owner!.id), list.id, named.id)).isCreator, false);
      await assert.rejects(lists.deleteVotingSession(identity(owner!.id), list.id, named.id), ForbiddenException, 'List ownership does not grant deletion of another member vote');
      await assert.rejects(lists.deleteVotingSession(identity(stranger!.id), list.id, named.id), NotFoundException);
      await assert.rejects(lists.deleteVotingSession(identity(friend!.id), otherList.id, named.id), NotFoundException);
      const titleCount = await tx.sharedWatchlistItem.count({ where: { watchlistId: list.id } });
      await lists.deleteVotingSession(identity(friend!.id), list.id, named.id);
      assert.equal(await tx.sharedVotingSession.count({ where: { id: named.id } }), 0);
      assert.equal(await tx.sharedVotingCandidate.count({ where: { sessionId: named.id } }), 0);
      assert.equal(await tx.sharedVotingVote.count({ where: { candidateId: { in: named.candidates.map(row => row.id) } } }), 0);
      assert.equal(await tx.notification.count({ where: { votingSessionId: named.id } }), 0);
      assert.equal(await tx.sharedWatchlistItem.count({ where: { watchlistId: list.id } }), titleCount, 'Deleting a vote keeps its watchlist titles');
      await assert.rejects(lists.getVotingSession(identity(owner!.id), list.id, named.id), NotFoundException);
      await lists.deleteVotingSession(identity(friend!.id), list.id, retryResult.id);
      assert.equal(await tx.sharedVotingSession.count({ where: { id: retryResult.id } }), 0, 'Creators can delete completed votes too');
      await tx.sharedVotingSession.update({ where: { id: anonymous.id }, data: { closesAt: new Date(Date.now() - 1000) } });
      await assert.rejects(lists.addVotingCandidates(identity(friend!.id), list.id, anonymous.id, [extra.id]), BadRequestException);
      await tx.userFollow.create({ data: { followerId: guest!.id, followedUserId: friend!.id } });
      assert.equal((await invitations.search(identity(friend!.id), list.id, guest!.handle!)).items[0]?.state, 'available');
      await invitations.invite(identity(friend!.id), list.id, guest!.id);
      const memberInvitation = await request(guest!.id);
      await assert.rejects(lists.getSharedWatchlist(identity(guest!.id), list.id), NotFoundException);
      await lists.leaveSharedWatchlist(identity(friend!.id), list.id);
      await assert.rejects(invitations.respond(identity(guest!.id), memberInvitation.id, true), NotFoundException, 'An inviter who left cannot grant membership');
      await tx.sharedWatchlistMember.create({ data: { watchlistId: list.id, userId: friend!.id } });
      await invitations.respond(identity(guest!.id), memberInvitation.id, true);
      await lists.leaveSharedWatchlist(identity(guest!.id), list.id);
      assert.equal((await invitations.search(identity(owner!.id), list.id, friend!.handle!)).items[0]?.state, 'member');
      await lists.leaveSharedWatchlist(identity(friend!.id), list.id);
      await assert.rejects(lists.getSharedWatchlist(identity(friend!.id), list.id), NotFoundException);
      await assert.rejects(invite(friend!.id), BadRequestException, 'Leaving does not allow immediate repeated invitations');
      await assert.rejects(lists.leaveSharedWatchlist(identity(owner!.id), list.id), BadRequestException);
      await invite(follower!.id);
      const second = await request(follower!.id);
      await invitations.respond(identity(follower!.id), second.id, false);
      await invitations.respond(identity(follower!.id), second.id, false);
      await assert.rejects(invitations.respond(identity(follower!.id), second.id, true), BadRequestException);
      await assert.rejects(invite(follower!.id), BadRequestException);
      assert.equal(await tx.sharedWatchlistMember.count({ where: { userId: follower!.id } }), 0);
      await tx.notification.update({ where: { id: second.id }, data: { updatedAt: new Date(Date.now() - 8 * 86400000) } });
      await invite(follower!.id);
      assert.notEqual((await request(follower!.id)).id, second.id, 'A later invitation gets a fresh push delivery');
      assert.equal((await profiles.updatePrivacy(identity(stranger!.id), { allowWatchlistInvitesFromAnyone: true })).privacy.allowWatchlistInvitesFromAnyone, true);
      await invite(stranger!.id);
      const acceptedStranger = await request(stranger!.id);
      await invitations.respond(identity(stranger!.id), acceptedStranger.id, true);
      assert.equal((await lists.getSharedWatchlist(identity(stranger!.id), list.id)).memberCount, 2);
      await lists.leaveSharedWatchlist(identity(stranger!.id), list.id);
      await tx.notification.update({ where: { id: acceptedStranger.id }, data: { updatedAt: new Date(Date.now() - 8 * 86400000) } });
      await invite(stranger!.id);
      const third = await request(stranger!.id);
      for (let i = 0; i < 5; i++) await lists.createSharedWatchlist(identity(stranger!.id), `List ${i}`);
      await assert.rejects(invitations.respond(identity(stranger!.id), third.id, true), BadRequestException);
      assert.equal(invitationStatus((await request(stranger!.id)).routeMetadata), 'pending', 'Quota failure preserves the invitation');
      await tx.userBlock.create({ data: { blockerId: follower!.id, blockedUserId: owner!.id } });
      assert.ok(!(await invitations.search(identity(owner!.id), list.id, follower!.handle!)).items.length);
      await assert.rejects(invite(follower!.id), NotFoundException);
      await assert.rejects(invitations.respond(identity(follower!.id), (await request(follower!.id)).id, true), NotFoundException);
      assert.ok(!(await inbox.list(identity(follower!.id))).items.some((item) => item.kind === 'shared_list_invite'));
      assert.equal((await profiles.updatePrivacy(identity(stranger!.id), { allowWatchlistInvitesFromAnyone: false })).privacy.allowWatchlistInvitesFromAnyone, false);
      await assert.rejects(invite(stranger!.id), ForbiddenException, 'Turning the setting off takes effect on the server');
      await tx.privacySettings.create({ data: { userId: pending!.id, allowWatchlistInvitesFromAnyone: true } });
      await tx.notification.createMany({ data: Array.from({ length: 20 }, (_, i) => ({
        userId: pending!.id, actorUserId: owner!.id, kind: 'SHARED_LIST_INVITE' as const,
        title: 'Invitation', body: 'Invitation', dedupeKey: `limit-${i}`,
      })) });
      await assert.rejects(invite(pending!.id), /20 watchlist invitations a day/);
      await tx.sharedWatchlist.delete({ where: { id: list.id } });
      await assert.rejects(invitations.respond(identity(stranger!.id), third.id, true), NotFoundException);
      throw rollback;
    }, { timeout: 60000 }), (error) => error === rollback);
    console.log('Invitation database QA passed: privacy defaults, account search, follow directions, pending follows, blocks, owner/recipient authorization, no pre-acceptance access, dedupe, accept/decline, quota, leave, cooldown, durable Alerts and deletion.');
  } finally { await prisma.$disconnect(); }
}
void run();
