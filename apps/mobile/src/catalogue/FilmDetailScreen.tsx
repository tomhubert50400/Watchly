import { useCallback, useLayoutEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DisplayRating, MovieDetails } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { resolveDetailMetadataLayout } from '../components/dynamicTypeLayout';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaHero } from '../components/MediaHero';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { MovieReviewEditor } from '../reviews/MovieReviewEditor';
import { TrackingControls } from '../tracking/TrackingControls';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';
import { useCatalogueCache } from './CatalogueCacheContext';
import { formatFivePointRating, formatRuntime, getDetailRenderMode } from './detailModel';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { isReleasedDate } from './releaseDates';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';

type FilmDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'FilmDetail'>;

export function FilmDetailScreen({ navigation, route }: FilmDetailScreenProps) {
  const { tmdbId } = route.params;
  const { getCachedMovie, refreshMovie } = useCatalogueCache();
  const load = useCallback(() => refreshMovie(tmdbId), [refreshMovie, tmdbId]);
  const resource = useCachedResource<MovieDetails>({
    key: `watchly:public:catalogue:movie:${tmdbId}`,
    load,
  });
  const movie = resource.data ?? getCachedMovie(tmdbId);
  const renderMode = getDetailRenderMode({
    hasData: Boolean(movie),
    hasError: Boolean(resource.error),
    isInitialLoading: resource.isInitialLoading,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: colors.text,
      headerTitle: '',
      headerTransparent: true,
    });
  }, [navigation]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {renderMode === 'loading' ? (
          <View style={styles.stateFrame}>
            <LoadingState label="Loading film details" />
          </View>
        ) : renderMode === 'fullError' ? (
          <View style={styles.stateFrame}>
            <EmptyState body={resource.error ?? 'Movie details failed.'} title="Film detail failed">
              <Button label="Retry" onPress={resource.retry} />
            </EmptyState>
          </View>
        ) : movie ? (
          <MovieDetailContent
            error={resource.error}
            isRefreshing={resource.isRefreshing || resource.isInitialLoading}
            movie={movie}
            onRetry={resource.retry}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MovieDetailContent({
  error,
  isRefreshing,
  movie,
  onRetry,
}: {
  error: string | null;
  isRefreshing: boolean;
  movie: MovieDetails;
  onRetry: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const metadataLayout = resolveDetailMetadataLayout(fontScale);
  const isReleased = isReleasedDate(movie.releaseDate);
  const releaseYear = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const runtime = formatRuntime(movie.runtimeMinutes);
  const infoItems = [releaseYear, runtime, isReleased ? formatDisplayRating(movie.displayRating) : null]
    .filter(Boolean)
    .map((item) => item as HeaderInfoItem);

  return (
    <View>
      <MediaHero
        actionAccessory={<ReleaseAlertControl contentType="movie" tmdbId={movie.tmdbId} />}
        actions={<AddToWatchlistControl contentType="movie" tmdbId={movie.tmdbId} />}
        backdropUrl={movie.backdropUrl}
        eyebrow="Film"
        posterAccessibilityLabel={`${movie.title} poster`}
        posterUrl={movie.posterUrl}
        title={movie.title}
      >
        <HeaderInfoPills items={infoItems} />
        {movie.genres.length > 0 ? (
          <Text numberOfLines={metadataLayout.genreNumberOfLines} style={styles.genres}>
            {movie.genres.join(' · ')}
          </Text>
        ) : null}
        {movie.tagline ? (
          <Text numberOfLines={2} style={styles.tagline}>
            {movie.tagline}
          </Text>
        ) : null}
      </MediaHero>
      <View style={styles.bodyStack}>
        {isRefreshing ? (
          <InlineStatusBanner detail="Refreshing film details" tone="updating" />
        ) : error ? (
          <InlineStatusBanner detail={error} onRetry={onRetry} title="Film update failed" tone="error" />
        ) : null}
        <View style={styles.personalSection}>
          <Text style={styles.personalEyebrow}>Your activity</Text>
          <TrackingControls contentType="movie" tmdbId={movie.tmdbId} />
          {isReleased ? (
            <MovieReviewEditor mediaTitle={movie.title} posterUrl={movie.posterUrl} tmdbId={movie.tmdbId} />
          ) : null}
        </View>
        <SynopsisPanel overview={movie.overview} />
        <StreamingAvailabilityPanel contentType="movie" tmdbId={movie.tmdbId} />
      </View>
    </View>
  );
}

function formatDisplayRating(rating: DisplayRating | null) {
  if (!rating) {
    return null;
  }

  return {
    icon: 'star',
    label: formatFivePointRating(rating.average, rating.scale),
  } satisfies HeaderInfoItem;
}

const styles = StyleSheet.create({
  bodyStack: {
    paddingHorizontal: spacing.xl,
  },

  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  genres: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  personalEyebrow: {
    ...typography.eyebrow,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
  },
  personalSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },

  stateFrame: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 120,
  },
  tagline: {
    ...typography.meta,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
