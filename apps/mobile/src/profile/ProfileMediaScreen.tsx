import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronDown } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { useLibraryData } from '../library/useLibraryData';
import type { RootStackParamList } from '../navigation/types';
import { ProfileMediaPoster } from './ProfileMediaRail';
import { getProfileMediaItems, groupProfileMediaByStatus } from './profileMediaModel';
import { useProfileMediaGenres } from './useProfileMediaGenres';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ProfileMedia'>;

export function ProfileMediaScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = (width - spacing.xl * 2 - spacing.sm * 2) / 3;
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreSheetOpen, setGenreSheetOpen] = useState(false);
  const [genresEnabled, setGenresEnabled] = useState(false);
  const providedItems = route.params.items;
  const usesProvidedItems = providedItems !== undefined;
  const resource = useLibraryData(!usesProvidedItems);
  const loadedItems = providedItems ?? resource.data?.items ?? route.params.initialItems;
  const sourceItems = useMemo(
    () => getProfileMediaItems(loadedItems ?? [], route.params.filter),
    [loadedItems, route.params.filter],
  );
  const groups = useMemo(() => groupProfileMediaByStatus(sourceItems), [sourceItems]);
  const genreResource = useProfileMediaGenres(sourceItems, genresEnabled);
  const sections = route.params.filter === 'planned' ? [
    { value: 'movies', label: 'Movies', items: sourceItems.filter((item) => item.contentType === 'movie'), emptyLabel: 'No planned movies yet.' },
    { value: 'series', label: 'Series', items: sourceItems.filter((item) => item.contentType === 'series'), emptyLabel: 'No planned series yet.' },
  ] : [
    ...(route.params.filter !== 'movies' ? [{ value: 'inProgress', label: 'In progress', items: groups.inProgress, emptyLabel: 'Nothing in progress right now.' }] : []),
    { value: 'planned', label: 'Planned', items: groups.planned, emptyLabel: 'No planned titles yet.' },
    { value: 'completed', label: 'Completed', items: groups.completed, emptyLabel: 'No completed titles yet.' },
  ];
  const activeSection = sections.find((section) => section.value === selectedSection) ?? sections[0];
  const visibleItems = selectedGenre
    ? activeSection.items.filter((item) => genreResource.genresByKey[item.key]?.includes(selectedGenre))
    : activeSection.items;
  const atmosphereUrl = route.params.profileBackdropUrl
    ?? sourceItems[0]?.backdropUrl
    ?? sourceItems[0]?.posterUrl
    ?? null;

  const openItem = useCallback((item: LibraryMediaItem) => {
    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    } else {
      navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
    }
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Filter by genre: ${selectedGenre ?? 'All genres'}`}
          onPress={() => { setGenresEnabled(true); setGenreSheetOpen(true); }}
          style={({ pressed }) => [styles.genreButton, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={[styles.genreButtonText, selectedGenre && styles.selectedGenre]}>{selectedGenre ?? 'Genre'}</Text>
          <ChevronDown size={16} color={selectedGenre ? colors.accentText : colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, selectedGenre]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {atmosphereUrl ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><SpotlightAtmosphere imageUrl={atmosphereUrl} /></View> : null}
      <ScreenReveal style={styles.content}>
        {!loadedItems && resource.isInitialLoading ? (
          <LoadingState variant="grid" label="Loading your titles" />
        ) : !loadedItems && resource.error ? (
          <EmptyState body={resource.error} title="Titles unavailable">
            <Button label="Retry" onPress={resource.retry} />
          </EmptyState>
        ) : (
          <>
            <SegmentedControl options={sections} value={activeSection.value} onChange={setSelectedSection} containerStyle={styles.selector} />
            <FlatList
              key={`${route.params.filter}:${activeSection.value}:${selectedGenre ?? 'all'}`}
              data={visibleItems}
              numColumns={3}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => <ProfileMediaPoster item={item} onOpen={openItem} width={cardWidth} />}
              columnWrapperStyle={styles.row}
              contentContainerStyle={[styles.grid, { paddingBottom: spacing.xxxl + insets.bottom }]}
              initialNumToRender={18}
              maxToRenderPerBatch={12}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={selectedGenre && genreResource.loading ? <ActivityIndicator accessibilityLabel="Loading genres" color={colors.accent} /> : selectedGenre && genreResource.error ? <InlineStatusBanner tone="error" detail="Some genres could not be loaded. Results may be incomplete." onRetry={genreResource.retry} /> : null}
              ListEmptyComponent={selectedGenre && genreResource.loading ? null : <EmptyState title={selectedGenre ? 'No titles in this genre' : activeSection.emptyLabel} body="Choose another section or genre to see more titles." />}
              refreshControl={usesProvidedItems ? undefined : (
                <RefreshControl colors={[colors.accent]} onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} />
              )}
            />
          </>
        )}
      </ScreenReveal>
      <BottomActionSheet title="Genre" visible={genreSheetOpen} onClose={() => setGenreSheetOpen(false)}>
        <BottomActionSheetScrollView>
          {[null, ...genreResource.genres].map((genre) => (
            <Pressable key={genre ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: selectedGenre === genre }}
              onPress={() => { setSelectedGenre(genre); setGenreSheetOpen(false); }}
              style={({ pressed }) => [styles.genreRow, pressed && styles.pressed]}>
              <Text style={styles.genreLabel}>{genre ?? 'All genres'}</Text>
              {selectedGenre === genre ? <Check size={20} color={colors.accentText} /> : null}
            </Pressable>
          ))}
          {genreResource.loading ? <ActivityIndicator accessibilityLabel="Loading genres" color={colors.accent} style={styles.genreLoading} /> : null}
          {genreResource.error ? <InlineStatusBanner tone="error" detail="Some genres could not be loaded." onRetry={genreResource.retry} /> : null}
        </BottomActionSheetScrollView>
      </BottomActionSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingTop: spacing.xxxl + spacing.md },
  selector: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  grid: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  row: { gap: spacing.sm },
  genreButton: { height: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.xs, maxWidth: 130 },
  genreButtonText: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  selectedGenre: { color: colors.accentText },
  genreRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  genreLabel: { ...typography.body, color: colors.text, flex: 1 },
  genreLoading: { padding: spacing.lg },
  pressed: { opacity: 0.6 },
});
