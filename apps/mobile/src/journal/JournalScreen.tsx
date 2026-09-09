import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, X } from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMovieDetails, getSeriesDetails } from '../api/catalogue';
import { getOwnProfileOpinions } from '../api/profile';
import { listMovieRatings } from '../api/ratings';
import { listJournalViewings } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { applyViewingHistoryUpdates, getViewingHistoryUpdates, reconcileViewingHistoryUpdates, useViewingHistoryUpdates } from '../viewings/viewingHistoryUpdates';
import { ViewingCountControl } from '../viewings/ViewingCountControl';
import type { ViewingTarget } from '../api/viewings';
import { JournalCalendar } from './JournalCalendar';
import { JournalEntryCard } from './JournalEntryCard';
import { buildJournal, filterJournalEntries, filterJournalEntriesByDate, getJournalMonthKeys, groupJournalEntriesByMonth, JournalEntry, JournalFilter } from './journalModel';

export type HydratedJournalEntry = JournalEntry & { posterUrl: string | null; title: string };
type JournalData = { input: Parameters<typeof buildJournal>[0]; averageRating: number | null; entries: HydratedJournalEntry[]; partialError: string | null; reviewCount: number };
type Navigation = NativeStackNavigationProp<RootStackParamList>;
const MAX_JOURNAL_HYDRATIONS = 24;

export function JournalScreen() {
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
  const key = currentUser ? `watchly:user:${currentUser.id}:journal:v4` : 'watchly:user:visitor:journal-disabled';
  const load = useCallback(async (cached?: JournalData): Promise<JournalData> => {
    if (!currentUser) throw new Error('Sign in to open your Journal.');
    const token = await getFirebaseIdToken(); if (!token) throw new Error('Sign in again to open your Journal.');
    const previous = cached;
    const [viewings, ratings, opinions] = await Promise.allSettled([listJournalViewings(token), listMovieRatings(token), getOwnProfileOpinions(token)]);
    const topResults = { viewings, ratings, opinions };
    if (Object.values(topResults).every((result) => result.status === 'rejected')) throw new Error('Could not update your Journal.');
    const failures = Object.entries(topResults).flatMap(([name, result]) => result.status === 'rejected' ? [`${name} (${errorLabel(result.reason)})`] : []);
    if (failures.length && previous) return { ...previous, partialError: `Some Journal data could not update: ${failures.join(', ')}.` };
    const input = {
      movieRatings: ratings.status === 'fulfilled' ? ratings.value : [],
      opinions: opinions.status === 'fulfilled' ? opinions.value.items : [],
      viewings: viewings.status === 'fulfilled' ? viewings.value.items : [],
    };
    const model = buildJournal(input);
    const hydratedTitles = new Map<string, Promise<HydratedJournalEntry>>();
    const entries = await Promise.all(model.entries.map((entry, index) => {
      const fallback = previous?.entries.find((old) => old.kind === entry.kind && old.tmdbId === entry.tmdbId);
      if (fallback?.posterUrl) return { ...fallback, ...entry };
      const titleKey = `${entry.kind}:${entry.tmdbId}`;
      if (!hydratedTitles.has(titleKey)) hydratedTitles.set(titleKey, index < MAX_JOURNAL_HYDRATIONS ? hydrateEntry(entry, fallback) : Promise.resolve(fallback ?? toJournalFallback(entry)));
      return hydratedTitles.get(titleKey)!.then((details) => ({ ...details, ...entry }));
    }));
    return { ...model, input, entries, partialError: failures.length ? `Some Journal data could not update: ${failures.join(', ')}.` : null };
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
  return <Screen refreshControl={currentUser ? <RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} /> : undefined} title="">
    {!currentUser ? <SignInRequiredCard body="You need to be signed in to use your private Journal. Sign in here to see your viewing history and opinions." title="Sign in to use Journal" />
      : resource.isInitialLoading && !resource.data ? <LoadingState label="Loading your Journal" />
      : resource.error && !resource.data ? <EmptyState body={resource.error} title="Journal unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState>
      : resource.data ? <View>
        <View style={styles.intro}><Text style={styles.introText}>Your viewing history, ratings and the stories you kept.</Text><View style={styles.stats}><Stat label={`entries in ${new Date().getFullYear()}`} value={String(yearCount)} /><Stat label="average rating" value={data!.averageRating === null ? '-' : data!.averageRating.toFixed(1)} /><Stat label="reviews" value={String(data!.reviewCount)} /></View></View>
        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>{(['all', 'movies', 'series', 'reviews'] as const).map((value) => <Button key={value} label={value === 'all' ? 'All' : value === 'reviews' ? 'With review' : value[0]!.toUpperCase() + value.slice(1)} onPress={() => { setFilter(value); setSelectedDateKey(null); setCalendarMonthKey(null); setCalendarOpen(false); }} variant={filter === value ? 'secondary' : 'ghost'} />)}</ScrollView>
        <View style={styles.dateControls}>
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
        </View>
        {calendarOpen && visibleMonthKey ? <JournalCalendar entries={filteredEntries} monthKey={visibleMonthKey} onMonthChange={setCalendarMonthKey} onSelectDate={setSelectedDateKey} selectedDateKey={selectedDateKey} /> : null}
        {data!.entries.length === 0 ? <EmptyState body="Watch, rate or review a film or episode and it will appear here." title="Your Journal is ready" />
          : groups.length === 0 ? <EmptyState body={selectedDateKey ? 'Clear the date or choose another marked day.' : 'Choose another filter to see your entries.'} title={selectedDateKey ? `No entries on ${formatSelectedDate(selectedDateKey)}` : 'No matching entries'} />
          : <View style={styles.months}>{groups.map((group) => <View key={group.key}><Text style={styles.month}>{formatMonth(group.key)}</Text>{group.entries.map((entry) => <JournalEntryCard entry={entry as HydratedJournalEntry} key={entry.key} onEdit={() => entry.kind === 'movie' ? setEditing({ contentType: 'movie', tmdbId: entry.tmdbId, title: (entry as HydratedJournalEntry).title }) : setEpisodeChoices(entry as HydratedJournalEntry)} onPress={() => openEntry(navigation, entry as HydratedJournalEntry)} />)}</View>)}</View>}
      </View> : null}
    {editing ? <ViewingCountControl {...(editing.contentType === 'movie' ? editing : { ...editing, seriesTmdbId: editing.tmdbId })} key={`${currentUser?.id}:${editing.tmdbId}:${editing.contentType === 'episode' ? `${editing.seasonNumber}:${editing.episodeNumber}` : 'movie'}`} onEditorClose={() => setEditing(null)} variant="editor" /> : null}
    {episodeChoices ? <BottomActionSheet onClose={() => setEpisodeChoices(null)} title="Edit viewing dates" visible><BottomActionSheetScrollView>{[...new Map(episodeChoices.episodes.map((episode) => [`${episode.seasonNumber}:${episode.episodeNumber}`, episode])).values()].map((episode) => <Button key={`${episode.seasonNumber}:${episode.episodeNumber}`} label={`Season ${episode.seasonNumber}, episode ${episode.episodeNumber}`} onPress={() => { setEditing({ contentType: 'episode', tmdbId: episodeChoices.tmdbId, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber, title: episodeChoices.title }); setEpisodeChoices(null); }} variant="ghost" />)}</BottomActionSheetScrollView></BottomActionSheet> : null}
  </Screen>;
}

function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
async function hydrateEntry(entry: JournalEntry, fallback?: HydratedJournalEntry): Promise<HydratedJournalEntry> { try { const details = entry.kind === 'movie' ? (await getMovieDetails(entry.tmdbId)).item : (await getSeriesDetails(entry.tmdbId)).item; return { ...entry, posterUrl: details.posterUrl, title: details.title }; } catch { return fallback ? { ...fallback, ...entry } : toJournalFallback(entry); } }
function toJournalFallback(entry: JournalEntry): HydratedJournalEntry { return { ...entry, posterUrl: null, title: `${entry.kind === 'movie' ? 'Movie' : 'Series'} TMDB ${entry.tmdbId}` }; }
function openEntry(navigation: Navigation, entry: HydratedJournalEntry) { if (entry.kind === 'movie') navigation.navigate('FilmDetail', { title: entry.title, tmdbId: entry.tmdbId }); else navigation.navigate('SeriesDetail', { title: entry.title, tmdbId: entry.tmdbId }); }
function errorLabel(error: unknown) { return error instanceof Error ? error.message : 'unknown error'; }
function formatSelectedDate(dateKey: string) { return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC', year: 'numeric' }); }
function formatMonth(key: string) { const [year, month] = key.split('-').map(Number); return new Date(year!, month! - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase(); }
const styles = StyleSheet.create({ dateControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }, intro: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.md, paddingBottom: spacing.lg }, introText: { ...typography.body, color: colors.textMuted }, stats: { flexDirection: 'row', gap: spacing.lg }, stat: { flex: 1 }, statValue: { color: colors.text, fontSize: 17, fontWeight: '800' }, statLabel: { color: colors.textSubtle, fontSize: 11, marginTop: 2 }, filters: { gap: spacing.xs, paddingVertical: spacing.md }, months: { gap: spacing.md }, month: { ...typography.eyebrow, color: colors.accentText, marginBottom: spacing.md, marginTop: spacing.sm } });
