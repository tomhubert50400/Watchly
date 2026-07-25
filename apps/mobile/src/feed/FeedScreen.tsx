import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getEpisodeDetails, getMovieDetails } from '../api/catalogue';
import { FeedItem, getFeed, setFeedItemLiked } from '../api/feed';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { colors, spacing, typography } from '../design/tokens';
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
  const { refreshSeries } = useCatalogueCache();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HydratedFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const loadFeed = useCallback(async (showLoading = true) => {
    if (!firebaseIdToken) {
      setError(null);
      setItems([]);
      itemsRef.current = [];
      return;
    }

    const hasVisibleItems = itemsRef.current.length > 0;
    setError(null);
    if (showLoading && !hasVisibleItems) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      if (!showLoading) setIsRefreshing(true);
    }

    try {
      const response = await getFeed(firebaseIdToken);
      const hydratedResults = await Promise.all(response.items.map((item) => {
        const previous = itemsRef.current.find((candidate) => candidate.id === item.id);
        return hydrateFeedItem(item, previous, refreshSeries);
      }));
      const hydratedItems = hydratedResults.filter(
        (item): item is HydratedFeedItem => item !== null,
      );

      setItems(hydratedItems);
      itemsRef.current = hydratedItems;
    } catch (loadError) {
      if (!hasVisibleItems) {
        setItems([]);
        itemsRef.current = [];
        setError(loadError instanceof Error ? loadError.message : 'Could not load your feed.');
      }
    } finally {
      setIsLoading(false);
      if (!showLoading) setIsRefreshing(false);
    }
  }, [firebaseIdToken, refreshSeries]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed, socialRevision]);

  const refreshFeed = useCallback(() => {
    void loadFeed(false);
  }, [loadFeed]);
  const openContent = useCallback(
    (item: HydratedFeedItem) => {
      if (item.content.contentType === 'movie') {
        navigation.navigate('FilmDetail', {
          title: item.contentTitle,
          tmdbId: item.content.tmdbId,
        });
        return;
      }

      if (!item.seriesTitle) return;

      navigation.navigate('EpisodeDetail', {
        episodeNumber: item.content.episodeNumber,
        seasonNumber: item.content.seasonNumber,
        seriesTitle: item.seriesTitle,
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
        <SignInRequiredCard
          body="You need to be signed in to use your social feed. Sign in here, then follow public profiles to see their written reviews."
          title="Sign in to see your Feed"
        />
      ) : isLoading && items.length === 0 ? (
        <LoadingState label="Loading feed" />
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
          <View style={styles.feedIntro}>
            <Text style={styles.feedIntroTitle}>Reviews from people you follow</Text>
            <Text style={styles.feedIntroBody}>
              Fresh public notes, ratings, and film diary entries land here.
            </Text>
          </View>
          {items.map((item) => (
            <SocialReviewPost
              authorDisplayName={item.author.displayName}
              body={item.body}
              contentImageUrl={item.contentImageUrl}
              contentMeta={item.contentSubtitle}
              contentTitle={item.contentTitle}
              key={item.id}
              likeCount={item.likeCount}
              likedByViewer={item.likedByViewer}
              onOpenContent={() => openContent(item)}
              onSetLiked={(liked) => setFeedItemLiked(firebaseIdToken, item, liked)}
              rating={item.score}
              updatedAt={item.updatedAt}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

async function hydrateFeedItem(
  item: FeedItem,
  previous: HydratedFeedItem | undefined,
  loadSeries: (tmdbId: number) => Promise<{ title: string }>,
): Promise<HydratedFeedItem | null> {
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
    const [episodeResponse, series] = await Promise.all([
      getEpisodeDetails(
        item.content.seriesTmdbId,
        item.content.seasonNumber,
        item.content.episodeNumber,
      ),
      loadSeries(item.content.seriesTmdbId),
    ]);

    return {
      ...item,
      contentImageUrl: episodeResponse.item.stillUrl,
      contentSubtitle: `Episode review / S${item.content.seasonNumber} E${item.content.episodeNumber}`,
      contentTitle: episodeResponse.item.title,
      seriesTitle: series.title,
    };
  } catch {
    return hasRealSeriesTitle(previous) ? { ...previous, ...item } : null;
  }
}

function hasRealSeriesTitle(
  item: HydratedFeedItem | undefined,
): item is HydratedFeedItem & { seriesTitle: string } {
  return Boolean(
    item?.seriesTitle?.trim() && !/^Series\s+\d+$/i.test(item.seriesTitle.trim()),
  );
}

const styles = StyleSheet.create({
  feedIntro: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  feedIntroBody: {
    ...typography.body,
    color: colors.muted,
  },
  feedIntroTitle: {
    ...typography.title,
    color: colors.text,
  },
  list: {
    gap: 0,
  },
});
