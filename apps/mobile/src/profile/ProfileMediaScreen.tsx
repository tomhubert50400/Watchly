import { useCallback, useMemo, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { useLibraryData } from '../library/useLibraryData';
import type { RootStackParamList } from '../navigation/types';
import { ProfileMediaPoster } from './ProfileMediaRail';
import { getProfileMediaItems, groupProfileMediaByStatus } from './profileMediaModel';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ProfileMedia'>;

export function ProfileMediaScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = (width - spacing.xl * 2 - spacing.sm * 2) / 3;
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const providedItems = route.params.items;
  const usesProvidedItems = providedItems !== undefined;
  const resource = useLibraryData(!usesProvidedItems);
  const loadedItems = providedItems ?? resource.data?.items ?? route.params.initialItems;
  const sourceItems = useMemo(
    () => getProfileMediaItems(loadedItems ?? [], route.params.filter),
    [loadedItems, route.params.filter],
  );
  const groups = useMemo(() => groupProfileMediaByStatus(sourceItems), [sourceItems]);
  const sections = route.params.filter === 'planned' ? [
    { value: 'movies', label: 'Movies', items: sourceItems.filter((item) => item.contentType === 'movie'), emptyLabel: 'No planned movies yet.' },
    { value: 'series', label: 'Series', items: sourceItems.filter((item) => item.contentType === 'series'), emptyLabel: 'No planned series yet.' },
  ] : [
    ...(route.params.filter !== 'movies' ? [{ value: 'inProgress', label: 'In progress', items: groups.inProgress, emptyLabel: 'Nothing in progress right now.' }] : []),
    { value: 'planned', label: 'Planned', items: groups.planned, emptyLabel: 'No planned titles yet.' },
    { value: 'completed', label: 'Completed', items: groups.completed, emptyLabel: 'No completed titles yet.' },
  ];
  const activeSection = sections.find((section) => section.value === selectedSection) ?? sections[0];
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
              key={`${route.params.filter}:${activeSection.value}`}
              data={activeSection.items}
              numColumns={3}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => <ProfileMediaPoster item={item} onOpen={openItem} width={cardWidth} />}
              columnWrapperStyle={styles.row}
              contentContainerStyle={[styles.grid, { paddingBottom: spacing.xxxl + insets.bottom }]}
              initialNumToRender={18}
              maxToRenderPerBatch={12}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<EmptyState title={activeSection.emptyLabel} body="Choose another section to see more titles." />}
              refreshControl={usesProvidedItems ? undefined : (
                <RefreshControl colors={[colors.accent]} onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} />
              )}
            />
          </>
        )}
      </ScreenReveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingTop: spacing.xxxl + spacing.md },
  selector: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  grid: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  row: { gap: spacing.sm },
});
