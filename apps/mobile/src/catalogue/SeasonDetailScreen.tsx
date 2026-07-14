import { useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeasonDetailsResponse } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { SeasonEpisodeList } from '../episodes/SeasonEpisodeList';
import { RootStackParamList } from '../navigation/types';
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
import { ensureSeasonDetails, getSeasonResourceKey } from './cataloguePrefetch';

type Props = NativeStackScreenProps<RootStackParamList, 'SeasonDetail'>;

export function SeasonDetailScreen({ route }: Props) {
  const { seasonNumber, seriesTitle, tmdbId } = route.params;
  const load = useCallback(() => ensureSeasonDetails(tmdbId, seasonNumber), [seasonNumber, tmdbId]);
  const resource = useCachedResource<SeasonDetailsResponse>({
    key: getSeasonResourceKey(tmdbId, seasonNumber),
    load,
  });
  const season = resource.data?.item ?? null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!season && resource.isInitialLoading ? (
          <LoadingState label="Loading season details" />
        ) : !season && resource.error ? (
          <EmptyState body={resource.error} title="Season detail failed">
            <Button label="Retry" onPress={resource.retry} />
          </EmptyState>
        ) : season ? (
          <View>
            {resource.isRefreshing ? (
              <InlineStatusBanner detail="Refreshing season details" tone="updating" />
            ) : resource.error ? (
              <InlineStatusBanner detail={resource.error} onRetry={resource.retry} title="Season update failed" tone="error" />
            ) : null}
            <View style={styles.header}>
              {season.posterUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${season.title} poster`}
                  source={{ uri: season.posterUrl }}
                  style={styles.poster}
                />
              ) : <View style={styles.posterPlaceholder} />}
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>TMDB season</Text>
                <Text style={styles.title}>{season.title}</Text>
                <Text style={styles.metadata}>
                  {[seriesTitle, `Season ${season.seasonNumber}`, season.airDate, `${season.episodes.length} episodes`].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <ComputedRatingSummary
              seasonNumber={season.seasonNumber}
              seriesTmdbId={season.seriesTmdbId}
              title="My computed season rating"
            />
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Synopsis</Text>
              <Text style={styles.body}>{season.overview || 'No synopsis available yet.'}</Text>
            </View>
            <SeasonEpisodeList
              initialSeason={season}
              seasonNumber={season.seasonNumber}
              seriesTitle={seriesTitle}
              seriesTmdbId={season.seriesTmdbId}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl },
  eyebrow: { ...typography.eyebrow, color: colors.accentText, marginBottom: spacing.xs },
  header: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  headerCopy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  metadata: { ...typography.meta, color: colors.accentText, marginTop: spacing.sm },
  panel: { ...shadows.panel, backgroundColor: colors.panelElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.lg },
  poster: { backgroundColor: colors.panelSoft, borderRadius: radii.md, height: 174, width: 116 },
  posterPlaceholder: { backgroundColor: colors.panelSoft, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 174, width: 116 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  sectionTitle: { ...typography.title, color: colors.text },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34 },
});
