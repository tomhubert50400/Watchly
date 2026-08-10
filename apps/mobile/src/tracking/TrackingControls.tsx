import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react-native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  getTrackingState,
  TrackingState,
  TrackingStatus,
  TrackedContentType,
  upsertTrackingState,
} from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SegmentedControl } from '../components/SegmentedControl';
import { resolveTrackingStatusLayout } from '../components/dynamicTypeLayout';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { colors, spacing } from '../design/tokens';
import { hapticConfirm, hapticError } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { buildTrackingMutation } from './trackingControlState';
import { createTrackingStateMemoryCache } from './trackingStateMemoryCache';

type TrackingControlsProps = {
  contentType: TrackedContentType;
  tmdbId: number;
};

const statusOptions: {
  Icon: typeof PlayCircle;
  label: string;
  value: TrackingStatus;
}[] = [
  { Icon: PlayCircle, label: 'Watching', value: 'watching' },
  { Icon: CheckCircle2, label: 'Watched', value: 'watched' },
  { Icon: XCircle, label: 'Dropped', value: 'dropped' },
];

const trackingStateCache = createTrackingStateMemoryCache<TrackingState | null>(100);

function getTrackingStateCacheKey(userId: string, contentType: TrackedContentType, tmdbId: number) {
  return JSON.stringify([userId, contentType, tmdbId]);
}

export function TrackingControls({ contentType, tmdbId }: TrackingControlsProps) {
  const { fontScale } = useWindowDimensions();
  const statusLayout = resolveTrackingStatusLayout(fontScale);
  const { currentUser, firebaseIdToken, getFirebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const { showToast } = useToast();
  const ownerId = currentUser?.id ?? null;
  const trackingStateCacheKey = ownerId
    ? getTrackingStateCacheKey(ownerId, contentType, tmdbId)
    : null;
  const requestScope = trackingStateCacheKey ?? 'signed-out';
  const [state, setState] = useState<TrackingState | null>(() =>
    ownerId ? trackingStateCache.get(ownerId, contentType, tmdbId) ?? null : null,
  );
  const [isStateKnown, setIsStateKnown] = useState(() =>
    ownerId ? trackingStateCache.has(ownerId, contentType, tmdbId) : true,
  );
  const [loadError, setLoadError] = useState(false);
  const [stateScope, setStateScope] = useState(requestScope);
  const requestRef = useRef({ scope: requestScope, version: 0 });
  const previousOwnerRef = useRef(ownerId);

  if (requestRef.current.scope !== requestScope) {
    requestRef.current = { scope: requestScope, version: requestRef.current.version + 1 };
  }

  const visibleState = stateScope === requestScope ? state : null;
  const visibleStateKnown = stateScope === requestScope && isStateKnown;

  const loadState = useCallback(async () => {
    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;

    if (!firebaseIdToken || !trackingStateCacheKey) {
      setState(null);
      setStateScope(scope);
      setIsStateKnown(true);
      setLoadError(false);
      return;
    }

    setLoadError(false);

    try {
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to load your tracking state.');

      const loadedState = await getTrackingState(token, contentType, tmdbId);
      if (!isCurrent()) return;

      trackingStateCache.set(ownerId!, contentType, tmdbId, loadedState);
      setState(loadedState);
      setStateScope(scope);
      setIsStateKnown(true);
    } catch {
      if (isCurrent()) setLoadError(true);
      return;
    }
  }, [contentType, firebaseIdToken, getFirebaseIdToken, ownerId, requestScope, tmdbId, trackingStateCacheKey]);

  useEffect(() => {
    if (previousOwnerRef.current && previousOwnerRef.current !== ownerId) {
      trackingStateCache.clearUser(previousOwnerRef.current);
    }
    previousOwnerRef.current = ownerId;
    setState(ownerId ? trackingStateCache.get(ownerId, contentType, tmdbId) ?? null : null);
    setStateScope(requestScope);
    setIsStateKnown(ownerId ? trackingStateCache.has(ownerId, contentType, tmdbId) : true);
    setLoadError(false);
  }, [contentType, ownerId, requestScope, tmdbId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function save(nextStatus: TrackingStatus | null, nextFavorite: boolean) {
    if (!firebaseIdToken || !trackingStateCacheKey) return;

    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;
    const previousState = visibleState;
    const optimisticState =
      nextStatus === null && !nextFavorite
        ? null
        : {
            contentType,
            favorite: nextFavorite,
            id: previousState?.id ?? `optimistic-${contentType}-${tmdbId}`,
            status: nextStatus,
            tmdbId,
            updatedAt: new Date().toISOString(),
          };

    trackingStateCache.set(ownerId!, contentType, tmdbId, optimisticState);
    setState(optimisticState);
    setStateScope(scope);

    try {
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to save your tracking state.');

      const savedState = await upsertTrackingState(token, {
        contentType,
        favorite: nextFavorite,
        status: nextStatus,
        tmdbId,
      });
      if (!isCurrent()) return;

      trackingStateCache.set(ownerId!, contentType, tmdbId, savedState);
      setState(savedState);
      setStateScope(scope);
      notifyTrackingChanged();
      hapticConfirm();
    } catch (saveError) {
      if (!isCurrent()) return;
      trackingStateCache.set(ownerId!, contentType, tmdbId, previousState);
      setState(previousState);
      setStateScope(scope);
      hapticError();
      showToast(saveError instanceof Error ? saveError.message : 'Could not save your tracking state.');
    }
  }

  const currentStatus = visibleState?.status ?? null;

  if (!firebaseIdToken) {
    return null;
  }

  return (
    <View style={styles.container}>
      {loadError && !visibleStateKnown ? (
        <InlineStatusBanner
          detail="Your existing tracking choices were not changed."
          onRetry={() => void loadState()}
          title="Could not load tracking"
          tone="error"
        />
      ) : null}
      <SegmentedControl<TrackingStatus>
        containerStyle={styles.statusControl}
        disabled={!visibleStateKnown}
        onChange={(nextStatus) => {
          const mutation = buildTrackingMutation(
            { isKnown: visibleStateKnown, state: visibleState },
            currentStatus === nextStatus ? null : nextStatus,
          );
          if (mutation) void save(mutation.status, mutation.favorite);
        }}
        options={statusOptions.map(({ Icon, label, value }) => ({
          accessibilityLabel: `${currentStatus === value ? 'Clear' : 'Set'} ${label}`,
          label,
          render: ({ selected }) => (
            <View style={styles.statusContent}>
              {statusLayout.iconVisible ? (
                <Icon
                  color={selected ? colors.textOnAccent : colors.text}
                  size={16}
                  strokeWidth={2}
                />
              ) : null}
              <Text
                maxFontSizeMultiplier={statusLayout.maxFontSizeMultiplier}
                numberOfLines={statusLayout.numberOfLines}
                style={[styles.statusLabel, selected && styles.statusLabelSelected]}
              >
                {label}
              </Text>
            </View>
          ),
          value,
        }))}
        selectedLabelStyle={styles.statusLabelSelected}
        value={currentStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  statusContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  statusControl: {
    backgroundColor: colors.interactiveSurface,
  },
  statusLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  statusLabelSelected: {
    color: colors.textOnAccent,
  },
});
