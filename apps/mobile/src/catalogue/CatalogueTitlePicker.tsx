import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { searchCatalogue } from '../api/catalogue';
import { Button } from '../components/Button';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { WatchlistDisplayItem } from '../watchlists/WatchlistDetailLayout';
import { WatchlistSearchField } from '../watchlists/WatchlistSearchField';

export const catalogueTitleKey = (item: Pick<WatchlistDisplayItem, 'contentType' | 'tmdbId'>) => `${item.contentType}:${item.tmdbId}`;

export function CatalogueTitlePicker({ items, selected, onChange, limit, excluded = [], disabled = false, label, selectionHint, emptyLabel = 'Search the catalogue to add a title.', appearance = 'default' }: {
  items: WatchlistDisplayItem[]; selected: WatchlistDisplayItem[]; onChange: (items: WatchlistDisplayItem[]) => void;
  limit?: number; excluded?: Pick<WatchlistDisplayItem, 'contentType' | 'tmdbId'>[]; disabled?: boolean;
  label: string; selectionHint?: string; emptyLabel?: string;
  appearance?: 'default' | 'top-five';
}) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [results, setResults] = useState<{ query: string; items: WatchlistDisplayItem[] }>({ query: '', items: [] });
  const [error, setError] = useState<string | null>(null);
  const clean = query.trim();
  const topFive = appearance === 'top-five';
  const searchList = topFive && clean.length > 0;
  useEffect(() => {
    let active = true;
    setError(null);
    if (clean.length < 2) return;
    const timer = setTimeout(() => {
      void searchCatalogue(clean, 'all').then(response => {
        if (active) setResults({ query: clean, items: response.items.map(item => ({
          id: `catalogue:${item.mediaType}:${item.tmdbId}`, contentType: item.mediaType, tmdbId: item.tmdbId,
          posterUrl: item.posterUrl, title: item.title,
        })) });
      }).catch(() => { if (active) setError('Search is unavailable. Try another search.'); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [clean]);
  const searchItems = results.query === clean ? results.items : [];
  const candidates = topFive
    ? (clean ? searchItems : items.slice(0, 25))
    : [...items, ...selected, ...searchItems];
  const unique = new Map<string, WatchlistDisplayItem>();
  candidates.forEach(item => {
    const key = catalogueTitleKey(item);
    if (!unique.has(key) && !excluded.some(row => catalogueTitleKey(row) === key)) unique.set(key, item);
  });
  const catalogueMatches = new Set(searchItems.map(catalogueTitleKey));
  const shown = [...unique.values()].filter(item => catalogueMatches.has(catalogueTitleKey(item)) || (item.title ?? '').toLocaleLowerCase().includes(clean.toLocaleLowerCase()));
  return <View style={styles.content}>
    <WatchlistSearchField label={label} placeholder="Search the full catalogue" accent={topFive} value={query} onChangeText={value => { setQuery(value); setVisibleCount(24); }} />
    <View style={topFive && styles.selectionSummary}>
      <Text style={[styles.caption, topFive && styles.counter]}><Text style={topFive && styles.counterNumber}>{selected.length}{limit === undefined ? '' : `/${limit}`}</Text>{topFive ? '' : ' selected'}{selectionHint ? ` · ${selectionHint}` : ''}</Text>
      {topFive ? selected.map((item, index) => <Pressable key={catalogueTitleKey(item)} accessibilityRole="button"
        accessibilityLabel={`Remove ${item.title ?? 'Title'} from selection`} accessibilityHint={`Number ${index + 1} in your Top 5`}
        accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => onChange(selected.filter(row => catalogueTitleKey(row) !== catalogueTitleKey(item)))}
        style={({ pressed }) => [styles.selectedChoice, (pressed || disabled) && styles.disabled]}>
        <MediaPoster posterUrl={item.posterUrl} style={styles.selectedChoicePoster} />
        <View pointerEvents="none" style={styles.removeChoice}><X size={11} color={colors.textOnAccent} /></View>
      </Pressable>) : null}
    </View>
    {error ? <Text style={styles.caption}>{error}</Text> : null}
    <View style={searchList ? styles.resultsList : [styles.grid, topFive && styles.topFiveGrid]}>{shown.slice(0, topFive ? 25 : visibleCount).map(item => {
      const rank = selected.findIndex(row => catalogueTitleKey(row) === catalogueTitleKey(item));
      const checked = rank !== -1;
      const unavailable = disabled || (!checked && limit !== undefined && selected.length >= limit);
      const indicator = <View style={[styles.check, topFive && styles.topFiveCheck, searchList && styles.listCheck, checked && styles.checked]}>
        {checked ? topFive ? <Text style={styles.rank}>{rank + 1}</Text> : <Check size={15} color={colors.textOnAccent} /> : null}
      </View>;
      return <Pressable key={catalogueTitleKey(item)} accessibilityRole="checkbox" accessibilityLabel={item.title ?? 'Title'}
        accessibilityState={{ checked, disabled: unavailable }} disabled={unavailable}
        onPress={() => onChange(checked ? selected.filter(row => catalogueTitleKey(row) !== catalogueTitleKey(item)) : [...selected, item])}
        style={[styles.card, topFive && styles.topFiveCard, searchList && styles.resultRow, unavailable && !checked && styles.disabled]}>
        <View><MediaPoster posterUrl={item.posterUrl} style={[styles.poster, topFive && styles.topFivePoster, searchList && styles.resultPoster, topFive && checked && styles.selectedPoster]} />
          {!searchList ? indicator : null}
        </View>
        {searchList ? <View style={styles.resultCopy}>
          <Text style={styles.resultTitle} numberOfLines={2}>{item.title ?? 'Title'}</Text>
          <Text style={styles.resultType}>{item.contentType === 'movie' ? 'Movie' : 'TV Show'}</Text>
        </View> : <Text style={[styles.title, topFive && styles.topFiveTitle]} numberOfLines={2}>{item.title ?? 'Title'}</Text>}
        {searchList ? indicator : null}
      </Pressable>;
    })}</View>
    {!topFive && visibleCount < shown.length ? <Button label="Show more titles" variant="secondary" disabled={disabled} onPress={() => setVisibleCount(count => count + 24)} /> : null}
    {!shown.length && Boolean(clean || emptyLabel) && (results.query === clean || clean.length < 2) ? <Text style={styles.caption}>
      {clean ? 'No matching titles.' : emptyLabel}
    </Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  selectionSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  selectedChoice: { width: 52, minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  selectedChoicePoster: { width: 48, height: 72, borderRadius: radii.xs, borderColor: colors.accentBorder },
  removeChoice: { position: 'absolute', right: 1, top: 1, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelElevated, borderWidth: 1, borderColor: colors.borderStrong },
  resultsList: { gap: 0 },
  resultRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 0, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultPoster: { width: 44, height: 66 },
  resultCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  resultTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  resultType: { ...typography.meta, color: colors.textSubtle, fontWeight: '400' },
  listCheck: { position: 'relative', right: 0, top: 0, width: 24, height: 24, borderRadius: 12 },
  content: { gap: spacing.sm }, caption: { ...typography.meta, color: colors.textMuted },
  counter: { alignSelf: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated, paddingHorizontal: spacing.sm, paddingVertical: 3, fontWeight: '400' },
  counterNumber: { color: colors.accent, fontWeight: '800' },
  topFiveGrid: { columnGap: 0, marginHorizontal: -spacing.xs },
  topFiveCard: { width: '20%', paddingHorizontal: spacing.xs, marginBottom: 0, gap: 4 },
  topFivePoster: { width: '100%', height: undefined, aspectRatio: 2 / 3, borderWidth: 1, borderColor: colors.borderStrong },
  selectedPoster: { borderColor: colors.accent },
  topFiveTitle: { fontSize: 10, lineHeight: 13, fontWeight: '500' },
  topFiveCheck: { width: 19, height: 19, borderRadius: 10 },
  rank: { color: colors.textOnAccent, fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, columnGap: 0, marginHorizontal: -spacing.sm / 2 },
  card: { width: '33.333333%', paddingHorizontal: spacing.sm / 2, gap: spacing.xs, marginBottom: spacing.sm },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radii.sm },
  title: { ...typography.meta, color: colors.text, fontSize: 13 }, disabled: { opacity: 0.45 },
  check: { position: 'absolute', right: 3, top: 3, width: 21, height: 21, borderRadius: 11, borderWidth: 1, borderColor: colors.text, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
});
