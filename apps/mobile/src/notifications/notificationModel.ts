export type NotificationKind = 'release' | 'shared_list_invite' | 'shared_vote_update';
export type NotificationFilter = 'all' | 'releases' | 'lists';

export type NotificationItem = {
  actorUserId: string | null;
  body: string;
  contentType: 'movie' | 'series' | null;
  createdAt: string;
  episodeNumber: number | null;
  id: string;
  kind: NotificationKind;
  readAt: string | null;
  releasedAt: string | null;
  routeMetadata: unknown;
  seasonNumber: number | null;
  sharedWatchlistId: string | null;
  title: string;
  tmdbId: number | null;
  type: 'movie_release' | 'season_release' | 'episode_release' | NotificationKind;
  votingSessionId: string | null;
};

export type NotificationGroup = {
  key: 'today' | 'this-week' | 'older';
  label: 'Today' | 'This week' | 'Older';
  items: NotificationItem[];
};

export type NotificationTarget =
  | { name: 'FilmDetail'; params: { title: string; tmdbId: number } }
  | { name: 'SeriesDetail'; params: { title: string; tmdbId: number } }
  | { name: 'SharedWatchlist'; params: { title: string; watchlistId: string } }
  | {
      name: 'SharedVotingSession';
      params: { sessionId: string; title: string; watchlistId: string };
    };

export type NotificationMutation = {
  optimistic: NotificationItem[];
  previousReadAtById: ReadonlyMap<string, string | null>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function groupNotifications(items: NotificationItem[], now = new Date()): NotificationGroup[] {
  const todayStart = startOfLocalDay(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const groups: NotificationGroup[] = [
    { items: [], key: 'today', label: 'Today' },
    { items: [], key: 'this-week', label: 'This week' },
    { items: [], key: 'older', label: 'Older' },
  ];

  items.forEach((item) => {
    const createdAt = new Date(item.createdAt);

    if (Number.isNaN(createdAt.getTime()) || createdAt < weekStart) {
      groups[2].items.push(item);
    } else if (createdAt >= todayStart) {
      groups[0].items.push(item);
    } else {
      groups[1].items.push(item);
    }
  });

  return groups.filter((group) => group.items.length > 0);
}

export function filterNotifications(items: NotificationItem[], filter: NotificationFilter) {
  if (filter === 'all') {
    return items;
  }

  if (filter === 'releases') {
    return items.filter((item) => item.kind === 'release');
  }

  return items.filter((item) =>
    item.kind === 'shared_list_invite' || item.kind === 'shared_vote_update',
  );
}

export function countUnreadNotifications(items: NotificationItem[]) {
  return items.reduce((count, item) => count + (item.readAt === null ? 1 : 0), 0);
}

export function beginMarkRead(
  items: NotificationItem[],
  notificationId: string,
  readAt = new Date().toISOString(),
): NotificationMutation {
  return beginMutation(items, (item) => item.id === notificationId && item.readAt === null, readAt);
}

export function beginMarkAllRead(
  items: NotificationItem[],
  readAt = new Date().toISOString(),
): NotificationMutation {
  return beginMutation(items, (item) => item.readAt === null, readAt);
}

export function rollbackNotificationMutation(
  currentItems: NotificationItem[],
  mutation: NotificationMutation,
) {
  return currentItems.map((item) => {
    if (!mutation.previousReadAtById.has(item.id)) {
      return item;
    }

    return { ...item, readAt: mutation.previousReadAtById.get(item.id) ?? null };
  });
}

export function mapNotificationTarget(item: NotificationItem): NotificationTarget | null {
  if (typeof item.title !== 'string') {
    return null;
  }

  const title = item.title.trim();

  if (!title) {
    return null;
  }

  if (item.kind === 'release') {
    if (!isPositiveInteger(item.tmdbId)) {
      return null;
    }

    if (item.contentType === 'movie') {
      return { name: 'FilmDetail', params: { title, tmdbId: item.tmdbId } };
    }

    if (item.contentType === 'series') {
      return { name: 'SeriesDetail', params: { title, tmdbId: item.tmdbId } };
    }

    return null;
  }

  const metadata = asRecord(item.routeMetadata);

  if (item.kind === 'shared_list_invite') {
    if (
      !isUuid(item.sharedWatchlistId) ||
      metadata?.route !== 'SharedWatchlist' ||
      metadata.watchlistId !== item.sharedWatchlistId
    ) {
      return null;
    }

    return {
      name: 'SharedWatchlist',
      params: { title, watchlistId: item.sharedWatchlistId },
    };
  }

  if (
    item.kind === 'shared_vote_update' &&
    isUuid(item.sharedWatchlistId) &&
    isUuid(item.votingSessionId) &&
    metadata?.route === 'SharedVote' &&
    metadata.watchlistId === item.sharedWatchlistId &&
    metadata.votingSessionId === item.votingSessionId
  ) {
    return {
      name: 'SharedVotingSession',
      params: {
        sessionId: item.votingSessionId,
        title,
        watchlistId: item.sharedWatchlistId,
      },
    };
  }

  return null;
}

function beginMutation(
  items: NotificationItem[],
  shouldMark: (item: NotificationItem) => boolean,
  readAt: string,
): NotificationMutation {
  const previousReadAtById = new Map<string, string | null>();
  const optimistic = items.map((item) => {
    if (!shouldMark(item)) {
      return item;
    }

    previousReadAtById.set(item.id, item.readAt);
    return { ...item, readAt };
  });

  return { optimistic, previousReadAtById };
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isPositiveInteger(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isUuid(value: string | null): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
