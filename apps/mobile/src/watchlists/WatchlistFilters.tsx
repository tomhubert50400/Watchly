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
import { filterWatchlistItems, type WatchlistMediaType } from './watchlistFiltersModel';

type FilterState = { scope: string; mediaType: WatchlistMediaType; genre: string | null; open: boolean; enabled: boolean };
const mediaTypes: Array<{ label: string; value: WatchlistMediaType }> = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'Series', value: 'series' },
];

export function useWatchlistFilters<T extends { contentType: 'movie' | 'series'; tmdbId: number }>(items: readonly T[], scope: string) {
  const initial: FilterState = { scope, mediaType: 'all', genre: null, open: false, enabled: false };
  const [selection, setSelection] = useState(initial);
  const state = selection.scope === scope ? selection : initial;
  const update = useCallback((next: Partial<FilterState>) => setSelection((current) => ({
    ...(current.scope === scope ? current : { scope, mediaType: 'all', genre: null, open: false, enabled: false }),
    ...next,
  })), [scope]);
  const genreItems = useMemo(() => items.filter((item) => state.mediaType === 'all' || item.contentType === state.mediaType), [items, state.mediaType]);
  const genres = useMediaGenres(genreItems, state.enabled);
  const visibleItems = useMemo(
    () => filterWatchlistItems(items, state.mediaType, state.genre, genres.genresByKey),
    [items, state.mediaType, state.genre, genres.genresByKey],
  );
  const open = useCallback(() => update({ open: true, enabled: true }), [update]);
  const close = useCallback(() => update({ open: false }), [update]);
  const clear = useCallback(() => update({ mediaType: 'all', genre: null }), [update]);
  return { ...state, active: state.mediaType !== 'all' || state.genre !== null, isOpen: state.open, open, close, clear, update, genres, visibleItems, total: items.length };
}

type Filters = ReturnType<typeof useWatchlistFilters>;

export function WatchlistFiltersSheet({ filters }: { filters: Filters }) {
  return <BottomActionSheet title="Filters" visible={filters.isOpen} onClose={filters.close}>
    <BottomActionSheetScrollView>
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
      {filters.active ? <Button label="Clear filters" variant="ghost" onPress={filters.clear} /> : null}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

export function WatchlistFilterStatus({ filters }: { filters: Filters }) {
  if (!filters.active) return null;
  return <View style={styles.status}>
    <Text style={styles.count}>{filters.visibleItems.length} of {filters.total} titles</Text>
    {filters.genre && filters.genres.loading ? <ActivityIndicator accessibilityLabel="Loading matching titles" color={colors.accent} /> : null}
    {filters.genre && filters.genres.error ? <InlineStatusBanner tone="error" detail="Some genres could not be loaded. Results may be incomplete." onRetry={filters.genres.retry} /> : null}
    {filters.visibleItems.length === 0 && !(filters.genre && filters.genres.loading) ? (
      <EmptyState title="No matching titles" body="Choose another type or genre to see more titles.">
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
