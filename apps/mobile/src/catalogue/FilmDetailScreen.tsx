import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMovieDetails, MovieDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { MovieReviewEditor } from '../reviews/MovieReviewEditor';
import { MovieRatingControl } from '../tracking/MovieRatingControl';
import { TrackingControls } from '../tracking/TrackingControls';
import { WatchlistControls } from '../watchlists/WatchlistControls';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';

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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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
  const metadata = ['Film', releaseYear, runtime, movie.voteAverage ? movie.voteAverage.toFixed(1) : null]
    .filter(Boolean)
    .join(' / ');

  return (
    <View>
      {movie.backdropUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${movie.title} backdrop`}
          source={{ uri: movie.backdropUrl }}
          style={styles.backdrop}
        />
      ) : null}
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
          <Text style={styles.eyebrow}>TMDB film</Text>
          <Text style={styles.title}>{movie.title}</Text>
          {metadata ? <Text style={styles.metadata}>{metadata}</Text> : null}
          {movie.genres.length > 0 ? (
            <Text numberOfLines={2} style={styles.genres}>
              {movie.genres.join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
      {movie.tagline ? <Text style={styles.tagline}>{movie.tagline}</Text> : null}
      <TrackingControls contentType="movie" tmdbId={movie.tmdbId} />
      <WatchlistControls contentType="movie" tmdbId={movie.tmdbId} />
      <StreamingAvailabilityPanel contentType="movie" tmdbId={movie.tmdbId} />
      <MovieRatingControl tmdbId={movie.tmdbId} />
      <MovieReviewEditor tmdbId={movie.tmdbId} />
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Synopsis</Text>
        <Text style={styles.body}>{movie.overview || 'No synopsis available yet.'}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="TMDB ID" value={String(movie.tmdbId)} />
        <DetailRow label="Release date" value={movie.releaseDate ?? 'Unknown'} />
        <DetailRow label="Runtime" value={runtime ?? 'Unknown'} />
        <DetailRow label="Status" value={movie.status ?? 'Unknown'} />
      </View>
      <Text style={styles.tmdbNotice}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 170,
    marginBottom: spacing.lg,
    width: '100%',
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  detailRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  genres: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    justifyContent: 'center',
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
  metadata: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
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
  sectionTitle: {
    ...typography.title,
    color: colors.text,
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
  tmdbNotice: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
