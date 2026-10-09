import { useCallback, useMemo, useState } from 'react';
import { Check } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMediaGenres } from '../catalogue/useMediaGenres';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing, typography } from '../design/tokens';
import { filterWatchlistItems, searchAndSortWatchlistItems, type WatchlistMediaType, type WatchlistSort } from './watchlistFiltersModel';
import { WatchlistSearchField } from './WatchlistSearchField';

type FilterState = { scope: string; mediaType: WatchlistMediaType; genre: string | null; open: boolean; query: string; sort: WatchlistSort };
const sortOptions: { label: string; value: WatchlistSort }[] = [
  { label: 'List order', value: 'original' }, { label: 'Recently added', value: 'newest' },
  { label: 'Oldest added', value: 'oldest' }, { label: 'Title A–Z', value: 'title' },
];
const mediaTypes: Array<{ label: string; value: WatchlistMediaType }> = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'Series', value: 'series' },
];

export function useWatchlistFilters<T extends { contentType: 'movie' | 'series'; tmdbId: number; title?: string | null; createdAt?: string }>(items: readonly T[], scope: string) {
  const initial: FilterState = { scope, mediaType: 'all', genre: null, open: false, query: '', sort: 'original' };
  const [selection, setSelection] = useState(initial);
  const state = selection.scope === scope ? selection : initial;
  const update = useCallback((next: Partial<FilterState>) => setSelection((current) => ({
    ...(current.scope === scope ? current : { scope, mediaType: 'all', genre: null, open: false, query: '', sort: 'original' }),
    ...next,
  })), [scope]);
  const genreItems = useMemo(() => items.filter((item) => state.mediaType === 'all' || item.contentType === state.mediaType), [items, state.mediaType]);
  const genres = useMediaGenres(genreItems, true);
  const selectedGenres = state.genre ? genres.genresByKey : null;
  const visibleItems = useMemo(
    () => searchAndSortWatchlistItems(filterWatchlistItems(items, state.mediaType, state.genre, selectedGenres ?? {}), state.query, state.sort),
    [items, state.mediaType, state.genre, selectedGenres, state.query, state.sort],
  );
  const open = useCallback(() => update({ open: true }), [update]);
  const close = useCallback(() => update({ open: false }), [update]);
  const clear = useCallback(() => update({ mediaType: 'all', genre: null, query: '', sort: 'original' }), [update]);
  return { ...state, active: state.mediaType !== 'all' || state.genre !== null || Boolean(state.query.trim()), isOpen: state.open, open, close, clear, update, genres, visibleItems, total: items.length };
}

type Filters = ReturnType<typeof useWatchlistFilters>;

export function WatchlistFiltersSheet({ filters }: { filters: Filters }) {
  return <BottomActionSheet title="Filters & sort" visible={filters.isOpen} onClose={filters.close}>
    <BottomActionSheetScrollView>
      <Text style={styles.heading}>Sort by</Text>
      {sortOptions.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityState={{ checked: filters.sort === option.value }} style={styles.row}
        onPress={() => filters.update({ sort: option.value })}>
        <Text style={styles.label}>{option.label}</Text>
        {filters.sort === option.value ? <Check size={20} color={colors.accentText} /> : null}
      </Pressable>)}
      <Text style={styles.heading}>Type</Text>
      <SegmentedControl options={mediaTypes} value={filters.mediaType} onChange={(mediaType) => filters.update({ mediaType })} />
      <Text style={styles.heading}>Genre</Text>
      {[null, ...filters.genres.genres].map((genre) => (
        <Pressable key={genre ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: filters.genre === genre }}
          onPress={() => { filters.update({ genre }); filters.close(); }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.label}>{genre ?? 'All genres'}</Text>
          {filters.genre === genre ? <Check size={20} color={colors.accentText} /> : null}
        </Pressable>
      ))}
      {filters.genres.loading ? <ActivityIndicator accessibilityLabel="Loading genres" color={colors.accent} style={styles.loading} /> : null}
      {filters.genres.error ? <InlineStatusBanner tone="error" detail="Some genres could not be loaded." onRetry={filters.genres.retry} /> : null}
      {filters.active || filters.sort !== 'original' ? <Button label="Reset filters & sort" variant="ghost" onPress={filters.clear} /> : null}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

export function WatchlistFilterStatus({ filters }: { filters: Filters }) {
  return <View style={styles.status}>
    <WatchlistSearchField label="Search this watchlist" placeholder="Search this watchlist" value={filters.query}
      onChangeText={query => filters.update({ query })} />
    {filters.active || filters.sort !== 'original' ? <Text style={styles.count}>{filters.visibleItems.length} of {filters.total} titles · {sortOptions.find(option => option.value === filters.sort)?.label}</Text> : null}
    {filters.genre && filters.genres.loading ? <ActivityIndicator accessibilityLabel="Loading matching titles" color={colors.accent} /> : null}
    {filters.genre && filters.genres.error ? <InlineStatusBanner tone="error" detail="Some genres could not be loaded. Results may be incomplete." onRetry={filters.genres.retry} /> : null}
    {filters.active && filters.visibleItems.length === 0 && !(filters.genre && filters.genres.loading) ? (
      <EmptyState title="No matching titles" body="Try another search, type or genre.">
        <Button label="Clear filters" variant="secondary" onPress={filters.clear} />
      </EmptyState>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  label: { ...typography.body, color: colors.text, flex: 1 },
  loading: { padding: spacing.lg },
  status: { gap: spacing.sm },
  count: { ...typography.meta, color: colors.textMuted },
  pressed: { opacity: 0.6 },
});
