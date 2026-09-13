import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { getProfileHistory } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { JournalTimeline } from './JournalTimeline';
import { spacing } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { JournalCalendar } from './JournalCalendar';
import { buildJournal, filterJournalEntries, filterJournalEntriesByDate, getJournalMonthKeys, groupJournalEntriesByMonth, type JournalFilter } from './journalModel';
import type { HydratedJournalEntry } from './JournalScreen';

export function PublicViewingHistoryScreen({ userId }: { userId: string }) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [entries, setEntries] = useState<HydratedJournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState('');
  const [date, setDate] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setEntries(null);
    setError(null);
    void (async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in to view this history.');
        const history = await getProfileHistory(token, userId);
        const model = buildJournal({ movieRatings: [], opinions: history.opinions, viewings: history.items });
        const hydrated = model.entries.filter((entry) => entry.kind === 'series' || entry.key.startsWith('viewing:')).map((entry) => {
          const event = history.items.find((item) => item.tmdbId === entry.tmdbId && (item.contentType === 'movie') === (entry.kind === 'movie'));
          return { ...entry, title: event?.title ?? (entry.kind === 'movie' ? 'Movie' : 'Series'), posterUrl: event?.posterUrl ?? null };
        });
        if (active) setEntries(hydrated);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'History unavailable.');
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, getFirebaseIdToken, userId, attempt]));
  const filtered = filterJournalEntries(entries ?? [], filter);
  const months = getJournalMonthKeys(filtered);
  const visibleMonth = months.includes(month) ? month : months[0];
  const groups = groupJournalEntriesByMonth(filterJournalEntriesByDate(filtered, date));
  return <JournalTimeline groups={groups} onOpen={(entry) => navigation.navigate(entry.kind === 'movie' ? 'FilmDetail' : 'SeriesDetail', { tmdbId: entry.tmdbId, title: entry.title })}>
    {error ? <EmptyState title="History unavailable" body={error}><Button label="Retry" onPress={() => setAttempt((value) => value + 1)} /></EmptyState>
      : !entries ? <LoadingState label="Loading viewing history" />
      : <View style={styles.stack}>
        <View style={styles.filters}>{(['all', 'movies', 'series'] as const).map((value) => <Button compact key={value} label={value === 'all' ? 'All' : value === 'movies' ? 'Movies' : 'Series'} variant={value === filter ? 'secondary' : 'ghost'} onPress={() => { setFilter(value); setDate(null); }} />)}<Button compact label="Calendar" variant="ghost" onPress={() => setCalendarOpen((value) => !value)} /></View>
        {calendarOpen && visibleMonth ? <JournalCalendar entries={filtered} monthKey={visibleMonth} onMonthChange={setMonth} onSelectDate={setDate} selectedDateKey={date} /> : null}
        {date ? <Button compact label="Clear date" variant="ghost" onPress={() => setDate(null)} /> : null}
        {groups.length ? null : <EmptyState title="No viewings to show" body="Viewings will appear here when this member logs them." />}
      </View>}
  </JournalTimeline>;
}

const styles = StyleSheet.create({ stack: { gap: spacing.md }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } });
