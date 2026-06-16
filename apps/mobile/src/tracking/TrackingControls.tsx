import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getTrackingState,
  TrackingState,
  TrackingStatus,
  TrackedContentType,
  upsertTrackingState,
} from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, spacing, typography } from '../design/tokens';

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

export function TrackingControls({ contentType, tmdbId }: TrackingControlsProps) {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TrackingState | null>(null);
  const saveVersionRef = useRef(0);

  const loadState = useCallback(async () => {
    if (!firebaseIdToken) {
      setState(null);
      return;
    }

    const loadVersion = saveVersionRef.current;

    setError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load your tracking state.');
      }

      const loadedState = await getTrackingState(token, contentType, tmdbId);

      if (saveVersionRef.current === loadVersion) {
        setState(loadedState);
      }
    } catch {
      setError('Could not load your tracking state.');
    }
  }, [contentType, firebaseIdToken, getFirebaseIdToken, tmdbId]);

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
    setError(null);
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
        setState(savedState);
      }
    } catch (saveError) {
      if (saveVersionRef.current === saveVersion) {
        setState(previousState);
        setError(saveError instanceof Error ? saveError.message : 'Could not save your tracking state.');
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
      <View style={styles.statusControl}>
        {statusOptions.map(({ Icon, label, value }) => {
          const isSelected = currentStatus === value;

          return (
            <Pressable
              accessibilityLabel={`${isSelected ? 'Clear' : 'Set'} ${label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={value}
              onPress={() => save(isSelected ? null : value, isFavorite)}
              style={({ pressed }) => [
                styles.statusButton,
                isSelected && styles.statusButtonSelected,
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon
                color={isSelected ? colors.textOnAccent : colors.text}
                size={16}
                strokeWidth={2}
              />
              <Text
                numberOfLines={1}
                style={[styles.statusLabel, isSelected && styles.statusLabelSelected]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  statusButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  statusButtonSelected: {
    backgroundColor: colors.accent,
  },
  statusControl: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
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
