import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshCw } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonalWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { HydratedPersonalWatchlistItem, useWatchlistCache } from './WatchlistCacheContext';

type PersonalWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'PersonalWatchlist'>;

export function PersonalWatchlistScreen({ navigation, route }: PersonalWatchlistScreenProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const { getCachedPersonalWatchlist, refreshPersonalWatchlist } = useWatchlistCache();
  const { watchlistId } = route.params;
  const resourceScope = JSON.stringify([currentUser?.id ?? null, watchlistId]);
  const initialCached = getCachedPersonalWatchlist(watchlistId);
  const [error, setError] = useState<string | null>(null);
  const [hydratedItems, setHydratedItems] = useState<HydratedPersonalWatchlistItem[]>(
    () => initialCached?.hydratedItems ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [watchlist, setWatchlist] = useState<PersonalWatchlist | null>(() => initialCached?.watchlist ?? null);
  const [stateScope, setStateScope] = useState(resourceScope);
  const requestRef = useRef({ scope: resourceScope, version: 0 });
  const visibleStateRef = useRef({ scope: stateScope, watchlist });
  visibleStateRef.current = { scope: stateScope, watchlist };

  if (requestRef.current.scope !== resourceScope) {
    requestRef.current = { scope: resourceScope, version: requestRef.current.version + 1 };
  }

  const isStateCurrent = stateScope === resourceScope;
  const visibleWatchlist = isStateCurrent ? watchlist : null;
  const visibleItems = isStateCurrent ? hydratedItems : [];

  const loadWatchlist = useCallback(async () => {
    const requestScope = resourceScope;
    const requestVersion = requestRef.current.version + 1;
    requestRef.current = { scope: requestScope, version: requestVersion };
    const isCurrent = () => requestRef.current.scope === requestScope
      && requestRef.current.version === requestVersion;

    if (!firebaseIdToken || !currentUser) {
      setError(null);
      setHydratedItems([]);
      setIsLoading(false);
      setWatchlist(null);
      setStateScope(requestScope);
      return;
    }

    setError(null);
    setIsLoading(!visibleStateRef.current.watchlist);

    try {
      const cached = await refreshPersonalWatchlist(watchlistId);
      if (!isCurrent()) return;

      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(requestScope);
    } catch (loadError) {
      if (!isCurrent()) return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load the list.');
      if (visibleStateRef.current.scope !== requestScope || !visibleStateRef.current.watchlist) {
        setHydratedItems([]);
        setWatchlist(null);
        setStateScope(requestScope);
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [currentUser, firebaseIdToken, refreshPersonalWatchlist, resourceScope, watchlistId]);

  useEffect(() => {
    const cached = getCachedPersonalWatchlist(watchlistId);

    if (cached) {
      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(resourceScope);
      setIsLoading(false);
      void loadWatchlist();
      return;
    }

    setHydratedItems([]);
    setWatchlist(null);
    setStateScope(resourceScope);
    void loadWatchlist();
  }, [loadWatchlist, resourceScope, watchlistId]);

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
      {isLoading && !visibleWatchlist ? (
        <LoadingState label="Loading list" />
      ) : error && !visibleWatchlist ? (
        <EmptyState body={error} title="List failed">
          <Button label="Retry" onPress={() => loadWatchlist()} />
        </EmptyState>
      ) : visibleWatchlist ? (
        <>
          {isLoading ? (
            <InlineStatusBanner detail="Keeping this list visible while fresh data arrives." tone="updating" />
          ) : error ? (
            <InlineStatusBanner detail={error} onRetry={() => void loadWatchlist()} tone="error" title="List kept visible" />
          ) : null}
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Personal watchlist</Text>
                <Text style={styles.title}>{visibleWatchlist.name}</Text>
                <Text style={styles.body}>
                  {visibleWatchlist.items.length === 1 ? '1 title' : `${visibleWatchlist.items.length} titles`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Refresh list"
                accessibilityRole="button"
                onPress={() => loadWatchlist()}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <RefreshCw color={colors.text} size={18} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Titles</Text>
            {visibleItems.length === 0 ? (
              <Text style={styles.body}>Add films or series from detail pages to start shaping this list.</Text>
            ) : (
              <View style={styles.itemRows}>
                {visibleItems.map((item) => (
                  <Pressable
                    accessibilityLabel={`Open ${item.title}`}
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => openItem(item)}
                    style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
                  >
                    <MediaPoster
                      accessibilityLabel={`${item.title} poster`}
                      posterUrl={item.posterUrl}
                      style={styles.poster}
                    />
                    <View style={styles.rowCopy}>
                      <Chip label={item.contentType === 'movie' ? 'Film' : 'Series'} />
                      <Text numberOfLines={2} style={styles.itemTitle}>
                        {item.title}
                      </Text>
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
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  itemRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  itemRows: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.sm,
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
    height: 96,
    width: 64,
  },
  pressed: {
    opacity: 0.78,
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
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
