import { Fragment, useCallback, useMemo } from 'react';
import { CompositeNavigationProp, useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, CalendarDays } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CatalogueSearchItem,
  getEpisodeDetails,
  getMovieDetails,
  getSeriesDetails,
} from '../api/catalogue';
import { FeedItem, getFeed, setFeedItemLiked } from '../api/feed';
import { listNotifications } from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { BrandWordmark } from '../brand/BrandWordmark';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { setMemoryResource } from '../cache/memoryResourceCache';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { IconButton } from '../components/IconButton';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
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
  HomeResource,
  HomeTrendingItem,
} from './homeData';
import { SocialActivityList } from './SocialActivityList';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';
import { BackgroundImportCards } from '../imports/BackgroundImportCards';
import { useLibraryData } from '../library/useLibraryData';
import { HomeWatchlists } from './HomeWatchlists';
import { useProgressData } from '../library/useProgressData';
import { selectRecentProgress } from '../library/progressModel';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export const PUBLIC_HOME_KEY = getPublicCacheKey('home:catalogue:v3');

export function getHomeFeedKey(userId: string) {
  return getPrivateCacheKey(userId, 'home:feed:v2');
}

export function getHomeNotificationsKey(userId: string) {
  return getPrivateCacheKey(userId, 'notifications:inbox:v2');
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
  } = useAuthSession();
  const feedRevision = useUserDataRevision('feed', 'opinions', 'profile', 'socialGraph');
  const notificationRevision = useUserDataRevision('notifications');
  const isFocused = useIsFocused();
  const isSignedIn = Boolean(currentUser && firebaseIdToken);
  const watchlists = useLibraryData(isSignedIn);
  const loadCatalogue = useCallback(loadHomeCatalogue, []);
  const loadFeed = useCallback(
    () => firebaseIdToken ? loadHomeFeed(firebaseIdToken) : Promise.resolve([]),
    [feedRevision, firebaseIdToken],
  );
  const loadNotifications = useCallback(async () => {
    const token = await getFirebaseIdToken();

    if (!token) {
      throw new Error('Sign in again to update Alerts.');
    }

    return loadHomeNotifications(token);
  }, [getFirebaseIdToken, notificationRevision]);
  const catalogue = useCachedResource({ key: PUBLIC_HOME_KEY, load: loadCatalogue });
  const progress = useProgressData(watchlists.data?.items ?? [], isSignedIn && isFocused && Boolean(watchlists.data), 6);
  const recentProgress = useMemo(() => selectRecentProgress(progress.items), [progress.items]);
  const feed = useCachedResource({
    enabled: isSignedIn,
    key: getHomeFeedKey(currentUser?.id ?? 'visitor'),
    load: loadFeed,
  });
  const notifications = useCachedResource({
    enabled: isSignedIn,
    key: getHomeNotificationsKey(currentUser?.id ?? 'visitor'),
    load: loadNotifications,
  });
  const unreadNotificationCount = countUnreadNotifications(notifications.data ?? []);
  const atmosphereUrl = catalogue.data?.hero?.posterUrl ?? catalogue.data?.hero?.backdropUrl ?? null;
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
      progress: toHomeResource(recentProgress, progress.error),
    }),
    [catalogue.data, catalogue.error, feed.data, feed.error, isSignedIn, recentProgress, progress.error],
  );
  const isRefreshing = catalogue.isRefreshing || progress.isRefreshing || feed.isRefreshing || notifications.isRefreshing || watchlists.isRefreshing;
  const retryAll = useCallback(() => {
    catalogue.retry();
    if (isSignedIn) {
      progress.retry();
      feed.retry();
      notifications.retry();
      watchlists.retry();
    }
  }, [catalogue.retry, feed.retry, isSignedIn, notifications.retry, progress.retry, watchlists.retry]);

  if (catalogue.isInitialLoading && !catalogue.data) {
    return (
      <Screen contentReady={Boolean(catalogue.data)} leading={<BrandWordmark height={44} />} title="">
        <View style={styles.blockingState}>
          <LoadingState variant="detail" label="Loading home" />
        </View>
      </Screen>
    );
  }

  if (catalogue.error && !catalogue.data) {
    return (
      <Screen contentReady={Boolean(catalogue.data)} leading={<BrandWordmark height={44} />} title="">
        <EmptyState body={catalogue.error} title="Home is unavailable">
          <Button label="Retry" onPress={catalogue.retry} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen contentReady={Boolean(catalogue.data)}
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
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
            <IconButton
              accessibilityLabel="Open release calendar"
              icon={<CalendarDays color={colors.textMuted} size={22} strokeWidth={2} />}
              onPress={() => navigation.navigate('ReleaseCalendar')}
            />
          ) : null}
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
        </View>
      }
    >
      <View style={styles.composition}>
        {isSignedIn ? <BackgroundImportCards /> : null}
        {isSignedIn && !sections.some((section) => section.kind === 'hero') ? <HomeWatchlists data={watchlists.data} error={watchlists.error} loading={watchlists.isInitialLoading} onRetry={watchlists.retry} /> : null}
        {sections.map((section) => {
          if (section.kind === 'hero') {
            return (
              <Fragment key="hero"><ScreenReveal delay={80} style={styles.hero}>
                <HomeHero
                  item={section.item}
                  onOpen={() => navigation.navigate('FilmDetail', {
                    title: section.item.title,
                    tmdbId: section.item.tmdbId,
                  })}
                />
              </ScreenReveal>
              {isSignedIn ? <HomeWatchlists data={watchlists.data} error={watchlists.error} loading={watchlists.isInitialLoading} onRetry={watchlists.retry} /> : null}
              </Fragment>
            );
          }

          if (section.kind === 'continueWatching') {
            return (
              <HomeSection delay={130} key="continue" title="Continue watching" onViewAll={() => navigation.navigate('MainTabs', { screen: 'Library', params: { view: 'progress' } })}>
                {progress.actionError || (section.error && section.items.length === 0) ? (
                  <InlineStatusBanner detail={progress.actionError ?? section.error!} onRetry={progress.retry} tone="error" />
                ) : null}
                {section.items.length > 0 ? (
                  <ContinueWatchingRail
                    items={section.items}
                    isBusy={progress.isBusy}
                    onWatched={(item) => void progress.markNext(item)}
                    onRetry={(item) => progress.retry(item.media.key)}
                    onOpen={(item) => item.next
                      ? navigation.navigate('EpisodeDetail', { ...item.next, seriesTitle: item.media.title, title: item.media.title, tmdbId: item.media.tmdbId })
                      : navigation.navigate('SeriesDetail', { title: item.media.title, tmdbId: item.media.tmdbId })}
                  />
                ) : null}
              </HomeSection>
            );
          }

          if (section.kind === 'socialActivity') {
            return (
              <HomeSection delay={180} key="social" title="From people you follow">
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

                      return setFeedItemLiked(firebaseIdToken, item, liked).then((result) => {
                        notifyUserDataChanged('feed');
                        return result;
                      });
                    }}
                  />
                ) : null}
              </HomeSection>
            );
          }

          return (
            <HomeSection delay={200} key="trending" title="Trending now">
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

function HomeSection({ children, delay, title, onViewAll }: { children: React.ReactNode; delay: number; title: string; onViewAll?: () => void }) {
  return (
    <ScreenReveal delay={delay} style={styles.section}>
      <SectionHeader title={title} actionLabel={onViewAll ? 'View all' : undefined} onActionPress={onViewAll} />
      <View style={styles.sectionBody}>{children}</View>
    </ScreenReveal>
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

export async function loadHomeCatalogue(): Promise<HomeCatalogueData> {
  const response = await ensureCatalogueSections();
  const featured = response.spotlight;

  if (!featured) {
    return { hero: null, trending: response.trending.map(toTrendingItem) };
  }

  let details = null;

  try {
    details = (await getMovieDetails(featured.tmdbId)).item;
    setMemoryResource(
      `watchly:public:catalogue:movie:${featured.tmdbId}:v4`,
      details,
      new Date().toISOString(),
    );
  } catch {
    // The real catalogue item remains usable even if its richer detail request fails.
  }

  return {
    hero: {
      backdropUrl: details?.backdropUrl ?? featured.backdropUrl,
      genres: details?.genres ?? [],
      logoAspectRatio: details?.logoAspectRatio ?? null,
      logoUrl: details?.logoUrl ?? null,
      posterUrl: details?.posterUrl ?? featured.posterUrl,
      releaseDate: details?.releaseDate ?? featured.releaseDate,
      runtimeMinutes: details?.runtimeMinutes ?? null,
      title: details?.title ?? featured.title,
      tmdbId: featured.tmdbId,
    },
    trending: response.trending.map(toTrendingItem),
  };
}

export async function loadHomeFeed(token: string): Promise<HomeFeedItem[]> {
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

export async function loadHomeNotifications(token: string) {
  return (await listNotifications(token)).items;
}

async function hydrateFeedItem(item: FeedItem): Promise<HomeFeedItem> {
  if (item.content.contentType === 'movie') {
    const movie = (await getMovieDetails(item.content.tmdbId)).item;

    return {
      authorAvatarUrl: item.author.avatarUrl,
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
    authorAvatarUrl: item.author.avatarUrl,
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
