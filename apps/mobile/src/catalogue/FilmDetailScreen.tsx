import { useCallback, useLayoutEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatalogueRelatedItem, DisplayRating, MovieDetails } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { resolveDetailMetadataLayout } from '../components/dynamicTypeLayout';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MediaHero } from '../components/MediaHero';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { MovieReviewEditor } from '../reviews/MovieReviewEditor';
import { TrackingControls } from '../tracking/TrackingControls';
import { ViewingCountControl } from '../viewings/ViewingCountControl';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';
import {
  CatalogueCastRail,
  CatalogueKeywordList,
  CatalogueRelatedRail,
  CatalogueVideoRail,
} from './CatalogueDetailSections';
import { useCatalogueCache } from './CatalogueCacheContext';
import { DetailFacts } from './DetailFacts';
import {
  formatDetailDate,
  formatFivePointRating,
  formatMoney,
  formatRuntime,
  getDistinctOriginalTitle,
  getDetailRenderMode,
} from './detailModel';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { isReleasedDate } from './releaseDates';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { MovieWhatsNext } from './MovieWhatsNext';

type FilmDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'FilmDetail'>;

export function FilmDetailScreen({ navigation, route }: FilmDetailScreenProps) {
  const { tmdbId } = route.params;
  const { getCachedMovie, refreshMovie } = useCatalogueCache();
  const load = useCallback(() => refreshMovie(tmdbId), [refreshMovie, tmdbId]);
  const resource = useCachedResource<MovieDetails>({
    key: `watchly:public:catalogue:movie:${tmdbId}:v5`,
    load,
  });
  const movie = resource.data ?? getCachedMovie(tmdbId);
  const renderMode = getDetailRenderMode({
    hasData: Boolean(movie),
    hasError: Boolean(resource.error),
    isInitialLoading: resource.isInitialLoading,
  });
  const atmosphereUrl = movie?.posterUrl ?? movie?.backdropUrl ?? null;

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
      {atmosphereUrl ? <SpotlightAtmosphere blurRadius={28} imageUrl={atmosphereUrl} /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {renderMode === 'loading' ? (
          <View style={styles.stateFrame}>
            <LoadingState variant="detail" label="Loading film details" />
          </View>
        ) : renderMode === 'fullError' ? (
          <View style={styles.stateFrame}>
            <EmptyState body={resource.error ?? 'Movie details failed.'} title="Film detail failed">
              <Button label="Retry" onPress={resource.retry} />
            </EmptyState>
          </View>
        ) : movie ? (
          <MovieDetailContent
            movie={movie}
            onOpenRelated={(item) => openRelatedMovie(navigation, item)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MovieDetailContent({
  movie,
  onOpenRelated,
}: {
  movie: MovieDetails;
  onOpenRelated: (item: CatalogueRelatedItem) => void;
}) {
  const [isWatched, setIsWatched] = useState(false);
  const { fontScale } = useWindowDimensions();
  const metadataLayout = resolveDetailMetadataLayout(fontScale);
  const isReleased = isReleasedDate(movie.releaseDate);
  const releaseYear = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const runtime = formatRuntime(movie.runtimeMinutes);
  const infoItems = ['Film', releaseYear, runtime, isReleased ? formatDisplayRating(movie.displayRating) : null]
    .filter(Boolean)
    .map((item) => item as HeaderInfoItem);
  const detailFacts = [
    { label: 'Original title', value: getDistinctOriginalTitle(movie.originalTitle, movie.title) },
    { label: 'Director', value: movie.directors?.join(', ') || null },
    { label: 'Writers', value: movie.writers?.join(', ') || null },
    { label: 'Release date', value: formatDetailDate(movie.releaseDate) },
    { label: 'Runtime', value: runtime },
    { label: 'Status', value: movie.status },
    { label: 'Budget', value: formatMoney(movie.budget) },
    { label: 'Revenue', value: formatMoney(movie.revenue) },
    { label: 'Production', value: movie.productionCompanies?.map((company) => company.name).join(', ') || null },
  ];

  return (
    <View>
      <ScreenReveal delay={50}><MediaHero
        actionAccessory={<ReleaseAlertControl collectionName={movie.collection?.name} contentType="movie" tmdbId={movie.tmdbId} />}
        actions={<AddToWatchlistControl contentType="movie" tmdbId={movie.tmdbId} />}
        backdropUrl={movie.backdropUrl}
        logoAspectRatio={movie.logoAspectRatio}
        logoUrl={movie.logoUrl}
        posterUrl={movie.posterUrl}
        title={movie.title}
      >
        {movie.genres.length > 0 ? (
          <Text numberOfLines={metadataLayout.genreNumberOfLines} style={styles.genres}>
            {movie.genres.join(' · ')}
          </Text>
        ) : null}
        <HeaderInfoPills items={infoItems} />
      </MediaHero></ScreenReveal>
      <ScreenReveal delay={100} style={styles.bodyStack}>
        {movie.tagline ? <Text style={styles.tagline}>{movie.tagline}</Text> : null}
        <SynopsisPanel overview={movie.overview} />
        <View style={styles.personalSection}>
          <Text style={styles.personalEyebrow}>Your activity</Text>
          <TrackingControls contentType="movie" onWatchedChange={setIsWatched} tmdbId={movie.tmdbId} />
          <ViewingCountControl contentType="movie" title={movie.title} tmdbId={movie.tmdbId} />
          {isWatched && movie.collection ? <MovieWhatsNext collectionId={movie.collection.id} tmdbId={movie.tmdbId} onOpen={onOpenRelated} /> : null}
          {isReleased ? (
            <MovieReviewEditor mediaTitle={movie.title} posterUrl={movie.posterUrl} tmdbId={movie.tmdbId} />
          ) : null}
        </View>
        <DetailFacts items={detailFacts} />
        <CatalogueVideoRail videos={movie.videos ?? []} />
        <StreamingAvailabilityPanel contentType="movie" tmdbId={movie.tmdbId} />
        <CatalogueCastRail cast={movie.cast ?? []} />
        <CatalogueKeywordList keywords={movie.keywords ?? []} />
        {!isWatched && movie.collection ? <MovieWhatsNext collectionId={movie.collection.id} tmdbId={movie.tmdbId} onOpen={onOpenRelated} /> : null}
        <CatalogueRelatedRail items={movie.recommendations ?? []} onOpen={onOpenRelated} />
      </ScreenReveal>
    </View>
  );
}

function openRelatedMovie(
  navigation: FilmDetailScreenProps['navigation'],
  item: CatalogueRelatedItem,
) {
  if (item.mediaType === 'movie') {
    navigation.push('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    return;
  }

  navigation.push('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
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
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },

  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  genres: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  personalEyebrow: {
    ...typography.eyebrow,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
  },
  personalSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xl,
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
    color: colors.accentText,
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    lineHeight: 23,
    paddingTop: spacing.lg,
    textAlign: 'center',
  },
});
