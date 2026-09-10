import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellRing, CalendarDays, ListPlus, Vote } from 'lucide-react-native';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  acceptFollowRequest,
  type FollowRequest,
  listFollowRequests,
  rejectFollowRequest,
} from '../api/follows';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncNotifications,
} from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import {
  beginMarkAllRead,
  beginMarkRead,
  countUnreadNotifications,
  filterNotifications,
  groupNotifications,
  mapNotificationTarget,
  rollbackNotificationMutation,
  type NotificationFilter,
  type NotificationItem,
  type NotificationTarget,
} from './notificationModel';
import { loadNotificationItems } from './notificationsLoader';

type NotificationsScreenProps = Pick<NativeStackScreenProps<RootStackParamList, 'Notifications' | 'ReleaseCalendar'>, 'navigation'>;
type OwnedInbox = { items: NotificationItem[]; ownerId: string | null };

const filters: Array<{ label: string; value: NotificationFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Releases', value: 'releases' },
  { label: 'Lists', value: 'lists' },
];

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const isFocused = useIsFocused();
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const ownerId = currentUser?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const cacheKey = ownerId
    ? getPrivateCacheKey(ownerId, 'notifications:inbox:v2')
    : getPrivateCacheKey('visitor', 'notifications:inbox:v2');
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [ownedInbox, setOwnedInbox] = useState<OwnedInbox>({ items: [], ownerId: null });
  const ownedInboxRef = useRef(ownedInbox);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const followRequestsRef = useRef(followRequests);
  const [followRequestsOwnerId, setFollowRequestsOwnerId] = useState<string | null>(null);
  const [followRequestError, setFollowRequestError] = useState<string | null>(null);
  const [isRefreshingFollowRequests, setIsRefreshingFollowRequests] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  followRequestsRef.current = followRequests;
  const load = useCallback(async () => {
    const requestedOwnerId = ownerId;
    const token = await getFirebaseIdToken();

    if (!requestedOwnerId || ownerIdRef.current !== requestedOwnerId || !token) {
      throw new Error('Sign in again to update Alerts.');
    }

    return loadNotificationItems(token, {
      list: listNotifications,
      sync: syncNotifications,
    });
  }, [getFirebaseIdToken, ownerId]);
  const resource = useCachedResource<NotificationItem[]>({
    enabled: Boolean(ownerId && firebaseIdToken),
    key: cacheKey,
    load,
  });
  useFocusEffect(useCallback(() => {
    setMutationError(null);
    resource.revalidate();
  }, [ownerId, resource.revalidate]));

  const loadPendingFollowRequests = useCallback(async (showRefresh = false) => {
    const expectedOwnerId = ownerIdRef.current;

    if (!expectedOwnerId) {
      setFollowRequests([]);
      return;
    }

    if (showRefresh) {
      setIsRefreshingFollowRequests(true);
      setFollowRequestError(null);
    }

    try {
      const token = await getFirebaseIdToken();

      if (!token || ownerIdRef.current !== expectedOwnerId) {
        return;
      }

      const response = await listFollowRequests(token);

      if (ownerIdRef.current === expectedOwnerId) {
        setFollowRequests(response.items);
        setFollowRequestsOwnerId(expectedOwnerId);
        setFollowRequestError(null);
      }
    } catch (error) {
      if (showRefresh && ownerIdRef.current === expectedOwnerId) {
        setFollowRequestError(error instanceof Error ? error.message : 'Follow requests could not load.');
      }
    } finally {
      if (showRefresh && ownerIdRef.current === expectedOwnerId) {
        setIsRefreshingFollowRequests(false);
      }
    }
  }, [getFirebaseIdToken]);

  useFocusEffect(useCallback(() => {
    void loadPendingFollowRequests();
  }, [loadPendingFollowRequests, ownerId]));

  useEffect(() => {
    if (!ownerId) {
      const signedOut = { items: [], ownerId: null };
      ownedInboxRef.current = signedOut;
      setOwnedInbox(signedOut);
      setPendingIds(new Set());
      setIsMarkingAll(false);
      setMutationError(null);
      setFollowRequests([]);
      setFollowRequestsOwnerId(null);
      setFollowRequestError(null);
      return;
    }

    if (resource.data) {
      const next = { items: resource.data, ownerId };
      ownedInboxRef.current = next;
      setOwnedInbox(next);
    }
  }, [ownerId, resource.data]);

  const resolveFollowRequest = useCallback(async (requesterId: string, accept: boolean) => {
    const expectedOwnerId = ownerIdRef.current;

    if (!expectedOwnerId) {
      return;
    }
    const request = followRequestsRef.current.find((item) => item.userId === requesterId);
    if (!request) return;

    setFollowRequestError(null);
    const optimisticRequests = followRequestsRef.current.filter((item) => item.userId !== requesterId);
    followRequestsRef.current = optimisticRequests;
    setFollowRequests(optimisticRequests);

    try {
      const token = await getFirebaseIdToken();

      if (!token || ownerIdRef.current !== expectedOwnerId) {
        throw new Error('Sign in again to manage follow requests.');
      }

      if (accept) {
        await acceptFollowRequest(token, requesterId);
      } else {
        await rejectFollowRequest(token, requesterId);
      }

      if (ownerIdRef.current === expectedOwnerId) {
        notifyUserDataChanged('profile', 'socialGraph');
      }
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        setFollowRequests((current) => {
          if (current.some((item) => item.userId === requesterId)) return current;
          const restored = [request, ...current];
          followRequestsRef.current = restored;
          return restored;
        });
        setFollowRequestError(error instanceof Error ? error.message : 'Follow request could not be updated.');
      }
    }
  }, [getFirebaseIdToken]);

  const items = ownedInbox.ownerId === ownerId ? ownedInbox.items : [];
  const visibleFollowRequests = followRequestsOwnerId === ownerId ? followRequests : [];
  const unreadCount = countUnreadNotifications(items);
  const groups = useMemo(
    () => groupNotifications(filterNotifications(items, filter)),
    [filter, items],
  );
  const isMutating = isMarkingAll || pendingIds.size > 0;

  const persistOwnedItems = useCallback((expectedOwnerId: string, nextItems: NotificationItem[]) => {
    if (ownerIdRef.current !== expectedOwnerId) {
      return;
    }

    const next = { items: nextItems, ownerId: expectedOwnerId };
    ownedInboxRef.current = next;
    setOwnedInbox(next);
    const savedAt = new Date().toISOString();
    setMemoryResource(getPrivateCacheKey(expectedOwnerId, 'notifications:inbox:v2'), nextItems, savedAt);
    void writePersistedCache(
      getPrivateCacheKey(expectedOwnerId, 'notifications:inbox:v2'),
      nextItems,
      undefined,
      savedAt,
    ).catch(() => undefined);
  }, []);

  const handleMarkRead = useCallback(async (notificationId: string) => {
    const expectedOwnerId = ownerIdRef.current;
    const snapshot = ownedInboxRef.current;

    if (
      !expectedOwnerId ||
      snapshot.ownerId !== expectedOwnerId ||
      pendingIds.has(notificationId) ||
      isMarkingAll
    ) {
      return;
    }

    const mutation = beginMarkRead(snapshot.items, notificationId);

    if (mutation.previousReadAtById.size === 0) {
      return;
    }

    setMutationError(null);
    setPendingIds((current) => new Set(current).add(notificationId));
    persistOwnedItems(expectedOwnerId, mutation.optimistic);

    try {
      const token = await getFirebaseIdToken();

      if (ownerIdRef.current !== expectedOwnerId) {
        return;
      }

      if (!token) {
        throw new Error('Sign in again to mark this alert as read.');
      }

      const response = await markNotificationRead(token, notificationId);

      if (!response.updated) {
        throw new Error('The alert could not be marked as read.');
      }
      notifyUserDataChanged('notifications');
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId && ownedInboxRef.current.ownerId === expectedOwnerId) {
        const rolledBack = rollbackNotificationMutation(ownedInboxRef.current.items, mutation);
        persistOwnedItems(expectedOwnerId, rolledBack);
        setMutationError(error instanceof Error ? error.message : 'The alert could not be marked as read.');
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    }
  }, [getFirebaseIdToken, isMarkingAll, pendingIds, persistOwnedItems]);

  const handleMarkAllRead = useCallback(async () => {
    const expectedOwnerId = ownerIdRef.current;
    const snapshot = ownedInboxRef.current;

    if (!expectedOwnerId || snapshot.ownerId !== expectedOwnerId || isMutating) {
      return;
    }

    const mutation = beginMarkAllRead(snapshot.items);

    if (mutation.previousReadAtById.size === 0) {
      return;
    }

    setMutationError(null);
    setIsMarkingAll(true);
    persistOwnedItems(expectedOwnerId, mutation.optimistic);

    try {
      const token = await getFirebaseIdToken();

      if (ownerIdRef.current !== expectedOwnerId) {
        return;
      }

      if (!token) {
        throw new Error('Sign in again to mark Alerts as read.');
      }

      await markAllNotificationsRead(token);
      notifyUserDataChanged('notifications');
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId && ownedInboxRef.current.ownerId === expectedOwnerId) {
        const rolledBack = rollbackNotificationMutation(ownedInboxRef.current.items, mutation);
        persistOwnedItems(expectedOwnerId, rolledBack);
        setMutationError(error instanceof Error ? error.message : 'Alerts could not be marked as read.');
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) {
        setIsMarkingAll(false);
      }
    }
  }, [getFirebaseIdToken, isMutating, persistOwnedItems]);

  useEffect(() => {
    if (isFocused && unreadCount > 0 && !isMutating && !mutationError) {
      void handleMarkAllRead();
    }
  }, [handleMarkAllRead, isFocused, isMutating, mutationError, unreadCount]);

  const openTarget = useCallback((target: NotificationTarget) => {
    if (target.name === 'FilmDetail') {
      navigation.navigate(target.name, target.params);
    } else if (target.name === 'SeriesDetail') {
      navigation.navigate(target.name, target.params);
    } else if (target.name === 'SharedWatchlist') {
      navigation.navigate(target.name, target.params);
    } else {
      navigation.navigate(target.name, target.params);
    }
  }, [navigation]);

  const handleOpen = useCallback((item: NotificationItem) => {
    if (item.readAt === null) {
      void handleMarkRead(item.id);
    }

    const target = mapNotificationTarget(item);

    if (target) {
      openTarget(target);
    }
  }, [handleMarkRead, openTarget]);

  if (!ownerId || !firebaseIdToken) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0 || visibleFollowRequests.length > 0} title="">
        <SignInRequiredCard
          body="You need to be signed in to use this section. Sign in here to see follow requests, releases, and shared-list alerts."
          title="Sign in to view Alerts"
        />
      </Screen>
    );
  }

  if (resource.isInitialLoading && items.length === 0 && visibleFollowRequests.length === 0) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0 || visibleFollowRequests.length > 0} title="">
        <LoadingState variant="people" label="Loading notifications" />
      </Screen>
    );
  }

  if (resource.error && items.length === 0 && visibleFollowRequests.length === 0) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0 || visibleFollowRequests.length > 0} title="">
        <EmptyState body={resource.error} title="Alerts are unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen contentReady={!resource.isInitialLoading || items.length > 0 || visibleFollowRequests.length > 0}
      horizontalPadding={spacing.md}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            setMutationError(null);
            resource.retry();
            void loadPendingFollowRequests(true);
          }}
          refreshing={resource.isRefreshing || isRefreshingFollowRequests}
          tintColor={colors.accent}
        />
      }
      statusBanner={
        mutationError || followRequestError ? (
          <InlineStatusBanner detail={mutationError ?? followRequestError ?? ''} tone="error" />
        ) : undefined
      }
      title=""
    >
      {visibleFollowRequests.length > 0 && filter === 'all' ? (
        <ScreenReveal delay={100} style={styles.requestsSection}>
          <Text style={styles.groupLabel}>Follow requests</Text>
          <View style={styles.groupItems}>
            {visibleFollowRequests.map((request) => (
              <FollowRequestRow
                key={request.userId}
                onAccept={() => resolveFollowRequest(request.userId, true)}
                onReject={() => resolveFollowRequest(request.userId, false)}
                request={request}
              />
            ))}
          </View>
        </ScreenReveal>
      ) : null}
      <SegmentedControl onChange={setFilter} options={filters} value={filter} />
      {groups.length === 0 && !(visibleFollowRequests.length > 0 && filter === 'all') ? (
        <ScreenReveal delay={100} style={styles.empty}>
          <EmptyState
            body={items.length === 0 ? 'Follow requests, release updates, and shared-list activity will appear here.' : 'No alerts match this filter.'}
            title={items.length === 0 ? 'You are all caught up' : 'No matching alerts'}
          />
        </ScreenReveal>
      ) : (
        <ScreenReveal delay={150} style={styles.list}>
          {groups.map((group) => (
            <View key={group.key}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.groupItems}>
                {group.items.map((item) => (
                  <NotificationRow
                    item={item}
                    key={item.id}
                    onPress={() => handleOpen(item)}
                    pending={pendingIds.has(item.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScreenReveal>
      )}
    </Screen>
  );
}

function FollowRequestRow({
  onAccept,
  onReject,
  request,
}: {
  onAccept: () => void;
  onReject: () => void;
  request: FollowRequest;
}) {
  const name = request.displayName?.trim() || 'A Watchly member';

  return (
    <View style={styles.requestRow}>
      <View style={styles.requestCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowBody}>Wants to follow you and see your private profile.</Text>
      </View>
      <View style={styles.requestActions}>
        <Button compact label="Decline" onPress={onReject} variant="secondary" />
        <Button compact label="Accept" onPress={onAccept} />
      </View>
    </View>
  );
}

function NotificationRow({
  item,
  onPress,
  pending,
}: {
  item: NotificationItem;
  onPress: () => void;
  pending: boolean;
}) {
  const unread = item.readAt === null;
  const Icon = item.kind === 'release'
    ? CalendarDays
    : item.kind === 'shared_list_invite'
      ? ListPlus
      : item.kind === 'shared_vote_update'
        ? Vote
        : BellRing;

  return (
    <Pressable
      accessibilityHint={mapNotificationTarget(item) ? 'Opens the related content.' : undefined}
      accessibilityLabel={`${item.title}. ${item.body}. ${unread ? 'Unread' : 'Read'}.`}
      accessibilityRole="button"
      accessibilityState={{ busy: pending }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread ? styles.rowUnread : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon color={colors.accentText} size={22} strokeWidth={2} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
        <Text numberOfLines={3} style={styles.rowBody}>{item.body}</Text>
        <Text style={styles.rowTime}>{formatNotificationTime(item.createdAt)}</Text>
      </View>
      {unread ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  empty: {
    paddingTop: spacing.xxl,
  },
  groupItems: {
    gap: spacing.sm,
  },
  groupLabel: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  pressed: {
    opacity: 0.76,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestCopy: {
    gap: spacing.xs,
  },
  requestRow: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  requestsSection: {
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 91,
    padding: spacing.sm,
    position: 'relative',
  },
  rowBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderRadius: radii.md,
    height: touchTargets.min,
    justifyContent: 'center',
    width: touchTargets.min,
  },
  rowTime: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 3,
  },
  rowUnread: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 8,
  },
});
