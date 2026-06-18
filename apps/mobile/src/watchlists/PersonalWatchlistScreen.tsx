import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonalWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { HydratedPersonalWatchlistItem, useWatchlistCache } from './WatchlistCacheContext';

type PersonalWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'PersonalWatchlist'>;

export function PersonalWatchlistScreen({ navigation, route }: PersonalWatchlistScreenProps) {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { getCachedPersonalWatchlist, refreshPersonalWatchlist } = useWatchlistCache();
  const { watchlistId } = route.params;
  const [error, setError] = useState<string | null>(null);
  const [hydratedItems, setHydratedItems] = useState<HydratedPersonalWatchlistItem[]>(
    () => getCachedPersonalWatchlist(watchlistId)?.hydratedItems ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !getCachedPersonalWatchlist(watchlistId));
  const [watchlist, setWatchlist] = useState<PersonalWatchlist | null>(
    () => getCachedPersonalWatchlist(watchlistId)?.watchlist ?? null,
  );
  const hasVisibleWatchlistRef = useRef(Boolean(watchlist));

  const loadWatchlist = useCallback(async (showLoading = false) => {
    if (!firebaseIdToken) {
      setError(null);
      setHydratedItems([]);
      setIsLoading(false);
      setWatchlist(null);
      return;
    }

    setError(null);
    setIsLoading(showLoading || !hasVisibleWatchlistRef.current);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load this list.');
      }

      const cached = await refreshPersonalWatchlist(watchlistId);

      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      hasVisibleWatchlistRef.current = true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the list.');
      if (!hasVisibleWatchlistRef.current) {
        setHydratedItems([]);
        setWatchlist(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, getFirebaseIdToken, refreshPersonalWatchlist, watchlistId]);

  useEffect(() => {
    const cached = getCachedPersonalWatchlist(watchlistId);

    if (cached) {
      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      hasVisibleWatchlistRef.current = true;
      setIsLoading(false);
      void loadWatchlist(false);
      return;
    }

    hasVisibleWatchlistRef.current = false;
    void loadWatchlist(true);
  }, [loadWatchlist, watchlistId]);

  function openItem(item: HydratedPersonalWatchlistItem) {
    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', {
        title: item.title,
        tmdbId: item.tmdbId,
      });
      return;
    }

    navigation.navigate('SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }

  if (!firebaseIdToken) {
    return (
      <View style={styles.pageFallback}>
        <EmptyState body="Sign in from Profile to open your private lists." title="Sign in required" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading list</Text>
        </View>
      ) : error && !watchlist ? (
        <EmptyState body={error} title="List failed">
          <Button label="Retry" onPress={() => loadWatchlist(true)} />
        </EmptyState>
      ) : watchlist ? (
        <>
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Private personal list</Text>
                <Text style={styles.title}>{watchlist.name}</Text>
                <Text style={styles.body}>
                  {watchlist.items.length === 1 ? '1 title' : `${watchlist.items.length} titles`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Refresh list"
                accessibilityRole="button"
                onPress={() => loadWatchlist(true)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <RefreshCw color={colors.text} size={18} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Titles</Text>
            {hydratedItems.length === 0 ? (
              <Text style={styles.body}>Add films or series from detail pages.</Text>
            ) : (
              <View style={styles.itemRows}>
                {hydratedItems.map((item) => (
                  <Pressable
                    accessibilityLabel={`Open ${item.title}`}
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => openItem(item)}
                    style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
                  >
                    {item.posterUrl ? (
                      <Image
                        accessibilityIgnoresInvertColors
                        accessibilityLabel={`${item.title} poster`}
                        source={{ uri: item.posterUrl }}
                        style={styles.poster}
                      />
                    ) : (
                      <View style={styles.posterPlaceholder} />
                    )}
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={2} style={styles.itemTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.meta}>{item.contentType === 'movie' ? 'Film' : 'Series'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  itemRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemRows: {
    marginTop: spacing.sm,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  page: {
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  pageFallback: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.xl,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 78,
    width: 52,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 78,
    width: 52,
  },
  pressed: {
    opacity: 0.78,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
  },
});
