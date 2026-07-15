import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Star } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SeasonDetails } from '../api/catalogue';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { isReleasedDate } from '../catalogue/releaseDates';
import { ensureEpisodeDetails } from '../catalogue/cataloguePrefetch';
import { isEpisodeWatched } from './episodeModel';
import { useSeasonEpisodes } from './useSeasonEpisodes';

type SeasonEpisodeListProps = {
  initialSeason?: SeasonDetails;
  seasonNumber: number;
  seriesTitle: string;
  seriesTmdbId: number;
};

export function SeasonEpisodeList({
  initialSeason,
  seasonNumber,
  seriesTitle,
  seriesTmdbId,
}: SeasonEpisodeListProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const model = useSeasonEpisodes({ initialSeason, seasonNumber, seriesTmdbId });

  useEffect(() => {
    const likelyEpisode = model.nextEpisode ?? model.episodes[0];
    if (likelyEpisode) {
      void ensureEpisodeDetails(
        seriesTmdbId,
        likelyEpisode.seasonNumber,
        likelyEpisode.episodeNumber,
      ).catch(() => undefined);
    }
  }, [model.episodes, model.nextEpisode, seriesTmdbId]);

  if (model.isLoading && !model.season) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading episodes</Text>
      </View>
    );
  }

  if (!model.season && model.error) {
    return (
      <InlineStatusBanner
        detail={model.error}
        onRetry={model.retry}
        title="Episodes unavailable"
        tone="error"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View>
          <Text style={styles.progressTitle}>Season {seasonNumber}</Text>
          <Text style={styles.progressMeta}>
            {model.isSignedIn
              ? `${model.progress.completed} watched · ${Math.round(model.progress.fraction * 100)}% complete`
              : 'Sign in to track progress'}
          </Text>
        </View>
        <View style={styles.progressCount}>
          <Text style={styles.progressCountStrong}>
            {model.progress.completed} / {model.progress.total}
          </Text>
          <Text style={styles.progressCountMeta}>episodes</Text>
        </View>
      </View>

      {model.isRefreshing ? (
        <InlineStatusBanner detail="Refreshing episodes and progress" tone="updating" />
      ) : model.error && model.episodes.length > 0 ? (
        <InlineStatusBanner
          detail={model.error}
          onRetry={model.retry}
          title="Episode update failed"
          tone="error"
        />
      ) : null}

      {model.episodes.length > 0 ? model.episodes.map((episode) => {
        const watched = isEpisodeWatched(
          model.watchedState,
          episode.seasonNumber,
          episode.episodeNumber,
        );
        const isNext = model.nextEpisode?.episodeNumber === episode.episodeNumber;
        const released = isReleasedDate(episode.airDate);
        const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
        const rating = released && episode.voteAverage
          ? `${(episode.voteAverage / 2).toFixed(1)}`
          : null;

        return (
          <Pressable
            accessibilityLabel={`Open ${episode.title}${watched ? ', watched' : isNext ? ', next episode' : ''}`}
            accessibilityRole="button"
            key={episode.id}
            onPressIn={() => {
              void ensureEpisodeDetails(
                seriesTmdbId,
                episode.seasonNumber,
                episode.episodeNumber,
              ).catch(() => undefined);
            }}
            onPress={() => navigation.navigate('EpisodeDetail', {
              episodeNumber: episode.episodeNumber,
              seasonNumber: episode.seasonNumber,
              seriesTitle,
              title: episode.title,
              tmdbId: seriesTmdbId,
            })}
            style={({ pressed }) => [
              styles.episode,
              isNext && styles.nextEpisode,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.imageFrame}>
              {episode.stillUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${episode.title} still`}
                  source={{ uri: episode.stillUrl }}
                  style={styles.still}
                />
              ) : <View style={styles.stillPlaceholder} />}
              {watched ? (
                <View style={styles.watchedBadge}>
                  <Check color={colors.textOnAccent} size={16} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={styles.title}>
                {episode.episodeNumber} · {episode.title}
              </Text>
              {rating ? (
                <View style={styles.ratingRow}>
                  <Star color={colors.rating} fill={colors.rating} size={13} />
                  <Text style={styles.ratingText}>{rating} / 5</Text>
                </View>
              ) : (
                <Text style={styles.meta}>
                  {[isNext ? 'Next episode' : episode.airDate, runtime].filter(Boolean).join(' · ')}
                </Text>
              )}
              <View style={styles.actions}>
                {model.isSignedIn && released ? (
                  <Pressable
                    accessibilityLabel={watched ? `Mark episode ${episode.episodeNumber} unwatched` : `Mark episode ${episode.episodeNumber} watched`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: model.isSaving, selected: watched }}
                    disabled={model.isSaving}
                    onPress={(event) => {
                      event.stopPropagation();
                      void model.setEpisodeWatched(episode.episodeNumber, !watched);
                    }}
                    style={({ pressed }) => [
                      styles.miniButton,
                      (watched || isNext) && styles.miniButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.miniLabel, (watched || isNext) && styles.miniLabelActive]}>
                      {watched ? 'Watched' : 'Mark watched'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Open episode ${episode.episodeNumber} to ${rating ? 'edit opinion' : 'rate'}`}
                  accessibilityRole="button"
                  onPress={(event) => {
                    event.stopPropagation();
                    navigation.navigate('EpisodeDetail', {
                      episodeNumber: episode.episodeNumber,
                      seasonNumber: episode.seasonNumber,
                      seriesTitle,
                      title: episode.title,
                      tmdbId: seriesTmdbId,
                    });
                  }}
                  style={({ pressed }) => [styles.miniButton, pressed && styles.pressed]}
                >
                  <Text style={styles.miniLabel}>{rating ? 'Edit opinion' : 'Rate'}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        );
      }) : (
        <Text style={styles.empty}>No episode data available yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  container: { gap: spacing.sm },
  copy: { flex: 1, minWidth: 0, paddingVertical: spacing.xs },
  empty: { ...typography.body, color: colors.muted, paddingVertical: spacing.md },
  episode: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 112,
    padding: spacing.sm,
  },
  imageFrame: { position: 'relative' },
  loading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  loadingText: { ...typography.body, color: colors.muted },
  meta: { ...typography.meta, color: colors.muted, marginTop: spacing.xs },
  miniButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.sm,
  },
  miniButtonActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  miniLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  miniLabelActive: { color: colors.accentText },
  nextEpisode: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  pressed: { opacity: 0.76 },
  progressCount: { alignItems: 'flex-end' },
  progressCountMeta: { ...typography.meta, color: colors.muted },
  progressCountStrong: { color: colors.text, fontSize: 14, fontWeight: '900' },
  progressMeta: { ...typography.meta, color: colors.muted, marginTop: 2 },
  progressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  progressTitle: { ...typography.title, color: colors.text },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  ratingText: { color: colors.rating, fontSize: 12, fontWeight: '800' },
  still: { backgroundColor: colors.panelSoft, borderRadius: radii.md, height: 70, width: 117 },
  stillPlaceholder: { backgroundColor: colors.panelSoft, borderRadius: radii.md, height: 70, width: 117 },
  title: { ...typography.title, color: colors.text, fontSize: 14, lineHeight: 18 },
  watchedBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.panelElevated,
    borderRadius: 16,
    borderWidth: 3,
    bottom: -3,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    width: 30,
  },
});
