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

      {model.episodes.length > 0 ? model.episodes.map((episode) => {
        const watched = isEpisodeWatched(
          model.watchedState,
          episode.seasonNumber,
          episode.episodeNumber,
        );
        const isNext = model.nextEpisode?.episodeNumber === episode.episodeNumber;
        const released = isReleasedDate(episode.airDate);
        const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
        const displayRating = released && episode.voteAverage
          ? `${(episode.voteAverage / 2).toFixed(1)}`
          : null;
        const episodeMeta = [
          isNext ? 'Next episode' : episode.airDate,
          runtime,
        ].filter(Boolean).join(' · ');

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
            </View>
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text numberOfLines={2} style={styles.title}>
                  {episode.episodeNumber} · {episode.title}
                </Text>
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
                      styles.statusButton,
                      watched && styles.statusButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Check
                      color={watched ? colors.textOnAccent : colors.textSubtle}
                      size={18}
                      strokeWidth={watched ? 3 : 2}
                    />
                  </Pressable>
                ) : null}
              </View>
              {episodeMeta || displayRating ? (
                <View style={styles.metaRow}>
                  {episodeMeta ? <Text style={[styles.meta, isNext && styles.nextMeta]}>{episodeMeta}</Text> : null}
                  {episodeMeta && displayRating ? <Text style={styles.separator}>·</Text> : null}
                  {displayRating ? (
                    <View style={styles.ratingRow}>
                      <Star color={colors.rating} fill={colors.rating} size={13} />
                      <Text style={styles.ratingText}>{displayRating} / 5</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
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
  container: { gap: 0 },
  copy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  empty: { ...typography.body, color: colors.muted, paddingVertical: spacing.md },
  episode: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'transparent',
    borderLeftWidth: 2,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 94,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
  },
  imageFrame: { alignSelf: 'center' },
  loading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  loadingText: { ...typography.body, color: colors.muted },
  meta: { ...typography.meta, color: colors.muted },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  nextEpisode: { borderLeftColor: colors.accent },
  nextMeta: { color: colors.accentText },
  pressed: { backgroundColor: colors.panelSoft, opacity: 0.84 },
  separator: { ...typography.meta, color: colors.textSubtle },
  statusButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    minWidth: touchTargets.min,
  },
  statusButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  progressCount: { alignItems: 'flex-end' },
  progressCountMeta: { ...typography.meta, color: colors.muted },
  progressCountStrong: { color: colors.text, fontSize: 14, fontWeight: '900' },
  progressMeta: { ...typography.meta, color: colors.muted, marginTop: 2 },
  progressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  progressTitle: { ...typography.title, color: colors.text },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  ratingText: { color: colors.rating, fontSize: 12, fontWeight: '800' },
  still: { backgroundColor: colors.panelSoft, borderRadius: radii.sm, height: 64, width: 108 },
  stillPlaceholder: { backgroundColor: colors.panelSoft, borderRadius: radii.sm, height: 64, width: 108 },
  title: { ...typography.title, color: colors.text, flex: 1, fontSize: 15, lineHeight: 20 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
