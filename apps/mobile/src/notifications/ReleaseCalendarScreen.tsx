import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarClock, ChevronRight, Clapperboard, Tv } from 'lucide-react-native';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listReleaseCalendar } from '../api/notifications';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useUserDataRevision } from '../sync/userDataEvents';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseCalendarMonth } from './ReleaseCalendarMonth';
import {
  filterReleaseCalendarItems,
  filterReleaseCalendarItemsByDate,
  getInitialReleaseMonthKey,
  getReleaseMonthItems,
  getReleaseMonthKeys,
  type ReleaseCalendarFilter,
  type ReleaseCalendarItem,
} from './releaseCalendarModel';

type ReleaseCalendarScreenProps = NativeStackScreenProps<RootStackParamList, 'ReleaseCalendar'>;

const filters: Array<{ label: string; value: ReleaseCalendarFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movies' },
  { label: 'Series', value: 'series' },
];

export function ReleaseCalendarScreen({ navigation }: ReleaseCalendarScreenProps) {
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
  } = useAuthSession();
  const releaseAlertRevision = useUserDataRevision('releaseAlerts');
  const ownerId = currentUser?.id ?? null;
  const [filter, setFilter] = useState<ReleaseCalendarFilter>('all');
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const load = useCallback(async () => {
    void releaseAlertRevision;
    const token = await getFirebaseIdToken();

    if (!ownerId || !token) {
      throw new Error('Sign in again to update your release calendar.');
    }

    return (await listReleaseCalendar(token)).items;
  }, [getFirebaseIdToken, ownerId, releaseAlertRevision]);
  const resource = useCachedResource<ReleaseCalendarItem[]>({
    enabled: Boolean(ownerId && firebaseIdToken),
    key: getPrivateCacheKey(ownerId ?? 'visitor', 'release-calendar:v1'),
    load,
  });
  const items = resource.data ?? [];
  const filteredItems = useMemo(
    () => filterReleaseCalendarItems(items, filter),
    [filter, items],
  );
  const monthKeys = useMemo(() => getReleaseMonthKeys(filteredItems), [filteredItems]);

  useEffect(() => {
    if (!monthKey || !monthKeys.includes(monthKey)) {
      setMonthKey(getInitialReleaseMonthKey(filteredItems));
      setSelectedDateKey(null);
    }
  }, [filteredItems, monthKey, monthKeys]);

  const monthItems = monthKey ? getReleaseMonthItems(filteredItems, monthKey) : [];
  const agendaItems = selectedDateKey
    ? filterReleaseCalendarItemsByDate(monthItems, selectedDateKey)
    : monthItems;
  const undatedItems = filteredItems.filter((item) => item.releaseDate === null);

  if (!ownerId || !firebaseIdToken) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0} title="">
        <SignInRequiredCard
          body="You need to be signed in to see upcoming releases tied to your active alerts."
          title="Sign in to view your calendar"
        />
      </Screen>
    );
  }

  if (resource.isInitialLoading && items.length === 0) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0} title="">
        <LoadingState variant="list" label="Loading release calendar" />
      </Screen>
    );
  }

  if (resource.error && items.length === 0) {
    return (
      <Screen contentReady={!resource.isInitialLoading || items.length > 0} title="">
        <EmptyState body={resource.error} title="Your calendar is unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen contentReady={!resource.isInitialLoading || items.length > 0}
      horizontalPadding={spacing.md}
      refreshControl={
        <RefreshControl
          onRefresh={resource.retry}
          refreshing={resource.isRefreshing}
          tintColor={colors.accent}
        />
      }
      statusBanner={resource.error ? <InlineStatusBanner detail={resource.error} tone="error" /> : undefined}
      title=""
    >
      <View style={styles.content}>
        <ScreenReveal delay={50} style={styles.intro}>
          <Text style={styles.introTitle}>Your upcoming releases</Text>
          <Text style={styles.introBody}>Built only from active release alerts. Open a title to manage its alert.</Text>
        </ScreenReveal>
        <SegmentedControl onChange={setFilter} options={filters} value={filter} />
        {filteredItems.length === 0 ? (
          <EmptyState
            body={items.length === 0
              ? 'Turn on the bell for a coming movie or series to add it here.'
              : 'No releases match this filter.'}
            title={items.length === 0 ? 'No active release alerts' : 'No matching releases'}
          >
            {items.length === 0 ? (
              <Button
                label="Explore coming soon"
                onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
              />
            ) : null}
          </EmptyState>
        ) : (
          <>
            {monthKey ? (
              <ScreenReveal delay={100}><ReleaseCalendarMonth
                items={filteredItems}
                monthKey={monthKey}
                onMonthChange={(nextMonthKey) => {
                  setMonthKey(nextMonthKey);
                  setSelectedDateKey(null);
                }}
                onSelectDate={(dateKey) => setSelectedDateKey((current) => current === dateKey ? null : dateKey)}
                selectedDateKey={selectedDateKey}
              /></ScreenReveal>
            ) : null}
            {agendaItems.length > 0 ? (
              <ScreenReveal delay={150}><CalendarSection
                items={agendaItems}
                label={selectedDateKey ? formatLongDate(selectedDateKey) : monthKey ? formatMonth(monthKey) : 'Agenda'}
                onOpen={(item) => openRelease(navigation, item)}
              /></ScreenReveal>
            ) : null}
            {undatedItems.length > 0 && !selectedDateKey ? (
              <ScreenReveal delay={200}><CalendarSection
                items={undatedItems}
                label="Date pending"
                onOpen={(item) => openRelease(navigation, item)}
              /></ScreenReveal>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function CalendarSection({
  items,
  label,
  onOpen,
}: {
  items: ReleaseCalendarItem[];
  label: string;
  onOpen: (item: ReleaseCalendarItem) => void;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>{label}</Text>
      <View style={styles.agenda}>
        {items.map((item, index) => (
          <ReleaseRow
            item={item}
            key={item.id}
            onPress={() => onOpen(item)}
            showDivider={index < items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function ReleaseRow({
  item,
  onPress,
  showDivider,
}: {
  item: ReleaseCalendarItem;
  onPress: () => void;
  showDivider: boolean;
}) {
  const Icon = item.contentType === 'movie' ? Clapperboard : Tv;
  const metadata = getReleaseMetadata(item);

  return (
    <Pressable
      accessibilityHint="Opens the related title, where you can manage its alert."
      accessibilityLabel={`${item.title}. ${metadata}.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.rowDivider : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon color={colors.accentText} size={20} strokeWidth={2} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowMeta}>{metadata}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={18} strokeWidth={2} />
    </Pressable>
  );
}

function openRelease(
  navigation: ReleaseCalendarScreenProps['navigation'],
  item: ReleaseCalendarItem,
) {
  if (item.contentType === 'movie') {
    navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    return;
  }

  navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
}

function getReleaseMetadata(item: ReleaseCalendarItem) {
  const date = item.releaseDate ? formatShortDate(item.releaseDate) : 'Date to be announced';

  if (item.type === 'episode_release') {
    return `S${item.seasonNumber ?? '?'} E${item.episodeNumber ?? '?'} · ${date}`;
  }

  if (item.type === 'season_release') {
    return `Season ${item.seasonNumber ?? '?'} · ${date}`;
  }

  return `Movie · ${date}`;
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatLongDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  });
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  agenda: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.xs,
  },
  introBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  introTitle: {
    ...typography.title,
    color: colors.text,
  },
  pressed: {
    opacity: 0.76,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    paddingVertical: spacing.sm,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderRadius: radii.md,
    height: touchTargets.min,
    justifyContent: 'center',
    width: touchTargets.min,
  },
  rowMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.accentText,
  },
});
