import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronRight, Circle, Play } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SeasonDetails } from '../api/catalogue';
import { ensureEpisodeDetails } from '../catalogue/cataloguePrefetch';
import { isReleasedDate } from '../catalogue/releaseDates';
import { SynopsisPanel } from '../catalogue/SynopsisPanel';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
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
  const releasedEpisodes = model.episodes.filter((episode) => isReleasedDate(episode.airDate));
  const watchedReleasedCount = releasedEpisodes.filter((episode) =>
    isEpisodeWatched(model.watchedState, episode.seasonNumber, episode.episodeNumber),
  ).length;
  const nextEpisode = releasedEpisodes.find((episode) =>
    !isEpisodeWatched(model.watchedState, episode.seasonNumber, episode.episodeNumber),
  ) ?? null;
  const likelyEpisode = nextEpisode ?? releasedEpisodes[0] ?? null;
  const releasedComplete = releasedEpisodes.length > 0 && watchedReleasedCount === releasedEpisodes.length;

  useEffect(() => {
    if (likelyEpisode) {
      void ensureEpisodeDetails(
        seriesTmdbId,
        likelyEpisode.seasonNumber,
        likelyEpisode.episodeNumber,
      ).catch(() => undefined);
    }
  }, [likelyEpisode, seriesTmdbId]);

  if (model.isLoading && !model.season) {
    return (
      <LoadingState label="Loading episodes" variant="episodes" />
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

  function openEpisode(episode: SeasonDetails['episodes'][number]) {
    navigation.navigate('EpisodeDetail', {
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      seriesTitle,
      title: episode.title,
      tmdbId: seriesTmdbId,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>Season progress</Text>
            <Text style={styles.progressMeta}>
              {model.isSignedIn
                ? `${model.progress.completed} of ${model.progress.total} episodes watched`
                : 'Sign in to track your progress'}
            </Text>
          </View>
          <Text style={styles.progressPercent}>{Math.round(model.progress.fraction * 100)}%</Text>
        </View>
        <View
          accessibilityLabel={`${Math.round(model.progress.fraction * 100)} percent watched`}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 100, min: 0, now: Math.round(model.progress.fraction * 100) }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${model.progress.fraction * 100}%` }]} />
        </View>
        {model.isSignedIn && releasedEpisodes.length > 0 && !releasedComplete ? (
          <Button
            fullWidth
            icon={<Check color={colors.text} size={18} strokeWidth={2.4} />}
            label="Mark season watched"
            onPress={() => void model.setSeasonWatched(releasedEpisodes.map((episode) => episode.episodeNumber))}
            variant="secondary"
          />
        ) : null}
      </View>

      {nextEpisode ? (
        <Pressable
          accessibilityLabel={`Open next episode, ${nextEpisode.title}`}
          accessibilityRole="button"
          onPress={() => openEpisode(nextEpisode)}
          onPressIn={() => {
            void ensureEpisodeDetails(
              seriesTmdbId,
              nextEpisode.seasonNumber,
              nextEpisode.episodeNumber,
            ).catch(() => undefined);
          }}
          style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}
        >
          <Text style={styles.nextEyebrow}>Up next</Text>
          <View style={styles.nextContent}>
            {nextEpisode.stillUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${nextEpisode.title} still`}
                source={{ uri: nextEpisode.stillUrl }}
                style={styles.nextStill}
              />
            ) : <View style={styles.nextStillPlaceholder} />}
            <View style={styles.nextCopy}>
              <Text numberOfLines={2} style={styles.nextTitle}>
                S{nextEpisode.seasonNumber} E{nextEpisode.episodeNumber} · {nextEpisode.title}
              </Text>
              <Text style={styles.nextMeta}>{formatEpisodeMeta(nextEpisode)}</Text>
              <View style={styles.openEpisodeAction}>
                <Play color={colors.textOnAccent} fill={colors.textOnAccent} size={14} />
                <Text style={styles.openEpisodeLabel}>Open episode</Text>
              </View>
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Episodes</Text>
        <Text style={styles.listMeta}>First aired</Text>
      </View>

      {model.episodes.length > 0 ? model.episodes.map((episode) => {
        const watched = isEpisodeWatched(
          model.watchedState,
          episode.seasonNumber,
          episode.episodeNumber,
        );
        const isNext = nextEpisode?.episodeNumber === episode.episodeNumber;
        const released = isReleasedDate(episode.airDate);
        return (
          <Pressable
            accessibilityLabel={`Open ${episode.title}${watched ? ', watched' : isNext ? ', next episode' : !released ? ', not released' : ''}`}
            accessibilityRole="button"
            key={episode.id}
            onPress={() => openEpisode(episode)}
            onPressIn={() => {
              void ensureEpisodeDetails(
                seriesTmdbId,
                episode.seasonNumber,
                episode.episodeNumber,
              ).catch(() => undefined);
            }}
            style={({ pressed }) => [styles.episode, isNext && styles.nextEpisode, pressed && styles.pressed]}
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
              {isNext ? <Text style={styles.imageBadge}>Up next</Text> : null}
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={styles.title}>
                {episode.episodeNumber} · {episode.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{released ? formatEpisodeMeta(episode) : 'Not released'}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <ChevronRight color={colors.textSubtle} size={20} />
              {model.isSignedIn && released ? (
                <Pressable
                  accessibilityLabel={watched
                    ? `Mark episode ${episode.episodeNumber} unwatched`
                    : `Mark episode ${episode.episodeNumber} watched`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: watched }}
                  onPress={(event) => {
                    event.stopPropagation();
                    void model.setEpisodeWatched(episode.episodeNumber, !watched);
                  }}
                  style={({ pressed }) => [styles.statusButton, pressed && styles.statusButtonPressed]}
                >
                  {watched ? (
                    <View style={styles.statusButtonActive}>
                      <Check color={colors.background} size={18} strokeWidth={3} />
                    </View>
                  ) : (
                    <Circle color={colors.textSubtle} size={30} strokeWidth={1.8} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        );
      }) : (
        <Text style={styles.empty}>No episode data available yet.</Text>
      )}

      {model.season ? (
        <>
          <SynopsisPanel overview={model.season.overview} />
          <ComputedRatingSummary
            seasonNumber={model.season.seasonNumber}
            seriesTmdbId={model.season.seriesTmdbId}
            title="My computed season rating"
          />
        </>
      ) : null}
    </View>
  );
}

function formatEpisodeMeta(episode: SeasonDetails['episodes'][number]) {
  return [formatShortDate(episode.airDate), episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null]
    .filter(Boolean)
    .join(' · ');
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  container: { gap: 0 },
  copy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  empty: { ...typography.body, color: colors.muted, paddingVertical: spacing.md },
  episode: { backgroundColor: colors.panelElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, minHeight: 98, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  imageBadge: { backgroundColor: colors.accent, borderRadius: radii.xs, color: colors.textOnAccent, fontSize: 10, fontWeight: '900', left: spacing.xs, overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 3, position: 'absolute', textTransform: 'uppercase', top: spacing.xs },
  imageFrame: { alignSelf: 'center', position: 'relative' },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm, paddingTop: spacing.sm },
  listMeta: { ...typography.meta, color: colors.textSubtle },
  listTitle: { ...typography.title, color: colors.text },
  meta: { ...typography.meta, color: colors.muted },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  nextCard: { backgroundColor: colors.panelElevated, borderColor: colors.borderStrong, borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.xl, overflow: 'hidden', padding: spacing.md },
  nextContent: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  nextCopy: { flex: 1, minWidth: 0 },
  nextEpisode: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderRadius: radii.md, borderWidth: 1, marginVertical: spacing.xs, paddingHorizontal: spacing.sm },
  nextEyebrow: { ...typography.eyebrow, alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radii.xs, color: colors.accentText, marginBottom: spacing.sm, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  nextMeta: { ...typography.meta, color: colors.textMuted, marginTop: spacing.xs },
  nextStill: { backgroundColor: colors.panelSoft, borderRadius: radii.md, height: 98, width: 132 },
  nextStillPlaceholder: { backgroundColor: colors.panelSoft, borderRadius: radii.md, height: 98, width: 132 },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  openEpisodeAction: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radii.sm, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, minHeight: touchTargets.min, paddingHorizontal: spacing.md },
  openEpisodeLabel: { color: colors.textOnAccent, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  progressCopy: { flex: 1, minWidth: 0 },
  progressFill: { backgroundColor: colors.accent, borderRadius: 999, bottom: 0, left: 0, position: 'absolute', top: 0 },
  progressHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  progressMeta: { ...typography.meta, color: colors.muted, marginTop: 2 },
  progressPercent: { color: colors.accentText, fontSize: 15, fontWeight: '900' },
  progressSection: { gap: spacing.md, paddingBottom: spacing.xl },
  progressTitle: { ...typography.title, color: colors.text },
  progressTrack: { backgroundColor: colors.panelSoft, borderRadius: 999, height: 8, overflow: 'hidden' },
  statusButton: { alignItems: 'center', justifyContent: 'center', minHeight: touchTargets.min, minWidth: touchTargets.min },
  statusButtonActive: { alignItems: 'center', backgroundColor: colors.success, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  statusButtonPressed: { opacity: 0.72 },
  still: { backgroundColor: colors.panelSoft, borderRadius: radii.sm, height: 74, width: 112 },
  stillPlaceholder: { backgroundColor: colors.panelSoft, borderRadius: radii.sm, height: 74, width: 112 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
});
