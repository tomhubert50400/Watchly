// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import {
  beginMarkAllRead,
  beginMarkRead,
  countUnreadNotifications,
  filterNotifications,
  groupNotifications,
  mapNotificationTarget,
  rollbackNotificationMutation,
  type NotificationItem,
} from './notificationModel';

const NOW = new Date(2026, 6, 10, 15, 0, 0);
const TODAY = new Date(2026, 6, 10, 14, 0, 0).toISOString();
const THIS_WEEK = new Date(2026, 6, 6, 14, 0, 0).toISOString();
const OLDER = new Date(2026, 5, 20, 14, 0, 0).toISOString();
const WATCHLIST_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function notification(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    actorUserId: null,
    body: 'Body',
    contentType: 'movie',
    createdAt: '2026-07-10T14:00:00.000Z',
    episodeNumber: null,
    id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
    kind: 'release',
    readAt: null,
    releasedAt: null,
    routeMetadata: null,
    seasonNumber: null,
    sharedWatchlistId: null,
    title: 'Matrix',
    tmdbId: 603,
    type: 'movie_release',
    votingSessionId: null,
    ...overrides,
  };
}

const grouped = groupNotifications([
  notification({ id: 'today', createdAt: TODAY }),
  notification({ id: 'week', createdAt: THIS_WEEK }),
  notification({ id: 'older', createdAt: OLDER }),
  notification({ id: 'invalid', createdAt: 'not-a-date' }),
], NOW);
assert.deepEqual(grouped.map((group) => [group.label, group.items.map((item) => item.id)]), [
  ['Today', ['today']],
  ['This week', ['week']],
  ['Older', ['older', 'invalid']],
]);

const releases = notification({ id: 'release' });
const invite = notification({ id: 'invite', kind: 'shared_list_invite', type: 'shared_list_invite' });
const vote = notification({ id: 'vote', kind: 'shared_vote_update', type: 'shared_vote_update' });
assert.deepEqual(filterNotifications([releases, invite, vote], 'all').map((item) => item.id), ['release', 'invite', 'vote']);
assert.deepEqual(filterNotifications([releases, invite, vote], 'releases').map((item) => item.id), ['release']);
assert.deepEqual(filterNotifications([releases, invite, vote], 'lists').map((item) => item.id), ['invite', 'vote']);
assert.equal(countUnreadNotifications([releases, notification({ id: 'read', readAt: NOW.toISOString() })]), 1);

const oneTransaction = beginMarkRead([releases, invite], 'release', NOW.toISOString());
assert.equal(oneTransaction.optimistic[0]?.readAt, NOW.toISOString());
assert.equal(oneTransaction.optimistic[1]?.readAt, null);
assert.deepEqual(rollbackNotificationMutation(oneTransaction.optimistic, oneTransaction), [releases, invite]);

const allTransaction = beginMarkAllRead([releases, invite], NOW.toISOString());
assert.equal(countUnreadNotifications(allTransaction.optimistic), 0);
assert.deepEqual(rollbackNotificationMutation(allTransaction.optimistic, allTransaction), [releases, invite]);

// Rollback affects only the transaction's targets, preserving an unrelated concurrent success.
const concurrentSuccess = allTransaction.optimistic.map((item) =>
  item.id === 'invite' ? { ...item, readAt: '2026-07-10T15:01:00.000Z' } : item,
);
const rolledBackOne = rollbackNotificationMutation(concurrentSuccess, oneTransaction);
assert.equal(rolledBackOne[0]?.readAt, null);
assert.equal(rolledBackOne[1]?.readAt, '2026-07-10T15:01:00.000Z');

assert.deepEqual(mapNotificationTarget(releases), {
  name: 'FilmDetail',
  params: { title: 'Matrix', tmdbId: 603 },
});
assert.deepEqual(mapNotificationTarget(notification({ contentType: 'series', tmdbId: 1399 })), {
  name: 'SeriesDetail',
  params: { title: 'Matrix', tmdbId: 1399 },
});
assert.deepEqual(mapNotificationTarget(notification({
  kind: 'shared_list_invite',
  routeMetadata: { route: 'SharedWatchlist', watchlistId: WATCHLIST_ID },
  sharedWatchlistId: WATCHLIST_ID,
  title: 'Shared list invitation',
  type: 'shared_list_invite',
})), {
  name: 'SharedWatchlist',
  params: { title: 'Shared list invitation', watchlistId: WATCHLIST_ID },
});
assert.deepEqual(mapNotificationTarget(notification({
  kind: 'shared_vote_update',
  routeMetadata: {
    route: 'SharedVote',
    votingSessionId: SESSION_ID,
    watchlistId: WATCHLIST_ID,
  },
  sharedWatchlistId: WATCHLIST_ID,
  title: 'Shared vote update',
  type: 'shared_vote_update',
  votingSessionId: SESSION_ID,
})), {
  name: 'SharedVotingSession',
  params: {
    sessionId: SESSION_ID,
    title: 'Shared vote update',
    watchlistId: WATCHLIST_ID,
  },
});

assert.equal(mapNotificationTarget(notification({ tmdbId: -1 })), null);
assert.equal(mapNotificationTarget(notification({ contentType: null })), null);
assert.equal(mapNotificationTarget(notification({ title: '   ' })), null);
assert.equal(mapNotificationTarget(notification({
  kind: 'shared_list_invite',
  routeMetadata: 'SharedWatchlist',
  sharedWatchlistId: WATCHLIST_ID,
  type: 'shared_list_invite',
})), null);
assert.equal(mapNotificationTarget(notification({
  kind: 'shared_list_invite',
  routeMetadata: { route: 'FilmDetail', watchlistId: WATCHLIST_ID },
  sharedWatchlistId: WATCHLIST_ID,
  type: 'shared_list_invite',
})), null);
assert.equal(mapNotificationTarget(notification({
  kind: 'shared_vote_update',
  routeMetadata: { route: 'SharedVote', votingSessionId: 'wrong', watchlistId: WATCHLIST_ID },
  sharedWatchlistId: WATCHLIST_ID,
  type: 'shared_vote_update',
  votingSessionId: SESSION_ID,
})), null);

console.log('Notification model QA passed.');
