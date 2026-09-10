import { EyeOff } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { MovieDetails, SeriesDetails } from '../api/catalogue';
import { getEpisodeDetails } from '../api/catalogue';
import { CommunityItem, getCommunityFeed, setFeedItemLiked } from '../api/feed';
import type { ReportTarget } from '../api/reports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReportSheet } from '../reports/ReportSheet';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';
import { SpoilerSettingsSheet } from './SpoilerSettingsSheet';
import { spoilerReason } from './spoilerModel';
import { useSpoilerPreferences } from './useSpoilerPreferences';

type FeedNavigation = NativeStackNavigationProp<RootStackParamList>;
export type HydratedFeedItem = CommunityItem & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
  releaseDate: string | null;
  nextCursor: string | null;
};

export function getCommunityFeedKey(userId: string) {
  return `watchly:user:${userId}:community-feed:v2`;
}

export async function loadCommunityFeed(
  token: string,
  loadMovie: (tmdbId: number) => Promise<MovieDetails>,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
  previous: HydratedFeedItem[] = [],
  cursor?: string,
) {
  const response = await getCommunityFeed(token, cursor);
  const movies = new Map<number, Promise<MovieDetails>>();
  const series = new Map<number, Promise<SeriesDetails>>();
  const movieFor = (id: number) => {
    if (!movies.has(id)) movies.set(id, loadMovie(id));
    return movies.get(id)!;
  };
  const seriesFor = (id: number) => {
    if (!series.has(id)) series.set(id, loadSeries(id));
    return series.get(id)!;
  };
  const hydrated = new Array<HydratedFeedItem>(response.items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(5, response.items.length) }, async () => {
    while (nextIndex < response.items.length) {
      const index = nextIndex++;
      const item = response.items[index];
      hydrated[index] = await hydrateFeedItem(item, previous.find((candidate) => candidate.id === item.id), movieFor, seriesFor, response.nextCursor);
    }
  }));
  return hydrated;
}

export function FeedScreen() {
  const navigation = useNavigation<FeedNavigation>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const feedRevision = useUserDataRevision('feed', 'opinions', 'profile', 'socialGraph', 'tracking', 'viewings', 'episodeProgress', 'watchlists', 'releaseAlerts');
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [spoilerSettingsOpen, setSpoilerSettingsOpen] = useState(false);
  const protection = useSpoilerPreferences(currentUser?.id ?? 'signed-out');
  const resourceKey = getCommunityFeedKey(currentUser?.id ?? 'signed-out');
  const loadFeed = useCallback(
    (cached?: HydratedFeedItem[]) => firebaseIdToken
      ? loadCommunityFeed(firebaseIdToken, refreshMovie, refreshSeries, cached)
      : Promise.resolve([]),
    [feedRevision, firebaseIdToken, refreshMovie, refreshSeries],
  );
  const resource = useCachedResource<HydratedFeedItem[]>({
    enabled: Boolean(currentUser && firebaseIdToken), key: resourceKey, load: loadFeed,
  });
  const [extra, setExtra] = useState<{ base: HydratedFeedItem[] | null; items: HydratedFeedItem[]; cursor: string | null }>({ base: null, items: [], cursor: null });
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const pagePending = useRef(false);
  const baseRef = useRef(resource.data);
  baseRef.current = resource.data;
  const extraItems = extra.base === resource.data ? extra.items : [];
  const items = [...(resource.data ?? []), ...extraItems];
  const nextCursor = extra.base === resource.data ? extra.cursor : resource.data?.at(-1)?.nextCursor;

  async function loadMore() {
    if (!firebaseIdToken || !nextCursor || pagePending.current) return;
    const base = resource.data;
    pagePending.current = true;
    setLoadingPage(true);
    setPageError(null);
    try {
      const page = await loadCommunityFeed(firebaseIdToken, refreshMovie, refreshSeries, [], nextCursor);
      if (baseRef.current !== base) return;
      const ids = new Set(items.map((item) => item.id));
      setExtra({ base, items: [...extraItems, ...page.filter((item) => !ids.has(item.id))], cursor: page.at(-1)?.nextCursor ?? null });
    } catch (error) {
      if (baseRef.current === base) setPageError(error instanceof Error ? error.message : 'Could not load more posts.');
    } finally {
      pagePending.current = false;
      setLoadingPage(false);
    }
  }

  const openContent = useCallback((item: HydratedFeedItem) => {
    if (item.content.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title: item.contentTitle, tmdbId: item.content.tmdbId });
    } else if (item.content.contentType === 'series') {
      navigation.navigate('SeriesDetail', { title: item.contentTitle, tmdbId: item.content.seriesTmdbId });
    } else if (item.seriesTitle) {
      navigation.navigate('EpisodeDetail', {
        episodeNumber: item.content.episodeNumber, seasonNumber: item.content.seasonNumber,
        seriesTitle: item.seriesTitle, title: item.contentTitle, tmdbId: item.content.seriesTmdbId,
      });
    } else {
      navigation.navigate('SeriesDetail', { title: 'Series', tmdbId: item.content.seriesTmdbId });
    }
  }, [navigation]);

  return (
    <Screen
      refreshControl={firebaseIdToken ? <RefreshControl colors={[colors.accent]} onRefresh={resource.revalidate} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined}
      title="Community"
      trailing={firebaseIdToken ? (
        <IconButton
          accessibilityLabel="Spoiler protection"
          icon={<EyeOff color={colors.text} size={21} />}
          onPress={() => setSpoilerSettingsOpen(true)}
        />
      ) : undefined}
    >
      {!firebaseIdToken ? (
        <SignInRequiredCard body="Discover public ratings and reviews about the movies and series you love." title="Sign in to join Community" />
      ) : resource.isInitialLoading && items.length === 0 ? (
        <LoadingState label="Loading feed" />
      ) : resource.error && items.length === 0 ? (
        <EmptyState body={resource.error} title="Community failed"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      ) : <>
        <View style={styles.feedIntro}>
          <Text style={styles.feedIntroTitle}>For you</Text>
        </View>
        {items.length === 0 ? (
          <EmptyState body="New public ratings and reviews will appear here. Pull down to refresh." title="No community activity yet">
            <Button label="Refresh" onPress={resource.revalidate} variant="secondary" />
          </EmptyState>
        ) : <View style={styles.list}>
          {items.map((item) => {
            const reviewType = item.type === 'movieReview' || item.type === 'episodeReview' ? item.type : null;
            return <SocialReviewPost
              authorAvatarUrl={item.author.avatarUrl}
              authorDisplayName={item.author.displayName}
              body={item.body}
              contentImageUrl={item.contentImageUrl}
              contentMeta={item.contentSubtitle}
              contentTitle={item.contentTitle}
              key={item.id}
              likeCount={item.likeCount}
              likedByViewer={item.likedByViewer}
              spoilerReason={protection.loaded ? spoilerReason(protection.preferences, item) : 'Loading spoiler protection'}
              spoilerKey={`${currentUser?.id}:${item.id}:${JSON.stringify(protection.preferences)}`}
              spoilerContextLabel={item.content.contentType === 'episode' ? `${item.seriesTitle ?? 'Episode'} / S${item.content.seasonNumber} E${item.content.episodeNumber}` : item.contentTitle}
              canReveal={protection.loaded}
              onOpenAuthor={() => navigation.navigate('PublicProfile', { userId: item.author.id })}
              onOpenContent={() => openContent(item)}
              onReport={currentUser?.id === item.author.id || !reviewType ? undefined : () => setReportTarget({
                id: item.id, label: `Review by ${item.author.displayName?.trim() || 'Watchly member'}`, type: reviewType,
              })}
              onSetLiked={reviewType ? (liked) => setFeedItemLiked(firebaseIdToken, { id: item.id, type: reviewType }, liked).then((result) => {
                notifyUserDataChanged('feed');
                return result;
              }) : undefined}
              rating={item.score}
              updatedAt={item.updatedAt}
            />;
          })}
          {pageError ? <Text accessibilityRole="alert" style={styles.feedIntroBody}>{pageError}</Text> : null}
          {nextCursor ? <Button label={pageError ? 'Retry loading more' : 'Load more'} loading={loadingPage} onPress={() => void loadMore()} variant="secondary" /> : null}
        </View>}
      </>}
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
      <SpoilerSettingsSheet userId={currentUser?.id ?? 'signed-out'} visible={spoilerSettingsOpen} onClose={() => setSpoilerSettingsOpen(false)} />
    </Screen>
  );
}

async function hydrateFeedItem(
  item: CommunityItem,
  previous: HydratedFeedItem | undefined,
  loadMovie: (tmdbId: number) => Promise<MovieDetails>,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
  nextCursor: string | null,
): Promise<HydratedFeedItem> {
  const base = { ...item, nextCursor, contentSubtitle: communityLabel(item) };
  try {
    if (item.content.contentType === 'movie') {
      const movie = await loadMovie(item.content.tmdbId);
      return { ...base, contentImageUrl: movie.posterUrl, contentTitle: movie.title, releaseDate: movie.releaseDate, seriesTitle: null };
    }
    if (item.content.contentType === 'series') {
      const series = await loadSeries(item.content.seriesTmdbId);
      return { ...base, contentImageUrl: series.posterUrl, contentTitle: series.title, releaseDate: series.firstAirDate, seriesTitle: series.title };
    }
    const [episodeResponse, series] = await Promise.all([
      getEpisodeDetails(item.content.seriesTmdbId, item.content.seasonNumber, item.content.episodeNumber),
      loadSeries(item.content.seriesTmdbId),
    ]);
    return { ...base, contentImageUrl: episodeResponse.item.stillUrl, contentTitle: episodeResponse.item.title, releaseDate: episodeResponse.item.airDate, seriesTitle: series.title };
  } catch {
    return previous ? { ...previous, ...base } : {
      ...base, contentImageUrl: null, contentTitle: item.content.contentType === 'movie' ? `Movie TMDB ${item.content.tmdbId}` : 'Series',
      releaseDate: null, seriesTitle: null,
    };
  }
}

function communityLabel(item: CommunityItem) {
  const source = item.followed ? 'Following' : 'Discover';
  const action = item.type === 'viewing' ? item.content.contentType === 'series' ? 'Watched an episode' : 'Watched' : item.type.endsWith('Review') ? 'Review' : 'Rating';
  const episode = item.content.contentType === 'episode' ? ` / S${item.content.seasonNumber} E${item.content.episodeNumber}` : '';
  return `${source} / ${action}${episode}`;
}

const styles = StyleSheet.create({
  feedIntro: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md },
  feedIntroBody: { ...typography.body, color: colors.muted },
  feedIntroTitle: { ...typography.title, color: colors.text },
  list: { gap: 0 },
});
