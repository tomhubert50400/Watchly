import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import {
  getTrackingState,
  TrackingState,
  TrackingStatus,
  TrackedContentType,
  upsertTrackingState,
} from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing } from '../design/tokens';
import { useToast } from '../notifications/ToastContext';

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

const trackingStateCache = new Map<string, TrackingState | null>();

function getTrackingStateCacheKey(userId: string, contentType: TrackedContentType, tmdbId: number) {
  return `${userId}:${contentType}:${tmdbId}`;
}

export function TrackingControls({ contentType, tmdbId }: TrackingControlsProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const trackingStateCacheKey = currentUser
    ? getTrackingStateCacheKey(currentUser.id, contentType, tmdbId)
    : null;
  const [state, setState] = useState<TrackingState | null>(() =>
    trackingStateCacheKey ? trackingStateCache.get(trackingStateCacheKey) ?? null : null,
  );
  const saveVersionRef = useRef(0);

  const loadState = useCallback(async () => {
    if (!firebaseIdToken) {
      setState(null);
      return;
    }

    const loadVersion = saveVersionRef.current;

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load your tracking state.');
      }

      const loadedState = await getTrackingState(token, contentType, tmdbId);

      if (saveVersionRef.current === loadVersion) {
        if (currentUser) {
          trackingStateCache.set(getTrackingStateCacheKey(currentUser.id, contentType, tmdbId), loadedState);
        }
        setState(loadedState);
      }
    } catch {
      return;
    }
  }, [contentType, currentUser, firebaseIdToken, getFirebaseIdToken, tmdbId]);

  useEffect(() => {
    setState(trackingStateCacheKey ? trackingStateCache.get(trackingStateCacheKey) ?? null : null);
  }, [trackingStateCacheKey]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function save(nextStatus: TrackingStatus | null, nextFavorite: boolean) {
    if (!firebaseIdToken) {
      return;
    }

    const previousState = state;
    const saveVersion = saveVersionRef.current + 1;
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

    saveVersionRef.current = saveVersion;
    if (trackingStateCacheKey) {
      trackingStateCache.set(trackingStateCacheKey, optimisticState);
    }
    setState(optimisticState);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to save your tracking state.');
      }

      const savedState = await upsertTrackingState(token, {
        contentType,
        favorite: nextFavorite,
        status: nextStatus,
        tmdbId,
      });

      if (saveVersionRef.current === saveVersion) {
        if (currentUser) {
          trackingStateCache.set(getTrackingStateCacheKey(currentUser.id, contentType, tmdbId), savedState);
        }
        setState(savedState);
      }
    } catch (saveError) {
      if (saveVersionRef.current === saveVersion) {
        if (trackingStateCacheKey) {
          trackingStateCache.set(trackingStateCacheKey, previousState);
        }
        setState(previousState);
        showToast(saveError instanceof Error ? saveError.message : 'Could not save your tracking state.');
      }
    }
  }

  const currentStatus = state?.status ?? null;
  const isFavorite = state?.favorite ?? false;

  if (!firebaseIdToken) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SegmentedControl<TrackingStatus>
        onChange={(nextStatus) => save(currentStatus === nextStatus ? null : nextStatus, isFavorite)}
        options={statusOptions.map(({ Icon, label, value }) => ({
          accessibilityLabel: `${currentStatus === value ? 'Clear' : 'Set'} ${label}`,
          label,
          render: ({ selected }) => (
            <View style={styles.statusContent}>
              <Icon
                color={selected ? colors.textOnAccent : colors.text}
                size={16}
                strokeWidth={2}
              />
              <Text
                numberOfLines={1}
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
