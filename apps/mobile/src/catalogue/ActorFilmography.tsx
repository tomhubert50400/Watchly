import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogueSearchItem, CatalogueSearchType } from '../api/catalogue';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { ScreenReveal } from '../components/ScreenReveal';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { ExploreMediaCard } from './ExploreMediaCard';
import { filterActorFilmography, filmographySortOptions, type FilmographySort } from './actorFilmographyModel';

const mediaTypes: { label: string; value: CatalogueSearchType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'TV Shows', value: 'series' },
];

export function ActorFilmography({ credits }: { credits: readonly CatalogueSearchItem[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mediaType, setMediaType] = useState<CatalogueSearchType>('all');
  const [sort, setSort] = useState<FilmographySort>('popular');
  const [showSort, setShowSort] = useState(false);
  const items = useMemo(() => filterActorFilmography(credits, mediaType, sort), [credits, mediaType, sort]);
  const sortLabel = filmographySortOptions.find(option => option.value === sort)!.label;

  return <View style={styles.content}>
    <ScreenReveal delay={150} style={styles.header}>
      <Text accessibilityRole="header" style={styles.heading}>Filmography</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort filmography: ${sortLabel}`} onPress={() => setShowSort(true)} style={({ pressed }) => [styles.filter, pressed && styles.pressed]}>
        <SlidersHorizontal size={20} color={sort === 'popular' ? colors.textMuted : colors.accentText} />
      </Pressable>
    </ScreenReveal>
    <SegmentedControl options={mediaTypes} value={mediaType} onChange={setMediaType} />
    <Text style={styles.meta}>{sortLabel}</Text>
    {items.length ? <ScreenReveal delay={200} style={styles.grid}>
      {items.map(item => <ExploreMediaCard key={item.id} item={item} layout="grid" onPress={() => navigation.push(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })} />)}
    </ScreenReveal> : <Text style={styles.body}>{mediaType === 'movie' ? 'No movie credits available.' : mediaType === 'series' ? 'No TV credits available.' : 'No film or TV credits available.'}</Text>}
    <BottomActionSheet visible={showSort} title="Sort filmography" onClose={() => setShowSort(false)}>
      <BottomActionSheetScrollView>
        {filmographySortOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: sort === option.value }} onPress={() => { setSort(option.value); setShowSort(false); }} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <Text style={[styles.body, sort === option.value && styles.selected]}>{option.label}</Text>
          {sort === option.value ? <Check size={20} color={colors.accentText} /> : null}
        </Pressable>)}
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { ...typography.title, color: colors.text, flexShrink: 1 },
  filter: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meta: { ...typography.meta, color: colors.textMuted },
  body: { ...typography.body, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  selected: { color: colors.accentText },
  pressed: { opacity: 0.7 },
});
