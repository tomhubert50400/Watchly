import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppState, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listReleaseCalendar } from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useUserDataRevision } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { filterReleaseCalendarItems, getReleaseDaysRemaining, getReleaseDisplay, getUpcomingReleases, type ReleaseCalendarFilter, type ReleaseCalendarItem } from './releaseCalendarModel';

type Props = Pick<NativeStackScreenProps<RootStackParamList, 'ReleaseCalendar' | 'Notifications'>, 'navigation'>;
const filters: Array<{ label: string; value: ReleaseCalendarFilter }> = [
  { label: 'All', value: 'all' }, { label: 'Movies', value: 'movies' }, { label: 'Series', value: 'series' },
];
const emptyItems: ReleaseCalendarItem[] = [];

export function ReleaseCalendarScreen({ navigation }: Props) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { getCachedMovie, getCachedSeries, refreshMovie, refreshSeries } = useCatalogueCache();
  const releaseRevision = useUserDataRevision('releaseAlerts', 'tracking', 'watchlists', 'episodeProgress');
  const ownerId = currentUser?.id ?? null;
  const [filter, setFilter] = useState<ReleaseCalendarFilter>('all');
  const [now, setNow] = useState(() => new Date());
  const load = useCallback(async () => {
    void releaseRevision;
    const token = await getFirebaseIdToken();
    if (!ownerId || !token) throw new Error('Sign in again to update your upcoming releases.');
    return (await listReleaseCalendar(token)).items;
  }, [getFirebaseIdToken, ownerId, releaseRevision]);
  const resource = useCachedResource<ReleaseCalendarItem[]>({
    enabled: Boolean(ownerId && firebaseIdToken),
    key: getPrivateCacheKey(ownerId ?? 'visitor', 'release-calendar:v2'),
    load,
  });
  const items = resource.data ?? emptyItems;
  const upcomingItems = useMemo(() => getUpcomingReleases(items, now), [items, now]);
  const filteredItems = useMemo(() => filterReleaseCalendarItems(upcomingItems, filter), [upcomingItems, filter]);

  useEffect(() => {
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setNow(new Date()), Math.max(1, nextDay.getTime() - Date.now()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [now]);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    const titles = [...new Map(items.map((item) => [`${item.contentType}:${item.tmdbId}`, item])).values()];
    void (async () => {
      for (let offset = 0; active && offset < titles.length; offset += 3) {
        await Promise.allSettled(titles.slice(offset, offset + 3).map((item) =>
          item.contentType === 'movie' ? refreshMovie(item.tmdbId) : refreshSeries(item.tmdbId),
        ));
      }
    })();
    return () => { active = false; };
  }, [items, ownerId, refreshMovie, refreshSeries]);

  if (!ownerId || !firebaseIdToken) {
    return <Screen title=""><SignInRequiredCard body="Sign in to see upcoming releases from your watchlist and the series you follow." title="Sign in to view upcoming releases" /></Screen>;
  }
  if (resource.isInitialLoading && items.length === 0) {
    return <Screen title=""><LoadingState variant="list" label="Loading upcoming releases" /></Screen>;
  }
  if (resource.error && items.length === 0) {
    return <Screen title=""><EmptyState body={resource.error} title="Upcoming releases are unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState></Screen>;
  }

  return (
    <Screen
      horizontalPadding={spacing.md}
      refreshControl={<RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} />}
      statusBanner={resource.error ? <InlineStatusBanner detail={resource.error} tone="error" /> : undefined}
      title=""
    >
      <View style={styles.content}>
        <SegmentedControl onChange={setFilter} options={filters} value={filter} />
        {filteredItems.length === 0 ? (
          <EmptyState
            body={upcomingItems.length === 0
              ? 'Add a movie to your watchlist or follow a series. Its upcoming releases will appear here, no alerts needed.'
              : 'No releases match this filter.'}
            title={upcomingItems.length === 0 ? 'No upcoming releases yet' : 'No matching releases'}
          >
            {upcomingItems.length === 0 ? <Button label="Explore coming soon" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} /> : null}
          </EmptyState>
        ) : (
          <ScreenReveal style={styles.list}>
            {filteredItems.map((item) => {
              const display = getReleaseDisplay(item);
              const content = item.contentType === 'movie' ? getCachedMovie(item.tmdbId) : getCachedSeries(item.tmdbId);
              const days = getReleaseDaysRemaining(item, now);
              const countdown = days === null ? 'Date pending' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
              const title = content?.title ?? display.title;
              return (
                <Pressable
                  accessibilityLabel={`${title}. ${display.detail}. ${display.episodeName ?? ''}. ${countdown}.`}
                  accessibilityHint="Opens the release details."
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => {
                    if (item.type === 'episode_release' && item.seasonNumber !== null && item.episodeNumber !== null) {
                      navigation.navigate('EpisodeDetail', {
                        tmdbId: item.tmdbId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
                        seriesTitle: title, title: display.episodeName ?? display.detail,
                      });
                    } else if (item.contentType === 'movie') {
                      navigation.navigate('FilmDetail', { title, tmdbId: item.tmdbId });
                    } else {
                      navigation.navigate('SeriesDetail', { title, tmdbId: item.tmdbId });
                    }
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <MediaPoster posterUrl={content?.posterUrl ?? null} style={styles.poster} />
                  <View style={styles.copy}>
                    <Text numberOfLines={2} style={styles.title}>{title}</Text>
                    <Text style={styles.detail}>{display.detail}</Text>
                    {display.episodeName ? <Text numberOfLines={2} style={styles.episode}>{display.episodeName}</Text> : null}
                  </View>
                  <View style={styles.countdown}>
                    {days !== null && days > 1 ? (
                      <><Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.days}>{days}</Text><Text style={styles.daysLabel}>days</Text></>
                    ) : <Text style={[styles.relativeDay, days === null && styles.pending]}>{countdown}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScreenReveal>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  list: { gap: spacing.md },
  row: {
    alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border,
    borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm,
  },
  poster: { width: 56, height: 84, flexShrink: 0, borderRadius: radii.sm },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  detail: { ...typography.meta, color: colors.textMuted },
  episode: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  countdown: { alignItems: 'center', justifyContent: 'center', width: 78, flexShrink: 0 },
  days: { color: colors.accentText, fontSize: 34, lineHeight: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  daysLabel: { color: colors.textMuted, fontSize: 12 },
  relativeDay: { color: colors.accentText, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  pending: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  pressed: { opacity: 0.76 },
});
