import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DisplayRating, getMovieDetails, MovieDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { MovieReviewEditor } from '../reviews/MovieReviewEditor';
import { MovieRatingControl } from '../tracking/MovieRatingControl';
import { TrackingControls } from '../tracking/TrackingControls';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';

type FilmDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'FilmDetail'>;

export function FilmDetailScreen({ route }: FilmDetailScreenProps) {
  const { tmdbId } = route.params;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMovie = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await getMovieDetails(tmdbId);

      setMovie(response.item);
    } catch (caughtError) {
      setMovie(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Movie details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [tmdbId]);

  useEffect(() => {
    void loadMovie();
  }, [loadMovie]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading film details</Text>
          </View>
        ) : error ? (
          <EmptyState body={error} title="Film detail failed">
            <Button label="Retry" onPress={loadMovie} />
          </EmptyState>
        ) : movie ? (
          <MovieDetailContent movie={movie} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MovieDetailContent({ movie }: { movie: MovieDetails }) {
  const releaseYear = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;
  const runtime = formatRuntime(movie.runtimeMinutes);
  const infoItems = [releaseYear, runtime, formatDisplayRating(movie.displayRating)]
    .filter(Boolean)
    .map((item) => item as HeaderInfoItem);

  return (
    <View>
      <View style={styles.header}>
        {movie.posterUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${movie.title} poster`}
            source={{ uri: movie.posterUrl }}
            style={styles.poster}
          />
        ) : (
          <View style={styles.posterPlaceholder} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{movie.title}</Text>
          <HeaderInfoPills items={infoItems} />
          {movie.genres.length > 0 ? (
            <Text numberOfLines={2} style={styles.genres}>
              {movie.genres.join(', ')}
            </Text>
          ) : null}
          <AddToWatchlistControl contentType="movie" tmdbId={movie.tmdbId} />
        </View>
        <ReleaseAlertControl contentType="movie" tmdbId={movie.tmdbId} />
      </View>
      {movie.tagline ? <Text style={styles.tagline}>{movie.tagline}</Text> : null}
      <SynopsisPanel overview={movie.overview} />
      <TrackingControls contentType="movie" tmdbId={movie.tmdbId} />
      <StreamingAvailabilityPanel contentType="movie" tmdbId={movie.tmdbId} />
      <MovieRatingControl tmdbId={movie.tmdbId} />
      <MovieReviewEditor tmdbId={movie.tmdbId} />
    </View>
  );
}

function formatRuntime(minutes: number | null) {
  if (!minutes) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatDisplayRating(rating: DisplayRating | null) {
  if (!rating) {
    return null;
  }

  return {
    icon: 'star',
    label: toFivePointRating(rating).toFixed(1),
  } satisfies HeaderInfoItem;
}

function toFivePointRating(rating: DisplayRating) {
  return rating.scale === 10 ? rating.average / 2 : rating.average;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  genres: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 174,
    width: 116,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 174,
    width: 116,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  tagline: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
});
