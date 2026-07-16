import { useCallback, useLayoutEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EpisodeDetails, EpisodeDetailsResponse } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { mediaHeroFadeColors } from '../components/mediaHeroGradient';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { EpisodeReviewEditor } from '../reviews/EpisodeReviewEditor';
import { EpisodeProgressControl } from '../tracking/EpisodeProgressControl';
import { isReleasedDate } from './releaseDates';
import { ensureEpisodeDetails, getEpisodeResourceKey } from './cataloguePrefetch';
import { EpisodeCommunityPanel } from './EpisodeCommunityPanel';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { SynopsisPanel } from './SynopsisPanel';

type EpisodeDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

export function EpisodeDetailScreen({ navigation, route }: EpisodeDetailScreenProps) {
  const { episodeNumber, seasonNumber, tmdbId } = route.params;
  const loadEpisode = useCallback(() => {
    return ensureEpisodeDetails(tmdbId, seasonNumber, episodeNumber);
  }, [episodeNumber, seasonNumber, tmdbId]);
  const resource = useCachedResource<EpisodeDetailsResponse>({
    key: getEpisodeResourceKey(tmdbId, seasonNumber, episodeNumber),
    load: loadEpisode,
  });
  const episode = resource.data?.item ?? null;

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
        {!episode && resource.isInitialLoading ? (
          <View style={styles.loadingFrame}>
            <LoadingState label="Loading episode details" />
          </View>
        ) : !episode && resource.error ? (
          <EmptyState body={resource.error} title="Episode detail failed">
            <Button label="Retry" onPress={resource.retry} />
          </EmptyState>
        ) : episode ? (
          <EpisodeDetailContent
            episode={episode}
            seriesTitle={route.params.seriesTitle}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EpisodeDetailContent({
  episode,
  seriesTitle,
}: {
  episode: EpisodeDetails;
  seriesTitle: string;
}) {
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const isReleased = isReleasedDate(episode.airDate);
  const episodeCode = `S${episode.seasonNumber} E${episode.episodeNumber}`;
  const rating = isReleased && episode.voteAverage ? (episode.voteAverage / 2).toFixed(1) : null;
  const infoItems = [
    episodeCode,
    episode.airDate,
    runtime,
    rating ? { icon: 'star', label: rating } satisfies HeaderInfoItem : null,
  ].filter(Boolean) as HeaderInfoItem[];
  const detailItems = [
    `Season ${episode.seasonNumber}`,
    `Episode ${episode.episodeNumber}`,
    runtime,
  ].filter(Boolean);

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
        <View pointerEvents="none" style={styles.heroFade}>
          {mediaHeroFadeColors.map((backgroundColor) => (
            <View key={backgroundColor} style={[styles.fadeBand, { backgroundColor }]} />
          ))}
        </View>
        <View style={styles.heroCopy}>
          <Text numberOfLines={1} style={styles.eyebrow}>{seriesTitle} · Episode</Text>
          <Text style={styles.title}>{episode.title}</Text>
          <HeaderInfoPills items={infoItems} />
        </View>
      </View>
      <View style={styles.bodyStack}>
        <SynopsisPanel overview={episode.overview} />
        <View style={styles.personalSection}>
          <Text style={styles.personalEyebrow}>Your activity</Text>
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
        </View>

        <EpisodeCommunityPanel
          episodeNumber={episode.episodeNumber}
          seasonNumber={episode.seasonNumber}
          seriesTmdbId={episode.seriesTmdbId}
        />

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.detailSummary}>{detailItems.join(' · ')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingTop: 0,
  },
  bodyStack: {
    paddingHorizontal: spacing.xl,
  },
  detailsSection: {
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  detailSummary: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  fadeBand: {
    flex: 1,
  },
  hero: {
    backgroundColor: colors.panelSoft,
    height: 340,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  heroCopy: {
    bottom: spacing.xl,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
  },
  heroFade: {
    bottom: 0,
    height: 180,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  loadingFrame: {
    paddingHorizontal: spacing.xl,
    paddingTop: 120,
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
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  still: {
    backgroundColor: colors.panelSoft,
    height: '100%',
    width: '100%',
  },
  stillPlaceholder: {
    backgroundColor: colors.panelSoft,
    height: '100%',
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
});
