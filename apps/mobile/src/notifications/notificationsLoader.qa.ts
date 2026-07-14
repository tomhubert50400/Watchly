// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { loadNotificationItems } from './notificationsLoader';
import type { NotificationItem } from './notificationModel';

const item: NotificationItem = {
  actorUserId: null,
  body: 'Episode available',
  contentType: 'series',
  createdAt: '2026-07-11T00:00:00.000Z',
  episodeNumber: 1,
  id: 'notification-1',
  kind: 'release',
  readAt: null,
  releasedAt: '2026-07-11T00:00:00.000Z',
  routeMetadata: null,
  seasonNumber: 1,
  sharedWatchlistId: null,
  title: 'New episode',
  tmdbId: 1399,
  type: 'episode_release',
  votingSessionId: null,
};

async function successfulSyncAvoidsRedundantList() {
  let listCalls = 0;
  let syncCalls = 0;

  const items = await loadNotificationItems('token', {
    list: async () => {
      listCalls += 1;
      return { items: [] };
    },
    sync: async () => {
      syncCalls += 1;
      return { createdCount: 1, items: [item], syncedContentCount: 1 };
    },
  });

  assert.deepEqual(items, [item]);
  assert.equal(syncCalls, 1);
  assert.equal(listCalls, 0);
}

async function failedSyncFallsBackToList() {
  let listCalls = 0;
  let syncCalls = 0;

  const items = await loadNotificationItems('token', {
    list: async () => {
      listCalls += 1;
      return { items: [item] };
    },
    sync: async () => {
      syncCalls += 1;
      throw new Error('sync unavailable');
    },
  });

  assert.deepEqual(items, [item]);
  assert.equal(syncCalls, 1);
  assert.equal(listCalls, 1);
}

void Promise.all([
  successfulSyncAvoidsRedundantList(),
  failedSyncFallsBackToList(),
]).then(() => {
  console.log('notifications loader QA passed');
});
