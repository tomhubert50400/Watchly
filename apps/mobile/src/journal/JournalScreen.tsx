import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, X } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOwnProfileOpinions, getProfileHistory } from '../api/profile';
import { listMovieRatings } from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { JournalTimeline } from './JournalTimeline';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { applyViewingHistoryUpdates, getViewingHistoryUpdates, reconcileViewingHistoryUpdates, useViewingHistoryUpdates } from '../viewings/viewingHistoryUpdates';
import { ViewingCountControl } from '../viewings/ViewingCountControl';
import type { ViewingTarget } from '../api/viewings';
import { PublicViewingHistoryScreen } from './PublicViewingHistoryScreen';
import { JournalCalendar } from './JournalCalendar';
import { buildJournal, filterJournalEntries, filterJournalEntriesByDate, getJournalMonthKeys, groupJournalEntriesByMonth, JournalEntry, JournalFilter } from './journalModel';

export type HydratedJournalEntry = JournalEntry & { posterUrl: string | null; title: string };
type JournalData = { input: Parameters<typeof buildJournal>[0]; averageRating: number | null; entries: HydratedJournalEntry[]; partialError: string | null; reviewCount: number };
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function JournalScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Journal'>>();
  return route.params?.userId ? <PublicViewingHistoryScreen userId={route.params.userId} /> : <OwnViewingHistoryScreen />;
}

function OwnViewingHistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const journalRevision = useUserDataRevision('episodeProgress', 'opinions', 'viewings');
  const historyUpdateRevision = useViewingHistoryUpdates();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonthKey, setCalendarMonthKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<(ViewingTarget & { title: string }) | null>(null);
  const [episodeChoices, setEpisodeChoices] = useState<HydratedJournalEntry | null>(null);
  const key = currentUser ? `watchly:user:${currentUser.id}:journal:v5` : 'watchly:user:visitor:journal-disabled';
  const load = useCallback(async (cached?: JournalData): Promise<JournalData> => {
    if (!currentUser) throw new Error('Sign in to open your viewing history.');
    const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to open your viewing history.');
    const previous = cached;
    const [viewings, ratings, opinions] = await Promise.allSettled([getProfileHistory(token, currentUser.id), listMovieRatings(token), getOwnProfileOpinions(token)]);
    const topResults = { viewings, ratings, opinions };
    if (Object.values(topResults).every((result) => result.status === 'rejected')) throw new Error('Could not update your viewing history.');
    const failures = Object.entries(topResults).flatMap(([name, result]) => result.status === 'rejected' ? [`${name} (${errorLabel(result.reason)})`] : []);
    if (failures.length && previous) return { ...previous, partialError: `Some history data could not update: ${failures.join(', ')}.` };
    const input = {
      movieRatings: ratings.status === 'fulfilled' ? ratings.value : [],
      opinions: opinions.status === 'fulfilled' ? opinions.value.items : [],
      viewings: viewings.status === 'fulfilled' ? viewings.value.items : [],
    };
    const model = buildJournal(input);
    const metadata = new Map(viewings.status === 'fulfilled' ? viewings.value.items.map((item) => [`${item.contentType === 'movie' ? 'movie' : 'series'}:${item.tmdbId}`, item]) : []);
    const previousTitles = new Map(previous?.entries.map((entry) => [`${entry.kind}:${entry.tmdbId}`, entry]));
    const entries = model.entries.map((entry) => {
      const key = `${entry.kind}:${entry.tmdbId}`;
      const saved = metadata.get(key);
      const fallback = previousTitles.get(key);
      return { ...entry, title: saved?.title ?? fallback?.title ?? toJournalFallback(entry).title, posterUrl: saved?.posterUrl ?? fallback?.posterUrl ?? null };
    });
    return { ...model, input, entries, partialError: failures.length ? `Some history data could not update: ${failures.join(', ')}.` : null };
  }, [currentUser, getFirebaseIdToken, journalRevision, key]);
  const resource = useCachedResource({ enabled: Boolean(currentUser), key, load });
  useEffect(() => {
    if (currentUser && resource.data) reconcileViewingHistoryUpdates(currentUser.id, resource.data.input.viewings);
  }, [currentUser, resource.data]);
  const data = useMemo(() => {
    if (!resource.data || !currentUser) return resource.data;
    const updates = getViewingHistoryUpdates(currentUser.id);
    if (!updates.length) return resource.data;
    const model = buildJournal({ ...resource.data.input, viewings: applyViewingHistoryUpdates(resource.data.input.viewings, updates) });
    return { ...resource.data, ...model, entries: model.entries.map((entry) => {
      const previous = resource.data!.entries.find((item) => item.kind === entry.kind && item.tmdbId === entry.tmdbId);
      const title = updates.find((item) => item.target.tmdbId === entry.tmdbId && (item.target.contentType === 'movie') === (entry.kind === 'movie'))?.title;
      return { ...(previous ?? toJournalFallback(entry)), ...entry, ...(previous ? {} : title ? { title } : {}) };
    }) };
  }, [resource.data, currentUser, historyUpdateRevision]);
  const filteredEntries = filterJournalEntries(data?.entries ?? [], filter);
  const monthKeys = getJournalMonthKeys(filteredEntries);
  const visibleMonthKey = calendarMonthKey && monthKeys.includes(calendarMonthKey) ? calendarMonthKey : monthKeys[0] ?? '';
  const entries = filterJournalEntriesByDate(filteredEntries, selectedDateKey);
  const groups = groupJournalEntriesByMonth(entries);
  const yearCount = (data?.entries ?? []).filter((entry) => entry.date.slice(0, 4) === String(new Date().getFullYear())).length;
  return <JournalTimeline groups={currentUser && resource.data ? groups : []} onOpen={(entry) => openEntry(navigation, entry)} onEdit={(entry) => entry.kind === 'movie' ? setEditing({ contentType: 'movie', tmdbId: entry.tmdbId, title: entry.title }) : setEpisodeChoices(entry)} onRefresh={currentUser ? resource.retry : undefined} refreshing={resource.isRefreshing} overlays={<>
    {editing ? <ViewingCountControl {...(editing.contentType === 'movie' ? editing : { ...editing, seriesTmdbId: editing.tmdbId })} key={`${currentUser?.id}:${editing.tmdbId}:${editing.contentType === 'episode' ? `${editing.seasonNumber}:${editing.episodeNumber}` : 'movie'}`} onEditorClose={() => setEditing(null)} variant="editor" /> : null}
    {episodeChoices ? <BottomActionSheet onClose={() => setEpisodeChoices(null)} title="Edit viewing dates" visible><BottomActionSheetScrollView>{[...new Map(episodeChoices.episodes.map((episode) => [`${episode.seasonNumber}:${episode.episodeNumber}`, episode])).values()].map((episode) => <Button key={`${episode.seasonNumber}:${episode.episodeNumber}`} label={`Season ${episode.seasonNumber}, episode ${episode.episodeNumber}`} onPress={() => { setEditing({ contentType: 'episode', tmdbId: episodeChoices.tmdbId, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber, title: episodeChoices.title }); setEpisodeChoices(null); }} variant="ghost" />)}</BottomActionSheetScrollView></BottomActionSheet> : null}
  </>}>
    {!currentUser ? <SignInRequiredCard body="You need to be signed in to use your viewing history. Sign in here to see your viewing history and opinions." title="Sign in to view your history" />
      : resource.isInitialLoading && !resource.data ? <LoadingState label="Loading your viewing history" />
      : resource.error && !resource.data ? <EmptyState body={resource.error} title="History unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : resource.data ? <View>
        <ScreenReveal delay={50} style={styles.intro}><Text style={styles.introText}>Your viewing history, ratings and the stories you kept.</Text><View style={styles.stats}><Stat label={`entries in ${new Date().getFullYear()}`} value={String(yearCount)} /><Stat label="average rating" value={data!.averageRating === null ? '-' : data!.averageRating.toFixed(1)} /><Stat label="reviews" value={String(data!.reviewCount)} /></View></ScreenReveal>
        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>{(['all', 'movies', 'series', 'reviews'] as const).map((value) => <Button key={value} label={value === 'all' ? 'All' : value === 'reviews' ? 'With review' : value[0]!.toUpperCase() + value.slice(1)} onPress={() => { setFilter(value); setSelectedDateKey(null); setCalendarMonthKey(null); setCalendarOpen(false); }} variant={filter === value ? 'secondary' : 'ghost'} />)}</ScrollView>
        <ScreenReveal delay={100} style={styles.dateControls}>
          <Button
            compact
            disabled={!filteredEntries.length}
            icon={<CalendarDays color={calendarOpen || selectedDateKey ? colors.accentText : colors.textMuted} size={18} />}
            label={selectedDateKey ? formatSelectedDate(selectedDateKey) : 'Calendar'}
            onPress={() => {
              if (!calendarOpen) setCalendarMonthKey(selectedDateKey?.slice(0, 7) ?? monthKeys[0] ?? null);
              setCalendarOpen((open) => !open);
            }}
            variant={calendarOpen || selectedDateKey ? 'secondary' : 'ghost'}
          />
          {selectedDateKey ? <Button compact icon={<X color={colors.textMuted} size={17} />} label="Clear date" onPress={() => setSelectedDateKey(null)} variant="ghost" /> : null}
        </ScreenReveal>
        {calendarOpen && visibleMonthKey ? <JournalCalendar entries={filteredEntries} monthKey={visibleMonthKey} onMonthChange={setCalendarMonthKey} onSelectDate={setSelectedDateKey} selectedDateKey={selectedDateKey} /> : null}
        {data!.entries.length === 0 ? <EmptyState body="Watch, rate or review a film or episode and it will appear here." title="Your viewing history is ready" />
          : groups.length === 0 ? <EmptyState body={selectedDateKey ? 'Clear the date or choose another marked day.' : 'Choose another filter to see your entries.'} title={selectedDateKey ? `No entries on ${formatSelectedDate(selectedDateKey)}` : 'No matching entries'} />
          : null}
      </View> : null}

  </JournalTimeline>;
}

function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function toJournalFallback(entry: JournalEntry): HydratedJournalEntry { return { ...entry, posterUrl: null, title: `${entry.kind === 'movie' ? 'Movie' : 'Series'} TMDB ${entry.tmdbId}` }; }
function openEntry(navigation: Navigation, entry: HydratedJournalEntry) { if (entry.kind === 'movie') navigation.navigate('FilmDetail', { title: entry.title, tmdbId: entry.tmdbId }); else navigation.navigate('SeriesDetail', { title: entry.title, tmdbId: entry.tmdbId }); }
function errorLabel(error: unknown) { return error instanceof Error ? error.message : 'unknown error'; }
function formatSelectedDate(dateKey: string) { return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC', year: 'numeric' }); }
const styles = StyleSheet.create({ dateControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }, intro: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.md, paddingBottom: spacing.lg }, introText: { ...typography.body, color: colors.textMuted }, stats: { flexDirection: 'row', gap: spacing.lg }, stat: { flex: 1 }, statValue: { color: colors.text, fontSize: 17, fontWeight: '800' }, statLabel: { color: colors.textSubtle, fontSize: 11, marginTop: 2 }, filters: { gap: spacing.xs, paddingVertical: spacing.md } });
