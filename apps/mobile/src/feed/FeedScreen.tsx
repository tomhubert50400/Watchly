import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { MovieDetails } from '../api/catalogue';
import { getEpisodeDetails } from '../api/catalogue';
import { FeedItem, getFeed, setFeedItemLiked } from '../api/feed';
import type { ReportTarget } from '../api/reports';
import { useAuthSession, useSocialRevision } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReportSheet } from '../reports/ReportSheet';

type FeedNavigation = NativeStackNavigationProp<RootStackParamList>;
export type HydratedFeedItem = FeedItem & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};

export function getCommunityFeedKey(userId: string) {
  return `watchly:user:${userId}:community-feed:v1`;
}

export async function loadCommunityFeed(
  token: string,
  loadMovie: (tmdbId: number) => Promise<MovieDetails>,
  loadSeries: (tmdbId: number) => Promise<{ title: string }>,
  previous: HydratedFeedItem[] = [],
) {
  const response = await getFeed(token);
  const hydratedResults = await Promise.all(response.items.map((item) => {
    const cached = previous.find((candidate) => candidate.id === item.id);
    return hydrateFeedItem(item, cached, loadMovie, loadSeries);
  }));

  return hydratedResults.filter((item): item is HydratedFeedItem => item !== null);
}

export function FeedScreen() {
  const navigation = useNavigation<FeedNavigation>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const socialRevision = useSocialRevision();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const resourceKey = getCommunityFeedKey(currentUser?.id ?? 'signed-out');
  const loadFeed = useCallback(
    (cached?: HydratedFeedItem[]) => firebaseIdToken
      ? loadCommunityFeed(firebaseIdToken, refreshMovie, refreshSeries, cached)
      : Promise.resolve([]),
    [firebaseIdToken, refreshMovie, refreshSeries, socialRevision],
  );
  const resource = useCachedResource<HydratedFeedItem[]>({
    enabled: Boolean(currentUser && firebaseIdToken),
    key: resourceKey,
    load: loadFeed,
  });
  const items = resource.data ?? [];
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
            onRefresh={resource.revalidate}
            refreshing={resource.isRefreshing}
            tintColor={colors.accent}
          />
        ) : undefined
      }
      title="Community"
    >
      {!firebaseIdToken ? (
        <SignInRequiredCard
          body="Sign in here, then follow public profiles to see their public ratings and reviews in one place."
          title="Sign in to join Community"
        />
      ) : resource.isInitialLoading && items.length === 0 ? (
        <LoadingState label="Loading feed" />
      ) : resource.error && items.length === 0 ? (
        <EmptyState body={resource.error} title="Community failed">
          <Button
            label="Retry"
            onPress={resource.retry}
          />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          body="Follow public profiles to see their written reviews. Pull down to refresh after new activity."
          title="No community activity yet"
        >
          <Button label="Refresh" onPress={resource.revalidate} variant="secondary" />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          <View style={styles.feedIntro}>
            <Text style={styles.feedIntroTitle}>Reviews from people you follow</Text>
            <Text style={styles.feedIntroBody}>
              Fresh public ratings and reviews appear here.
            </Text>
          </View>
          {items.map((item) => (
            <SocialReviewPost
              authorAvatarUrl={item.author.avatarUrl}
              authorDisplayName={item.author.displayName}
              body={item.body}
              contentImageUrl={item.contentImageUrl}
              contentMeta={item.contentSubtitle}
              contentTitle={item.contentTitle}
              key={item.id}
              likeCount={item.likeCount}
              likedByViewer={item.likedByViewer}
              onOpenContent={() => openContent(item)}
              onReport={currentUser?.id === item.author.id ? undefined : () => setReportTarget({
                id: item.id,
                label: `Review by ${item.author.displayName?.trim() || 'Watchly member'}`,
                type: item.type,
              })}
              onSetLiked={(liked) => setFeedItemLiked(firebaseIdToken, item, liked)}
              rating={item.score}
              updatedAt={item.updatedAt}
            />
          ))}
        </View>
      )}
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
    </Screen>
  );
}

async function hydrateFeedItem(
  item: FeedItem,
  previous: HydratedFeedItem | undefined,
  loadMovie: (tmdbId: number) => Promise<MovieDetails>,
  loadSeries: (tmdbId: number) => Promise<{ title: string }>,
): Promise<HydratedFeedItem | null> {
  if (item.content.contentType === 'movie') {
    try {
      const movie = await loadMovie(item.content.tmdbId);

      return {
        ...item,
        contentImageUrl: movie.posterUrl,
        contentSubtitle: 'Movie review',
        contentTitle: movie.title,
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
