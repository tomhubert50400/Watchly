import { useCallback, useEffect, useState } from 'react';
import { Bookmark, CheckCircle2, Circle, Heart, PlayCircle, XCircle } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getTrackingState,
  TrackingState,
  TrackingStatus,
  TrackedContentType,
  upsertTrackingState,
} from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type TrackingControlsProps = {
  contentType: TrackedContentType;
  tmdbId: number;
};

const statusOptions: {
  Icon: typeof Bookmark;
  label: string;
  value: TrackingStatus;
}[] = [
  { Icon: Bookmark, label: 'Watchlist', value: 'watchlisted' },
  { Icon: PlayCircle, label: 'Watching', value: 'watching' },
  { Icon: CheckCircle2, label: 'Watched', value: 'watched' },
  { Icon: XCircle, label: 'Dropped', value: 'dropped' },
];

export function TrackingControls({ contentType, tmdbId }: TrackingControlsProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<TrackingState | null>(null);

  const loadState = useCallback(async () => {
    if (!firebaseIdToken) {
      setState(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setState(await getTrackingState(firebaseIdToken, contentType, tmdbId));
    } catch {
      setError('Could not load your tracking state.');
    } finally {
      setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, tmdbId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function save(nextStatus: TrackingStatus | null, nextFavorite: boolean) {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const savedState = await upsertTrackingState(firebaseIdToken, {
        contentType,
        favorite: nextFavorite,
        status: nextStatus,
        tmdbId,
      });

      setState(savedState);
      notifyTrackingChanged();
    } catch {
      setError('Could not save your tracking state.');
    } finally {
      setIsSaving(false);
    }
  }

  const currentStatus = state?.status ?? null;
  const isFavorite = state?.favorite ?? false;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>My tracking</Text>
          <Text style={styles.body}>
            {firebaseIdToken ? 'Keep this title organized in My TV.' : 'Sign in from Profile to track this title.'}
          </Text>
        </View>
        {isLoading || isSaving ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {firebaseIdToken ? (
        <>
          <View style={styles.statusGrid}>
            {statusOptions.map(({ Icon, label, value }) => {
              const isSelected = currentStatus === value;

              return (
                <Pressable
                  accessibilityLabel={`${isSelected ? 'Clear' : 'Set'} ${label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disabled={isSaving}
                  key={value}
                  onPress={() => save(isSelected ? null : value, isFavorite)}
                  style={({ pressed }) => [
                    styles.statusButton,
                    isSelected && styles.statusButtonSelected,
                    pressed && !isSaving ? styles.pressed : null,
                    isSaving ? styles.disabled : null,
                  ]}
                >
                  <Icon
                    color={isSelected ? colors.textOnAccent : colors.text}
                    size={18}
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

          <Pressable
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            disabled={isSaving}
            onPress={() => save(currentStatus, !isFavorite)}
            style={({ pressed }) => [
              styles.favoriteButton,
              isFavorite && styles.favoriteButtonSelected,
              pressed && !isSaving ? styles.pressed : null,
              isSaving ? styles.disabled : null,
            ]}
          >
            {isFavorite ? (
              <Heart color={colors.textOnAccent} fill={colors.textOnAccent} size={19} strokeWidth={2} />
            ) : (
              <Circle color={colors.text} size={19} strokeWidth={2} />
            )}
            <Text style={[styles.favoriteLabel, isFavorite && styles.favoriteLabelSelected]}>
              Favorite
            </Text>
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  disabled: {
    opacity: 0.52,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  favoriteButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  favoriteLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  favoriteLabelSelected: {
    color: colors.textOnAccent,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  statusButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 46,
    minWidth: 132,
    paddingHorizontal: spacing.md,
  },
  statusButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statusLabelSelected: {
    color: colors.textOnAccent,
  },
});
