import { useCallback, useMemo } from 'react';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, UserCircle } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CatalogueSearchItem,
  getEpisodeDetails,
  getMovieDetails,
  getSeasonDetails,
  getSeriesDetails,
} from '../api/catalogue';
import { FeedItem, getFeed, setFeedItemLiked } from '../api/feed';
import { listNotifications } from '../api/notifications';
import { listSeriesProgressSummaries, SeriesProgressSummary } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { BrandWordmark } from '../brand/BrandWordmark';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList, RootTabParamList } from '../navigation/types';
import { countUnreadNotifications } from '../notifications/notificationModel';
import { ContinueWatchingRail } from './ContinueWatchingRail';
import { HomeHero } from './HomeHero';
import { ensureCatalogueSections } from '../catalogue/catalogueSectionsResource';
import { CatalogueRating } from '../catalogue/CatalogueRating';
import {
  buildHomeSections,
  HomeCatalogueData,
  HomeFeedItem,
  HomeProgressItem,
  HomeResource,
  HomeTrendingItem,
} from './homeData';
import { SocialActivityList } from './SocialActivityList';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const PUBLIC_HOME_KEY = getPublicCacheKey('home:catalogue:v1');

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
    socialRevision,
    trackingRevision,
  } = useAuthSession();
  const isSignedIn = Boolean(currentUser && firebaseIdToken);
  const loadCatalogue = useCallback(loadHomeCatalogue, []);
  const loadProgress = useCallback(
    () => firebaseIdToken ? loadHomeProgress(firebaseIdToken) : Promise.resolve([]),
    [firebaseIdToken, trackingRevision],
  );
  const loadFeed = useCallback(
    () => firebaseIdToken ? loadHomeFeed(firebaseIdToken) : Promise.resolve([]),
    [firebaseIdToken, socialRevision],
  );
  const loadNotifications = useCallback(async () => {
    const token = await getFirebaseIdToken();

    if (!token) {
      throw new Error('Sign in again to update Alerts.');
    }

    return (await listNotifications(token)).items;
  }, [getFirebaseIdToken]);
  const catalogue = useCachedResource({ key: PUBLIC_HOME_KEY, load: loadCatalogue });
  const progress = useCachedResource({
    enabled: isSignedIn,
    key: currentUser ? getPrivateCacheKey(currentUser.id, 'home:progress:v1') : getPrivateCacheKey('visitor', 'home:progress:v1'),
    load: loadProgress,
  });
  const feed = useCachedResource({
    enabled: isSignedIn,
    key: currentUser ? getPrivateCacheKey(currentUser.id, 'home:feed:v1') : getPrivateCacheKey('visitor', 'home:feed:v1'),
    load: loadFeed,
  });
  const notifications = useCachedResource({
    enabled: isSignedIn,
    key: currentUser
      ? getPrivateCacheKey(currentUser.id, 'notifications:inbox:v1')
      : getPrivateCacheKey('visitor', 'notifications:inbox:v1'),
    load: loadNotifications,
  });
  const unreadNotificationCount = countUnreadNotifications(notifications.data ?? []);

  useFocusEffect(useCallback(() => {
    if (isSignedIn) {
      notifications.revalidate();
    }
  }, [isSignedIn, notifications.revalidate]));

  const sections = useMemo(
    () => buildHomeSections({
      catalogue: toHomeResource(catalogue.data, catalogue.error),
      feed: toHomeResource(feed.data, feed.error),
      isSignedIn,
      progress: toHomeResource(progress.data, progress.error),
    }),
    [catalogue.data, catalogue.error, feed.data, feed.error, isSignedIn, progress.data, progress.error],
  );
  const isRefreshing = catalogue.isRefreshing || progress.isRefreshing || feed.isRefreshing || notifications.isRefreshing;
  const retryAll = useCallback(() => {
    catalogue.retry();
    if (isSignedIn) {
      progress.retry();
      feed.retry();
      notifications.retry();
    }
  }, [catalogue.retry, feed.retry, isSignedIn, notifications.retry, progress.retry]);

  if (catalogue.isInitialLoading && !catalogue.data) {
    return (
      <Screen leading={<BrandWordmark height={44} />} title="">
        <View style={styles.blockingState}>
          <InlineStatusBanner detail="Fetching current catalogue titles." tone="updating" />
        </View>
      </Screen>
    );
  }

  if (catalogue.error && !catalogue.data) {
    return (
      <Screen leading={<BrandWordmark height={44} />} title="">
        <EmptyState body={catalogue.error} title="Home is unavailable">
          <Button label="Retry" onPress={catalogue.retry} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen
      horizontalPadding={false}
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={retryAll}
          refreshing={isRefreshing}
          tintColor={colors.accent}
        />
      }
      tabBarPadding
      leading={<BrandWordmark height={44} />}
      title=""
      trailing={
        <View style={styles.headerActions}>
          {isSignedIn ? (
            <View>
              <IconButton
                accessibilityLabel={unreadNotificationCount === 0
                  ? 'Open Alerts, no unread alerts'
                  : `Open Alerts, ${unreadNotificationCount} unread ${unreadNotificationCount === 1 ? 'alert' : 'alerts'}`}
                icon={<Bell color={colors.textMuted} size={22} strokeWidth={2} />}
                onPress={() => navigation.navigate('Notifications')}
              />
              {unreadNotificationCount > 0 ? (
                <View pointerEvents="none" style={styles.notificationBadge}>
                  <Text maxFontSizeMultiplier={1.5} style={styles.notificationBadgeLabel}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <IconButton
            accessibilityLabel="Open Profile"
            icon={<UserCircle color={colors.textMuted} size={22} strokeWidth={2} />}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      }
    >
      <View style={styles.composition}>
        {sections.map((section) => {
          if (section.kind === 'hero') {
            return (
              <View key="hero" style={styles.hero}>
                <HomeHero
                  item={section.item}
                  onOpen={() => navigation.navigate('FilmDetail', {
                    title: section.item.title,
                    tmdbId: section.item.tmdbId,
                  })}
                />
              </View>
            );
          }

          if (section.kind === 'continueWatching') {
            return (
              <HomeSection key="continue" title="Continue watching">
                {section.error && section.items.length === 0 ? (
                  <InlineStatusBanner detail={section.error} onRetry={progress.retry} tone="error" />
                ) : null}
                {section.items.length > 0 ? (
                  <ContinueWatchingRail
                    items={section.items}
                    onOpen={(item) => navigation.navigate('EpisodeDetail', {
                      episodeNumber: item.episodeNumber,
                      seasonNumber: item.seasonNumber,
                      seriesTitle: item.seriesTitle,
                      title: item.episodeTitle,
                      tmdbId: item.seriesTmdbId,
                    })}
                  />
                ) : null}
              </HomeSection>
            );
          }

          if (section.kind === 'socialActivity') {
            return (
              <HomeSection key="social" title="From people you follow">
                {section.error && section.items.length === 0 ? (
                  <InlineStatusBanner detail={section.error} onRetry={feed.retry} tone="error" />
                ) : null}
                {section.items.length > 0 ? (
                  <SocialActivityList
                    items={section.items}
                    onOpenContent={(item) => openFeedContent(navigation, item)}
                    onSetLiked={(item, liked) => {
                      if (!firebaseIdToken) {
                        return Promise.reject(new Error('Sign in again to update this like.'));
                      }

                      return setFeedItemLiked(firebaseIdToken, item, liked);
                    }}
                  />
                ) : null}
              </HomeSection>
            );
          }

          return (
            <HomeSection key="trending" title="Trending now">
              {section.error && section.items.length === 0 ? (
                <InlineStatusBanner detail={section.error} onRetry={catalogue.retry} tone="error" />
              ) : null}
              {section.items.length > 0 ? (
                <TrendingRail
                  items={section.items}
                  onOpen={(item) => navigation.navigate('FilmDetail', {
                    title: item.title,
                    tmdbId: item.tmdbId,
                  })}
                />
              ) : !section.error ? (
                <Text style={styles.emptySection}>No trending titles are available right now.</Text>
              ) : null}
            </HomeSection>
          );
        })}
        {!isSignedIn ? (
          <View style={styles.signInCard}>
            <SignInRequiredCard
              body="You need to be signed in to personalize Home. Sign in here to continue series and see reviews from people you follow."
              title="Sign in to make Home yours"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function HomeSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function TrendingRail({
  items,
  onOpen,
}: {
  items: HomeTrendingItem[];
  onOpen: (item: HomeTrendingItem) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.posterRail}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => (
        <Pressable
          accessibilityLabel={`Open ${item.title}`}
          accessibilityRole="button"
          key={`${item.mediaType}:${item.tmdbId}`}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [styles.posterCard, pressed ? styles.pressed : null]}
        >
          <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
          <Text numberOfLines={1} style={styles.posterTitle}>{item.title}</Text>
          <TrendingMetadata item={item} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

async function loadHomeCatalogue(): Promise<HomeCatalogueData> {
  const response = await ensureCatalogueSections();
  const featured = response.trending[0] ?? null;

  if (!featured) {
    return { hero: null, trending: [] };
  }

  let details = null;

  try {
    details = (await getMovieDetails(featured.tmdbId)).item;
    setMemoryResource(
      `watchly:public:catalogue:movie:${featured.tmdbId}`,
      details,
      new Date().toISOString(),
    );
  } catch {
    // The real catalogue item remains usable even if its richer detail request fails.
  }

  return {
    hero: {
      backdropUrl: details?.backdropUrl ?? null,
      genres: details?.genres ?? [],
      posterUrl: details?.posterUrl ?? featured.posterUrl,
      releaseDate: details?.releaseDate ?? featured.releaseDate,
      runtimeMinutes: details?.runtimeMinutes ?? null,
      title: details?.title ?? featured.title,
      tmdbId: featured.tmdbId,
    },
    trending: response.trending.slice(1).map(toTrendingItem),
  };
}

async function loadHomeProgress(token: string): Promise<HomeProgressItem[]> {
  const summaries = (await listSeriesProgressSummaries(token)).items.slice(0, 8);
  const hydrated = await Promise.allSettled(summaries.map(hydrateProgressItem));
  const fulfilled = hydrated.filter(
    (result): result is PromiseFulfilledResult<HomeProgressItem | null> => result.status === 'fulfilled',
  );

  if (summaries.length > 0 && fulfilled.length === 0) {
    throw new Error('Could not update continue watching.');
  }

  return fulfilled.flatMap((result) => result.value ? [result.value] : []);
}

async function hydrateProgressItem(summary: SeriesProgressSummary): Promise<HomeProgressItem | null> {
  const [seriesResponse, currentSeasonResponse] = await Promise.all([
    getSeriesDetails(summary.seriesTmdbId),
    getSeasonDetails(summary.seriesTmdbId, summary.latestSeasonNumber),
  ]);
  let nextEpisode = currentSeasonResponse.item.episodes.find(
    (episode) => episode.episodeNumber > summary.latestEpisodeNumber && isReleased(episode.airDate),
  );

  if (!nextEpisode) {
    const nextSeason = seriesResponse.item.seasons
      .filter((season) => season.seasonNumber > summary.latestSeasonNumber && season.seasonNumber > 0)
      .sort((left, right) => left.seasonNumber - right.seasonNumber)[0];

    if (nextSeason) {
      const nextSeasonResponse = await getSeasonDetails(summary.seriesTmdbId, nextSeason.seasonNumber);
      nextEpisode = nextSeasonResponse.item.episodes.find((episode) => isReleased(episode.airDate));
    }
  }

  if (!nextEpisode) {
    return null;
  }

  return {
    backdropUrl: seriesResponse.item.backdropUrl,
    episodeNumber: nextEpisode.episodeNumber,
    episodeTitle: nextEpisode.title,
    seasonNumber: nextEpisode.seasonNumber,
    seriesTitle: seriesResponse.item.title,
    seriesTmdbId: summary.seriesTmdbId,
    watchedEpisodeCount: summary.watchedEpisodeCount,
  };
}

async function loadHomeFeed(token: string): Promise<HomeFeedItem[]> {
  const rawItems = (await getFeed(token)).items.slice(0, 10);
  const hydrated = await Promise.allSettled(rawItems.map(hydrateFeedItem));
  const fulfilled = hydrated.filter(
    (result): result is PromiseFulfilledResult<HomeFeedItem> => result.status === 'fulfilled',
  );

  if (rawItems.length > 0 && fulfilled.length === 0) {
    throw new Error('Could not update social activity.');
  }

  return fulfilled.map((result) => result.value);
}

async function hydrateFeedItem(item: FeedItem): Promise<HomeFeedItem> {
  if (item.content.contentType === 'movie') {
    const movie = (await getMovieDetails(item.content.tmdbId)).item;

    return {
      authorDisplayName: item.author.displayName,
      authorId: item.author.id,
      body: item.body,
      contentImageUrl: movie.posterUrl,
      contentTitle: movie.title,
      id: item.id,
      likeCount: item.likeCount,
      likedByViewer: item.likedByViewer,
      rating: item.score,
      target: { contentType: 'movie', tmdbId: item.content.tmdbId },
      type: item.type,
      updatedAt: item.updatedAt,
    };
  }

  const [episodeResponse, seriesResponse] = await Promise.all([
    getEpisodeDetails(
      item.content.seriesTmdbId,
      item.content.seasonNumber,
      item.content.episodeNumber,
    ),
    getSeriesDetails(item.content.seriesTmdbId),
  ]);

  return {
    authorDisplayName: item.author.displayName,
    authorId: item.author.id,
    body: item.body,
    contentImageUrl: episodeResponse.item.stillUrl ?? seriesResponse.item.posterUrl,
    contentTitle: episodeResponse.item.title,
    id: item.id,
    likeCount: item.likeCount,
    likedByViewer: item.likedByViewer,
    rating: item.score,
    target: {
      contentType: 'episode',
      episodeNumber: item.content.episodeNumber,
      seasonNumber: item.content.seasonNumber,
      seriesTitle: seriesResponse.item.title,
      seriesTmdbId: item.content.seriesTmdbId,
    },
    type: item.type,
    updatedAt: item.updatedAt,
  };
}

function openFeedContent(navigation: HomeNavigation, item: HomeFeedItem) {
  if (item.target.contentType === 'movie') {
    navigation.navigate('FilmDetail', {
      title: item.contentTitle,
      tmdbId: item.target.tmdbId,
    });
    return;
  }

  navigation.navigate('EpisodeDetail', {
    episodeNumber: item.target.episodeNumber,
    seasonNumber: item.target.seasonNumber,
    seriesTitle: item.target.seriesTitle,
    title: item.contentTitle,
    tmdbId: item.target.seriesTmdbId,
  });
}

function toTrendingItem(item: CatalogueSearchItem): HomeTrendingItem {
  return {
    mediaType: item.mediaType,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate,
    title: item.title,
    tmdbId: item.tmdbId,
    voteAverage: item.voteAverage,
  };
}

function toHomeResource<T>(data: T | null, error: string | null): HomeResource<T> {
  return { data, error };
}

function isReleased(airDate: string | null) {
  return airDate !== null && airDate <= new Date().toISOString().slice(0, 10);
}

function TrendingMetadata({ item }: { item: HomeTrendingItem }) {
  const year = item.releaseDate?.match(/^\d{4}/)?.[0];

  if (!year && item.voteAverage === null) {
    return null;
  }

  return (
    <View style={styles.posterMetaRow}>
      {year ? <Text numberOfLines={1} style={styles.posterMeta}>{year}</Text> : null}
      {year && item.voteAverage !== null ? <Text style={styles.posterMetaSeparator}>·</Text> : null}
      <CatalogueRating voteAverage={item.voteAverage} />
    </View>
  );
}

const styles = StyleSheet.create({
  blockingState: {
    paddingTop: spacing.xl,
  },
  composition: {
    gap: spacing.xxl,
  },
  emptySection: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
  hero: {
    paddingHorizontal: spacing.xl,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.background,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  notificationBadgeLabel: {
    color: colors.textOnAccent,
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  poster: {
    height: 190,
    width: 126,
  },
  posterCard: {
    width: 126,
  },
  posterMeta: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  posterMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: spacing.xs,
  },
  posterMetaSeparator: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  posterRail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  posterTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  section: {
    paddingLeft: spacing.xl,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  signInCard: {
    marginHorizontal: spacing.xl,
  },
});
