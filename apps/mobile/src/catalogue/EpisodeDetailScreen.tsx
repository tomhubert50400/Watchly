import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Star } from 'lucide-react-native';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { EpisodeDetails, getEpisodeDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { EpisodeReviewEditor } from '../reviews/EpisodeReviewEditor';
import { EpisodeProgressControl } from '../tracking/EpisodeProgressControl';
import { isReleasedDate } from './releaseDates';

type EpisodeDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

export function EpisodeDetailScreen({ navigation, route }: EpisodeDetailScreenProps) {
  const { episodeNumber, seasonNumber, tmdbId } = route.params;
  const { width: windowWidth } = useWindowDimensions();
  const [episode, setEpisode] = useState<EpisodeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEpisode = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await getEpisodeDetails(tmdbId, seasonNumber, episodeNumber);

      setEpisode(response.item);
    } catch (caughtError) {
      setEpisode(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Episode details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [episodeNumber, seasonNumber, tmdbId]);

  useEffect(() => {
    void loadEpisode();
  }, [loadEpisode]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackground: undefined,
      headerRight: undefined,
      headerTitle: () => (
        <View pointerEvents="none" style={[styles.headerTitleRow, { width: windowWidth }]}>
          <Text numberOfLines={1} style={styles.headerSeriesTitle}>
            {route.params.seriesTitle}
          </Text>
          {episode?.airDate ? <Text style={styles.headerAirDate}>{episode.airDate}</Text> : null}
        </View>
      ),
      title: undefined,
    });
  }, [episode?.airDate, navigation, route.params.seriesTitle, windowWidth]);

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingFrame}>
            <LoadingState label="Loading episode details" />
          </View>
        ) : error ? (
          <EmptyState body={error} title="Episode detail failed">
            <Button label="Retry" onPress={loadEpisode} />
          </EmptyState>
        ) : episode ? (
          <EpisodeDetailContent episode={episode} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function EpisodeDetailContent({ episode }: { episode: EpisodeDetails }) {
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const isReleased = isReleasedDate(episode.airDate);
  const episodeCode = `S${episode.seasonNumber} E${episode.episodeNumber}`;
  const rating = isReleased && episode.voteAverage ? `${(episode.voteAverage / 2).toFixed(1)}/5` : null;

  return (
    <View>
      <View style={styles.hero}>
        {episode.stillUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${episode.title} still`}
            source={{ uri: episode.stillUrl }}
            style={styles.still}
          />
        ) : (
          <View style={styles.stillPlaceholder} />
        )}
        <View style={styles.heroScrim} />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Episode</Text>
          <Text style={styles.title}>{episode.title}</Text>
          <View style={styles.metaRow}>
            <Chip label={episodeCode} tone="accent" />
            {episode.airDate ? <Chip label={episode.airDate} /> : null}
            {runtime ? <Chip label={runtime} /> : null}
            {rating ? (
              <Chip
                icon={<Star color={colors.rating} fill={colors.rating} size={11} strokeWidth={2} />}
                label={rating}
                tone="rating"
              />
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.bodyStack}>
        <EpisodeProgressControl
          episodeNumber={episode.episodeNumber}
          seasonNumber={episode.seasonNumber}
          seriesTmdbId={episode.seriesTmdbId}
        />
        {isReleased ? (
          <EpisodeReviewEditor
            episodeNumber={episode.episodeNumber}
            mediaTitle={episode.title}
            posterUrl={episode.stillUrl}
            seasonNumber={episode.seasonNumber}
            seriesTmdbId={episode.seriesTmdbId}
          />
        ) : null}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.body}>{episode.overview || 'No synopsis available yet.'}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Season" value={String(episode.seasonNumber)} />
          <DetailRow label="Episode" value={String(episode.episodeNumber)} />
          <DetailRow label="Air date" value={episode.airDate ?? 'Unknown'} />
          <DetailRow label="Runtime" value={runtime ?? 'Unknown'} />
        </View>
      </View>
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

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingTop: 0,
  },
  bodyStack: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
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
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  headerAirDate: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    position: 'absolute',
    right: spacing.xl + spacing.xxl,
    textTransform: 'uppercase',
  },
  headerSeriesTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    maxWidth: 180,
    textAlign: 'center',
    transform: [{ translateX: -spacing.xl }],
  },
  headerTitleRow: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: colors.panelSoft,
    minHeight: 282,
    overflow: 'hidden',
  },
  heroCopy: {
    bottom: spacing.xl,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  loadingFrame: {
    padding: spacing.xl,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  still: {
    backgroundColor: colors.panelSoft,
    height: 282,
    width: '100%',
  },
  stillPlaceholder: {
    backgroundColor: colors.panelSoft,
    height: 282,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 38,
  },
});
