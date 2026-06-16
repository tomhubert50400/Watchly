import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getEpisodeDetails, getMovieDetails } from '../api/catalogue';
import { FeedItem, getFeed } from '../api/feed';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type FeedNavigation = NativeStackNavigationProp<RootStackParamList>;
type HydratedFeedItem = FeedItem & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};

export function FeedScreen() {
  const navigation = useNavigation<FeedNavigation>();
  const { firebaseIdToken, socialRevision } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HydratedFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFeed = useCallback(async (showLoading = true) => {
    if (!firebaseIdToken) {
      setError(null);
      setItems([]);
      return;
    }

    setError(null);
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await getFeed(firebaseIdToken);
      const hydratedItems = await Promise.all(response.items.map(hydrateFeedItem));

      setItems(hydratedItems);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your feed.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [firebaseIdToken]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed, socialRevision]);

  const refreshFeed = useCallback(() => {
    void loadFeed(false);
  }, [loadFeed]);
  const openFeedItem = useCallback(
    (item: HydratedFeedItem) => {
      if (item.content.contentType === 'movie') {
        navigation.navigate('FilmDetail', {
          title: item.contentTitle,
          tmdbId: item.content.tmdbId,
        });
        return;
      }

      navigation.navigate('EpisodeDetail', {
        episodeNumber: item.content.episodeNumber,
        seasonNumber: item.content.seasonNumber,
        seriesTitle: item.seriesTitle ?? `Series ${item.content.seriesTmdbId}`,
        title: item.contentTitle,
        tmdbId: item.content.seriesTmdbId,
      });
    },
    [navigation],
  );

  return (
    <Screen
      refreshControl={
        firebaseIdToken ? (
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refreshFeed}
            refreshing={isRefreshing}
            tintColor={colors.accent}
          />
        ) : undefined
      }
      title="Feed"
    >
      {!firebaseIdToken ? (
        <EmptyState
          body="Sign in from Profile, then follow public profiles to see their written reviews."
          title="Sign in to see your feed"
        />
      ) : isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading feed</Text>
        </View>
      ) : error ? (
        <EmptyState body={error} title="Feed failed">
          <Button
            label="Retry"
            onPress={() => {
              void loadFeed();
            }}
          />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          body="Follow public profiles to see their written reviews. Pull down to refresh after new activity."
          title="No reviews from followed profiles yet"
        >
          <Button label="Refresh" onPress={refreshFeed} variant="secondary" />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <FeedReviewCard item={item} key={item.id} onPress={openFeedItem} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const FeedReviewCard = memo(function FeedReviewCard({
  item,
  onPress,
}: {
  item: HydratedFeedItem;
  onPress: (item: HydratedFeedItem) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${item.contentTitle}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getAuthorInitial(item.author.displayName)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.author}>
            {item.author.displayName ?? 'Unnamed profile'}
          </Text>
          <Text style={styles.meta}>{item.contentSubtitle}</Text>
        </View>
      </View>
      <View style={styles.contentRow}>
        {item.contentImageUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${item.contentTitle} artwork`}
            source={{ uri: item.contentImageUrl }}
            style={styles.contentImage}
          />
        ) : (
          <View style={styles.contentImagePlaceholder} />
        )}
        <View style={styles.contentCopy}>
          <Text numberOfLines={2} style={styles.contentTitle}>
            {item.contentTitle}
          </Text>
          <Text style={styles.openHint}>Open details</Text>
        </View>
      </View>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
    </Pressable>
  );
});

function getAuthorInitial(displayName: string | null) {
  return (displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?';
}

async function hydrateFeedItem(item: FeedItem): Promise<HydratedFeedItem> {
  if (item.content.contentType === 'movie') {
    try {
      const response = await getMovieDetails(item.content.tmdbId);

      return {
        ...item,
        contentImageUrl: response.item.posterUrl,
        contentSubtitle: 'Movie review',
        contentTitle: response.item.title,
        seriesTitle: null,
      };
    } catch {
      return {
        ...item,
        contentImageUrl: null,
        contentSubtitle: 'Movie review',
        contentTitle: `Movie TMDB ${item.content.tmdbId}`,
        seriesTitle: null,
      };
    }
  }

  try {
    const response = await getEpisodeDetails(
      item.content.seriesTmdbId,
      item.content.seasonNumber,
      item.content.episodeNumber,
    );

    return {
      ...item,
      contentImageUrl: response.item.stillUrl,
      contentSubtitle: `Episode review / S${item.content.seasonNumber} E${item.content.episodeNumber}`,
      contentTitle: response.item.title,
      seriesTitle: `Series ${item.content.seriesTmdbId}`,
    };
  } catch {
    return {
      ...item,
      contentImageUrl: null,
      contentSubtitle: `Episode review / S${item.content.seasonNumber} E${item.content.episodeNumber}`,
      contentTitle: `Episode S${item.content.seasonNumber} E${item.content.episodeNumber}`,
      seriesTitle: `Series ${item.content.seriesTmdbId}`,
    };
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  author: {
    ...typography.title,
    color: colors.text,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.78,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  contentCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  contentImage: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 82,
    width: 56,
  },
  contentImagePlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 82,
    width: 56,
  },
  contentRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
  },
  contentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    gap: spacing.md,
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
  openHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
});
