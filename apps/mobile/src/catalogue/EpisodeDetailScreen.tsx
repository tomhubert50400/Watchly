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
import { ViewingCountControl } from '../viewings/ViewingCountControl';
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
  const cast = episode.cast ?? [];
  const crew = episode.crew ?? [];
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
          <ViewingCountControl
            contentType="episode"
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

        <EpisodeCreditRail
          items={cast.map((actor) => ({
            id: actor.id,
            name: actor.name,
            profileUrl: actor.profileUrl,
            subtitle: actor.character,
          }))}
          title="Cast"
        />

        <EpisodeCreditRail
          items={crew.map((member) => ({
            id: member.id,
            name: member.name,
            profileUrl: member.profileUrl,
            subtitle: member.jobs.join(' · '),
          }))}
          title="Crew"
        />

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.detailSummary}>{detailItems.join(' · ')}</Text>
        </View>
      </View>
    </View>
  );
}

type EpisodeCreditRailItem = {
  id: number;
  name: string;
  profileUrl: string | null;
  subtitle: string | null;
};

function EpisodeCreditRail({
  items,
  title,
}: {
  items: EpisodeCreditRailItem[];
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.creditSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView
        contentContainerStyle={styles.creditRail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {items.map((person) => (
          <View
            accessibilityLabel={person.subtitle
              ? `${person.name}, ${person.subtitle}`
              : person.name}
            accessible
            key={person.id}
            style={styles.creditCard}
          >
            {person.profileUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessible={false}
                source={{ uri: person.profileUrl }}
                style={styles.creditPortrait}
              />
            ) : (
              <View style={[styles.creditPortrait, styles.creditPlaceholder]}>
                <Text style={styles.creditInitial}>{getPersonInitial(person.name)}</Text>
              </View>
            )}
            <Text numberOfLines={2} style={styles.creditName}>{person.name}</Text>
            {person.subtitle ? (
              <Text numberOfLines={2} style={styles.creditSubtitle}>{person.subtitle}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function getPersonInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

const styles = StyleSheet.create({
  creditCard: {
    width: 92,
  },
  creditInitial: {
    ...typography.title,
    color: colors.accentText,
  },
  creditName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  creditPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    justifyContent: 'center',
  },
  creditPortrait: {
    borderRadius: 14,
    height: 118,
    width: 92,
  },
  creditRail: {
    gap: spacing.md,
  },
  creditSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  creditSubtitle: {
    ...typography.meta,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },
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
