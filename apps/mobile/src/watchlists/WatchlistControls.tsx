import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PlusCircle } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addWatchlistItem,
  listWatchlists,
  PersonalWatchlistSummary,
  removeWatchlistItem,
  WatchlistContentType,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type WatchlistControlsProps = {
  contentType: WatchlistContentType;
  tmdbId: number;
};

type WatchlistMembership = PersonalWatchlistSummary & {
  containsTitle: boolean;
};

export function WatchlistControls({ contentType, tmdbId }: WatchlistControlsProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingWatchlistId, setSavingWatchlistId] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<WatchlistMembership[]>([]);

  const loadWatchlists = useCallback(async () => {
    if (!firebaseIdToken) {
      setWatchlists([]);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const summaries = await listWatchlists(firebaseIdToken, { contentType, tmdbId });

      setWatchlists(
        summaries.items.map((summary) => ({
          ...summary,
          containsTitle: Boolean(summary.containsTitle),
        })),
      );
    } catch (loadError) {
      setWatchlists([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load personal lists.');
    } finally {
      setIsLoading(false);
    }
  }, [contentType, firebaseIdToken, tmdbId]);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);

  async function toggleWatchlist(watchlist: WatchlistMembership) {
    if (!firebaseIdToken || savingWatchlistId) {
      return;
    }

    setError(null);
    setSavingWatchlistId(watchlist.id);

    try {
      if (watchlist.containsTitle) {
        await removeWatchlistItem(firebaseIdToken, watchlist.id, contentType, tmdbId);
      } else {
        await addWatchlistItem(firebaseIdToken, watchlist.id, { contentType, tmdbId });
      }

      setWatchlists((current) =>
        current.map((item) =>
          item.id === watchlist.id
            ? {
                ...item,
                containsTitle: !watchlist.containsTitle,
                itemCount: watchlist.containsTitle ? Math.max(0, item.itemCount - 1) : item.itemCount + 1,
              }
            : item,
        ),
      );
      notifyTrackingChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update this list.');
    } finally {
      setSavingWatchlistId(null);
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.sectionTitle}>Personal lists</Text>
          <Text style={styles.body}>
            {firebaseIdToken ? 'Private lists for this title.' : 'Sign in from Profile to use lists.'}
          </Text>
        </View>
        {isLoading || savingWatchlistId ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {firebaseIdToken && !isLoading ? (
        watchlists.length === 0 ? (
          <Text style={styles.emptyText}>No personal lists yet.</Text>
        ) : (
          <View style={styles.listRows}>
            {watchlists.map((watchlist) => {
              const isSelected = watchlist.containsTitle;
              const isSaving = savingWatchlistId === watchlist.id;
              const Icon = isSelected ? CheckCircle2 : PlusCircle;

              return (
                <Pressable
                  accessibilityLabel={`${isSelected ? 'Remove from' : 'Add to'} ${watchlist.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disabled={Boolean(savingWatchlistId)}
                  key={watchlist.id}
                  onPress={() => toggleWatchlist(watchlist)}
                  style={({ pressed }) => [
                    styles.listRow,
                    isSelected && styles.listRowSelected,
                    pressed && !savingWatchlistId ? styles.pressed : null,
                    isSaving ? styles.disabled : null,
                  ]}
                >
                  <View style={styles.iconFrame}>
                    <Icon
                      color={isSelected ? colors.textOnAccent : colors.text}
                      size={19}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.listCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.listName, isSelected && styles.listNameSelected]}
                    >
                      {watchlist.name}
                    </Text>
                    <Text style={[styles.meta, isSelected && styles.metaSelected]}>
                      {watchlist.itemCount === 1 ? '1 title' : `${watchlist.itemCount} titles`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
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
    opacity: 0.56,
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  iconFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
  },
  listName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  listNameSelected: {
    color: colors.textOnAccent,
  },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  listRowSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  meta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  metaSelected: {
    color: colors.textOnAccent,
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
});
