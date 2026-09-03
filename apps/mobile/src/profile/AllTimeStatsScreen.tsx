import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getViewingStats, ViewingStats } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { colors, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { ViewingHighlightCard } from './ViewingHighlightCard';
import { hydrateViewingStatsArtwork } from './hydrateViewingStatsArtwork';

type ExpandedStat = 'rewatches' | 'habits' | 'ratings' | null;
type Props = NativeStackScreenProps<RootStackParamList, 'AllTimeStats'>;

export function AllTimeStatsScreen({ route }: Props) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const statsRevision = useUserDataRevision('episodeProgress', 'opinions', 'viewings');
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [expanded, setExpanded] = useState<ExpandedStat>(null);
  const providedStats = route.params.stats;
  const userId = currentUser?.id ?? 'visitor';
  const load = useCallback(async () => {
    void statsRevision;
    const token = await getFirebaseIdToken();

    if (!token) {
      throw new Error('Your session expired. Sign in again to see your statistics.');
    }

    const stats = await getViewingStats(token);
    return hydrateViewingStatsArtwork(stats, refreshMovie, refreshSeries);
  }, [getFirebaseIdToken, refreshMovie, refreshSeries, statsRevision]);
  const resource = useCachedResource<ViewingStats>({
    enabled: !providedStats && Boolean(currentUser),
    key: getPrivateCacheKey(userId, 'profile:all-time:v2'),
    load,
  });
  const atmosphereUrl = route.params?.profileBackdropUrl ?? null;
  const stats = providedStats ?? resource.data;

  useFocusEffect(useCallback(() => {
    if (!providedStats && currentUser) resource.revalidate();
  }, [currentUser, providedStats, resource.revalidate]));

  return (
    <Screen
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={providedStats ? undefined : (
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={resource.retry}
          refreshing={resource.isRefreshing}
          tintColor={colors.accent}
        />
      )}
      title=""
    >
      {!providedStats && resource.isInitialLoading && !resource.data ? (
        <LoadingState label="Loading all-time stats" />
      ) : !providedStats && resource.error && !resource.data ? (
        <EmptyState body={resource.error} title="Stats unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      ) : stats ? (
        <AllTimeContent expanded={expanded} onToggle={setExpanded} stats={stats} />
      ) : null}
    </Screen>
  );
}

function AllTimeContent({
  expanded,
  onToggle,
  stats,
}: {
  expanded: ExpandedStat;
  onToggle: (value: ExpandedStat) => void;
  stats: ViewingStats;
}) {
  const tasteTotal = Math.max(1, stats.taste.reduce((total, item) => total + item.count, 0));
  const hours = formatAllTimeHours(stats.summary.watchMinutes);

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>TIME WATCHED</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>
          {stats.summary.watchTimeIsEstimated ? '~' : ''}{hours}<Text style={styles.heroUnit}>h</Text>
        </Text>
        <Text style={styles.storyTime}>{formatStoryTime(stats.summary.watchMinutes)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <SummaryStat label="FILMS" value={stats.summary.movieCount} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="SERIES" value={stats.summary.seriesCount} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="EPISODES" value={stats.summary.episodeCount} />
      </View>

      <View style={styles.section}>
        <EditorialSectionTitle>HIGHLIGHTS</EditorialSectionTitle>
        {stats.highlights.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.highlightRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {stats.highlights.map((highlight, index) => (
              <ViewingHighlightCard
                highlight={highlight}
                key={`${highlight.contentType}:${highlight.tmdbId}`}
                label={index === 0 ? 'BIGGEST OBSESSION' : 'HIGHLIGHT'}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyCopy}>Your highlights will appear after your first watch.</Text>
        )}
      </View>

      <View style={styles.section}>
        <EditorialSectionTitle>YOUR TASTE</EditorialSectionTitle>
        {stats.taste.length > 0 ? (
          <View style={styles.tasteList}>
            {stats.taste.map((item) => {
              const percentage = Math.round(item.count / tasteTotal * 100);
              return (
                <View key={item.genre} style={styles.tasteItem}>
                  <Text numberOfLines={1} style={styles.tasteGenre}>{item.genre.toUpperCase()}</Text>
                  <View style={styles.tasteTrack}>
                    <View style={[styles.tasteFill, { width: `${Math.max(8, percentage)}%` }]} />
                  </View>
                  <Text style={styles.tasteCount}>{percentage}%</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyCopy}>Genres will settle here as your history grows.</Text>
        )}
      </View>

      <View style={styles.section}>
        <EditorialSectionTitle>MORE STATS</EditorialSectionTitle>
        <View>
          <MoreStatRow
            expanded={expanded === 'rewatches'}
            label="REWATCHES"
            onPress={() => onToggle(expanded === 'rewatches' ? null : 'rewatches')}
            value={`${stats.more.rewatchCount} extra ${stats.more.rewatchCount === 1 ? 'view' : 'views'}`}
          />
          <MoreStatRow
            expanded={expanded === 'habits'}
            label="WATCHING HABITS"
            onPress={() => onToggle(expanded === 'habits' ? null : 'habits')}
            value={stats.more.favoriteWatchDay ? `Most often on ${stats.more.favoriteWatchDay}` : 'Not enough dated watches yet'}
          />
          <MoreStatRow
            expanded={expanded === 'ratings'}
            last
            label="RATINGS"
            onPress={() => onToggle(expanded === 'ratings' ? null : 'ratings')}
            value={formatRatingStat(stats)}
          />
        </View>
      </View>
    </View>
  );
}

function EditorialSectionTitle({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>;
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MoreStatRow({
  expanded,
  label,
  last = false,
  onPress,
  value,
}: {
  expanded: boolean;
  label: string;
  last?: boolean;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moreRow,
        !last ? styles.moreRowBorder : null,
        pressed ? styles.moreRowPressed : null,
      ]}
    >
      <View style={styles.moreHeading}>
        <Text style={styles.moreLabel}>{label}</Text>
        <ChevronRight color={colors.text} size={23} strokeWidth={2} />
      </View>
      {expanded ? <Text style={styles.moreValue}>{value}</Text> : null}
    </Pressable>
  );
}

function formatAllTimeHours(minutes: number) {
  const hours = minutes / 60;

  if (hours >= 100) {
    return Math.floor(hours).toLocaleString('en-US');
  }

  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatStoryTime(minutes: number) {
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} spent with stories`;
  }

  const days = Math.floor(minutes / 1440);
  return `${days} ${days === 1 ? 'day' : 'days'} spent with stories`;
}

function formatRatingStat(stats: ViewingStats) {
  if (stats.more.ratingCount === 0 || stats.more.averageRating === null) {
    return 'No ratings yet';
  }

  const mostUsed = stats.more.mostUsedRating === null
    ? ''
    : `, most used ${stats.more.mostUsedRating}/5`;

  return `${stats.more.averageRating}/5 average across ${stats.more.ratingCount} ratings${mostUsed}`;
}

const styles = StyleSheet.create({
  emptyCopy: {
    ...typography.body,
    color: colors.textSubtle,
    paddingVertical: spacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  heroUnit: {
    fontSize: 39,
    letterSpacing: -1,
  },
  heroValue: {
    color: '#F2EFEA',
    fontSize: 96,
    fontWeight: '800',
    letterSpacing: -5,
    lineHeight: 108,
    marginTop: spacing.sm,
    maxWidth: '100%',
  },
  highlightRail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  moreHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  moreLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  moreRow: {
    minHeight: touchTargets.min,
  },
  moreRowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreRowPressed: {
    opacity: 0.58,
  },
  moreValue: {
    ...typography.meta,
    color: colors.textMuted,
    paddingBottom: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  stack: {
    gap: spacing.xxxl,
    paddingTop: spacing.xxxl + spacing.md,
  },
  storyTime: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  summaryDivider: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    height: 64,
    width: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  summaryRow: {
    flexDirection: 'row',
    minHeight: 88,
  },
  summaryStat: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  summaryValue: {
    color: '#F2EFEA',
    fontSize: 33,
    fontWeight: '800',
  },
  tasteCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    width: 42,
  },
  tasteFill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: '100%',
  },
  tasteGenre: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    width: 82,
  },
  tasteItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tasteList: {
    gap: spacing.md,
  },
  tasteTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
});
