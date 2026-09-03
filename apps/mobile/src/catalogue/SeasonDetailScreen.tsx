import { useCallback, useLayoutEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeasonDetailsResponse, SeriesDetails } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { mediaHeroFadeColors } from '../components/mediaHeroGradient';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, radii, spacing, typography } from '../design/tokens';
import { SeasonEpisodeList } from '../episodes/SeasonEpisodeList';
import { RootStackParamList } from '../navigation/types';
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
import { ensureSeasonDetails, getSeasonResourceKey } from './cataloguePrefetch';
import { useCatalogueCache } from './CatalogueCacheContext';
import { SynopsisPanel } from './SynopsisPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'SeasonDetail'>;

export function SeasonDetailScreen({ navigation, route }: Props) {
  const { seriesTitle, tmdbId } = route.params;
  const { width } = useWindowDimensions();
  const heroHeight = Math.min(Math.max(width * 0.82, 310), 350);
  const [seasonNumber, setSeasonNumber] = useState(route.params.seasonNumber);
  const { getCachedSeries, refreshSeries } = useCatalogueCache();
  const loadSeason = useCallback(
    () => ensureSeasonDetails(tmdbId, seasonNumber),
    [seasonNumber, tmdbId],
  );
  const loadSeries = useCallback(() => refreshSeries(tmdbId), [refreshSeries, tmdbId]);
  const resource = useCachedResource<SeasonDetailsResponse>({
    key: getSeasonResourceKey(tmdbId, seasonNumber),
    load: loadSeason,
  });
  const seriesResource = useCachedResource<SeriesDetails>({
    key: `watchly:public:catalogue:series:${tmdbId}:v3`,
    load: loadSeries,
  });
  const season = resource.data?.item ?? null;
  const series = seriesResource.data ?? getCachedSeries(tmdbId);
  const heroUrl = series?.backdropUrl ?? season?.posterUrl ?? null;
  const seasons = getOrderedSeasons(series);

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
      {heroUrl ? <SpotlightAtmosphere blurRadius={28} imageUrl={heroUrl} /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {!season && resource.isInitialLoading ? (
          <View style={styles.stateFrame}><LoadingState label="Loading season details" /></View>
        ) : !season && resource.error ? (
          <View style={styles.stateFrame}>
            <EmptyState body={resource.error} title="Season detail failed">
              <Button label="Retry" onPress={resource.retry} />
            </EmptyState>
          </View>
        ) : season ? (
          <View>
            <View style={[styles.hero, { height: heroHeight }]}>
              {heroUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${season.title} artwork`}
                  resizeMode="cover"
                  source={{ uri: heroUrl }}
                  style={styles.heroImage}
                />
              ) : <View style={styles.heroPlaceholder} />}
              <View style={styles.heroScrim} />
              <View pointerEvents="none" style={styles.heroFade}>
                {mediaHeroFadeColors.map((backgroundColor) => (
                  <View key={backgroundColor} style={[styles.fadeBand, { backgroundColor }]} />
                ))}
              </View>
              <View style={styles.heroCopy}>
                <Text numberOfLines={1} style={styles.eyebrow}>{seriesTitle}</Text>
                <Text style={styles.title}>{season.title}</Text>
                <Text style={styles.metadata}>
                  {`${season.episodes.length} episodes${season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ''}`}
                </Text>
              </View>
            </View>

            <View style={styles.bodyStack}>
              {seasons.length > 1 ? (
                <View style={styles.seasonSelectorSection}>
                  <ScrollView
                    contentContainerStyle={styles.seasonSelector}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {seasons.map((item) => {
                      const selected = item.seasonNumber === seasonNumber;

                      return (
                        <Pressable
                          accessibilityLabel={`Open ${item.name || `Season ${item.seasonNumber}`}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          key={item.id}
                          onPress={() => setSeasonNumber(item.seasonNumber)}
                          onPressIn={() => {
                            void ensureSeasonDetails(tmdbId, item.seasonNumber).catch(() => undefined);
                          }}
                          style={({ pressed }) => [
                            styles.seasonChip,
                            selected && styles.seasonChipSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.seasonChipLabel, selected && styles.seasonChipLabelSelected]}>
                            {item.seasonNumber === 0 ? 'SP' : `S${item.seasonNumber}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <SeasonEpisodeList
                initialSeason={season}
                seasonNumber={season.seasonNumber}
                seriesTitle={seriesTitle}
                seriesTmdbId={season.seriesTmdbId}
              />

              <SynopsisPanel overview={season.overview} />
              <ComputedRatingSummary
                seasonNumber={season.seasonNumber}
                seriesTmdbId={season.seriesTmdbId}
                title="My computed season rating"
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getOrderedSeasons(series: SeriesDetails | null) {
  if (!series) return [];

  return [...series.seasons]
    .filter((season) => (season.episodeCount ?? 0) > 0)
    .sort((left, right) => {
      if (left.seasonNumber === 0) return 1;
      if (right.seasonNumber === 0) return -1;
      return left.seasonNumber - right.seasonNumber;
    });
}

const styles = StyleSheet.create({
  bodyStack: { paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
  eyebrow: { ...typography.eyebrow, color: colors.accentText, marginBottom: spacing.xs, textTransform: 'uppercase' },
  fadeBand: { flex: 1 },
  hero: { backgroundColor: colors.panelSoft, marginBottom: spacing.sm, overflow: 'hidden' },
  heroCopy: { bottom: spacing.xxl, left: spacing.xl, position: 'absolute', right: spacing.xl },
  heroFade: { bottom: 0, height: 220, left: 0, position: 'absolute', right: 0 },
  heroImage: { height: '100%', width: '100%' },
  heroPlaceholder: { backgroundColor: colors.panelSoft, height: '100%', width: '100%' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9, 12, 19, 0.36)' },
  metadata: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  pressed: { opacity: 0.78 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  seasonChip: { alignItems: 'center', backgroundColor: colors.panelSoft, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 52, minWidth: 64, paddingHorizontal: spacing.md },
  seasonChipLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '800' },
  seasonChipLabelSelected: { color: colors.accentText },
  seasonChipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  seasonSelector: { gap: spacing.sm, paddingRight: spacing.xl },
  seasonSelectorSection: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  stateFrame: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 120 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -0.8, lineHeight: 41 },
});
