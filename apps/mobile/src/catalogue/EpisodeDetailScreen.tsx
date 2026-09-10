import { useCallback, useEffect, useLayoutEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { EpisodeDetails, EpisodeDetailsResponse } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { mediaHeroGradientStops } from '../components/mediaHeroGradient';
import { colors, radii, spacing, typography } from '../design/tokens';
import { useSeasonEpisodes } from '../episodes/useSeasonEpisodes';
import { RootStackParamList } from '../navigation/types';
import { EpisodeReviewEditor } from '../reviews/EpisodeReviewEditor';
import { EpisodeProgressControl } from '../tracking/EpisodeProgressControl';
import { ViewingCountControl } from '../viewings/ViewingCountControl';
import { isReleasedDate } from './releaseDates';
import { ensureEpisodeDetails, getEpisodeResourceKey } from './cataloguePrefetch';
import { EpisodeCommunityPanel } from './EpisodeCommunityPanel';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { SynopsisPanel } from './SynopsisPanel';
import { formatDetailDate } from './detailModel';

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
            <LoadingState variant="detail" label="Loading episode details" />
          </View>
        ) : !episode && resource.error ? (
          <EmptyState body={resource.error} title="Episode detail failed">
            <Button label="Retry" onPress={resource.retry} />
          </EmptyState>
        ) : episode ? (
          <EpisodeDetailContent
            episode={episode}
            navigation={navigation}
            seriesTitle={route.params.seriesTitle}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EpisodeDetailContent({
  episode,
  navigation,
  seriesTitle,
}: {
  episode: EpisodeDetails;
  navigation: EpisodeDetailScreenProps['navigation'];
  seriesTitle: string;
}) {
  const seasonModel = useSeasonEpisodes({
    seasonNumber: episode.seasonNumber,
    seriesTmdbId: episode.seriesTmdbId,
  });
  const { width } = useWindowDimensions();
  const heroHeight = Math.min(Math.max(width * 0.78, 300), 340);
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const cast = episode.cast ?? [];
  const crew = episode.crew ?? [];
  const isReleased = isReleasedDate(episode.airDate);
  const episodeCode = `S${episode.seasonNumber} E${episode.episodeNumber}`;
  const rating = isReleased && episode.voteAverage ? (episode.voteAverage / 2).toFixed(1) : null;
  const infoItems = [
    episode.airDate
      ? { icon: 'calendar', label: formatDetailDate(episode.airDate) ?? episode.airDate } satisfies HeaderInfoItem
      : null,
    runtime ? { icon: 'clock', label: runtime } satisfies HeaderInfoItem : null,
    rating ? { icon: 'star', label: rating } satisfies HeaderInfoItem : null,
  ].filter(Boolean) as HeaderInfoItem[];
  const detailItems = [
    `Season ${episode.seasonNumber}`,
    `Episode ${episode.episodeNumber}`,
    runtime,
  ].filter(Boolean);
  const currentIndex = seasonModel.episodes.findIndex(
    (item) => item.episodeNumber === episode.episodeNumber,
  );
  const previousEpisode = currentIndex > 0 ? seasonModel.episodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex >= 0 ? seasonModel.episodes[currentIndex + 1] ?? null : null;

  useEffect(() => {
    for (const adjacent of [previousEpisode, nextEpisode]) {
      if (adjacent) {
        void ensureEpisodeDetails(
          episode.seriesTmdbId,
          adjacent.seasonNumber,
          adjacent.episodeNumber,
        ).catch(() => undefined);
      }
    }
  }, [episode.seriesTmdbId, nextEpisode, previousEpisode]);

  function openEpisode(target: NonNullable<typeof previousEpisode>) {
    navigation.replace('EpisodeDetail', {
      episodeNumber: target.episodeNumber,
      seasonNumber: target.seasonNumber,
      seriesTitle,
      title: target.title,
      tmdbId: episode.seriesTmdbId,
    });
  }

  return (
    <View>
      <ScreenReveal delay={50} style={[styles.hero, { height: heroHeight }]}>
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
        <Svg pointerEvents="none" style={styles.heroFade}>
          <Defs>
            <SvgLinearGradient id="episodeHeroFade" x1="0" x2="0" y1="0" y2="1">
              {mediaHeroGradientStops.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={colors.background}
                  stopOpacity={stop.opacity}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect fill="url(#episodeHeroFade)" height="100%" width="100%" />
        </Svg>
        <View style={styles.heroCopy}>
          <Text numberOfLines={1} style={styles.eyebrow}>{seriesTitle} · {episodeCode}</Text>
          <Text style={styles.title}>{episode.title}</Text>
          <HeaderInfoPills items={infoItems} />
        </View>
      </ScreenReveal>
      <ScreenReveal delay={100} style={styles.bodyStack}>
        {previousEpisode || nextEpisode ? (
          <View style={styles.episodeNavigation}>
            <AdjacentEpisodeButton
              direction="previous"
              episode={previousEpisode}
              onPress={previousEpisode ? () => openEpisode(previousEpisode) : undefined}
            />
            <View style={styles.navigationDivider} />
            <AdjacentEpisodeButton
              direction="next"
              episode={nextEpisode}
              onPress={nextEpisode ? () => openEpisode(nextEpisode) : undefined}
            />
          </View>
        ) : null}

        <SynopsisPanel overview={episode.overview} spoilerProtected variant="card" />
        <View style={styles.personalSection}>
          <Text style={styles.personalEyebrow}>Your activity</Text>
          {isReleased ? (
            <>
              <View style={styles.activityTopRow}>
                <EpisodeProgressControl
                  episodeNumber={episode.episodeNumber}
                  seasonNumber={episode.seasonNumber}
                  seriesTmdbId={episode.seriesTmdbId}
                  variant="activity"
                />
                <View style={styles.activityVerticalDivider} />
                <ViewingCountControl
                  contentType="episode"
                  title={seriesTitle}
                  episodeNumber={episode.episodeNumber}
                  seasonNumber={episode.seasonNumber}
                  seriesTmdbId={episode.seriesTmdbId}
                  variant="activity"
                />
              </View>
              <View style={styles.activityHorizontalDivider} />
            </>
          ) : (
            <View style={styles.futureNotice}>
              <CalendarClock color={colors.textSubtle} size={20} strokeWidth={2.2} />
              <Text style={styles.futureNoticeText}>Tracking will be available after this episode is released.</Text>
            </View>
          )}
          {isReleased ? (
            <EpisodeReviewEditor
              episodeNumber={episode.episodeNumber}
              mediaTitle={episode.title}
              posterUrl={episode.stillUrl}
              seasonNumber={episode.seasonNumber}
              seriesTmdbId={episode.seriesTmdbId}
              variant="activity"
            />
          ) : null}
        </View>

        <EpisodeCommunityPanel
          episodeNumber={episode.episodeNumber}
          seasonNumber={episode.seasonNumber}
          seriesTmdbId={episode.seriesTmdbId}
          spoilerProtected
        />

        <EpisodeCreditRail
          items={cast.map((actor) => ({
            id: actor.id,
            name: actor.name,
            profileUrl: actor.profileUrl,
            subtitle: actor.character,
          }))}
          title="Cast"
          onOpen={(person) => navigation.navigate('ActorDetail', { name: person.name, tmdbId: person.id })}
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
      </ScreenReveal>
    </View>
  );
}

function AdjacentEpisodeButton({
  direction,
  episode,
  onPress,
}: {
  direction: 'next' | 'previous';
  episode: { episodeNumber: number; seasonNumber: number; title: string } | null;
  onPress: (() => void) | undefined;
}) {
  const previous = direction === 'previous';
  const episodeCode = episode ? `S${episode.seasonNumber} EP${episode.episodeNumber}` : null;

  return (
    <Pressable
      accessibilityLabel={episode
        ? `${previous ? 'Previous' : 'Next'} episode, season ${episode.seasonNumber}, episode ${episode.episodeNumber}, ${episode.title}`
        : undefined}
      accessibilityRole={episode ? 'button' : undefined}
      accessibilityState={{ disabled: !episode }}
      disabled={!episode}
      onPress={onPress}
      style={({ pressed }) => [styles.navigationButton, pressed && styles.navigationButtonPressed]}
    >
      {previous ? <ChevronLeft color={episode ? colors.accentText : colors.textSubtle} size={24} /> : null}
      <View style={[styles.navigationCopy, !previous && styles.navigationCopyNext]}>
        <View style={styles.navigationMeta}>
          {!previous && episodeCode ? <Text style={styles.navigationCode}>{episodeCode}</Text> : null}
          <Text style={styles.navigationLabel}>{previous ? 'Previous' : 'Next'}</Text>
          {previous && episodeCode ? <Text style={styles.navigationCode}>{episodeCode}</Text> : null}
        </View>
        <Text numberOfLines={2} style={[styles.navigationTitle, !episode && styles.navigationTitleDisabled]}>
          {episode?.title ?? 'No episode'}
        </Text>
      </View>
      {!previous ? <ChevronRight color={episode ? colors.accentText : colors.textSubtle} size={24} /> : null}
    </Pressable>
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
  onOpen,
  title,
}: {
  items: EpisodeCreditRailItem[];
  onOpen?: (person: EpisodeCreditRailItem) => void;
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
          <Pressable
            accessibilityLabel={person.subtitle
              ? `${person.name}, ${person.subtitle}`
              : person.name}
            accessible
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityHint={onOpen ? "Opens this actor's biography and filmography." : undefined}
            disabled={!onOpen}
            key={person.id}
            onPress={() => onOpen?.(person)}
            style={({ pressed }) => [styles.creditCard, pressed && styles.creditCardPressed]}
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
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function getPersonInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

const styles = StyleSheet.create({
  activityHorizontalDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  activityTopRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    minHeight: 70,
  },
  activityVerticalDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    width: StyleSheet.hairlineWidth,
  },
  creditCard: {
    width: 92,
  },
  creditCardPressed: {
    opacity: 0.76,
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
    paddingHorizontal: spacing.lg,
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
  episodeNavigation: {
    alignItems: 'stretch',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: colors.panelSoft,
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
    bottom: -1,
    height: 220,
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
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  personalSection: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
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
    height: '100%',
    width: '100%',
  },
  futureNotice: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  futureNoticeText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  navigationButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  navigationButtonPressed: {
    backgroundColor: colors.accentSoft,
  },
  navigationCopy: {
    flex: 1,
    minWidth: 0,
  },
  navigationCopyNext: {
    alignItems: 'flex-end',
  },
  navigationDivider: {
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    width: StyleSheet.hairlineWidth,
  },
  navigationCode: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  navigationLabel: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  navigationMeta: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  navigationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  navigationTitleDisabled: {
    color: colors.textSubtle,
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
