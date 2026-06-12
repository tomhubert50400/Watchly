import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { CatalogueSearchItem, CatalogueSearchType, searchCatalogue } from '../api/catalogue';
import { EmptyState } from '../components/EmptyState';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

const catalogueFilters: { label: string; type: CatalogueSearchType }[] = [
  { label: 'All', type: 'all' },
  { label: 'Films', type: 'movie' },
  { label: 'Series', type: 'series' },
];

const CatalogueResultCard = memo(function CatalogueResultCard({
  item,
  onPress,
}: {
  item: CatalogueSearchItem;
  onPress?: () => void;
}) {
  const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
  const mediaLabel = item.mediaType === 'movie' ? 'Film' : 'Series';
  const content = (
    <>
      {item.posterUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: item.posterUrl }}
          style={styles.cataloguePoster}
        />
      ) : (
        <View style={styles.cataloguePosterPlaceholder}>
          <Search color={colors.muted} size={22} strokeWidth={2} />
        </View>
      )}
      <View style={styles.catalogueCopy}>
        <Text numberOfLines={2} style={styles.catalogueTitle}>
          {item.title}
        </Text>
        <Text style={styles.catalogueMeta}>
          {mediaLabel}
          {year ? ` / ${year}` : ''}
          {item.voteAverage ? ` / ${item.voteAverage.toFixed(1)}` : ''}
        </Text>
        <Text numberOfLines={3} style={styles.catalogueOverview}>
          {item.overview || 'No synopsis available yet.'}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`Open ${item.title}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.catalogueCard, pressed && styles.catalogueCardPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.catalogueCard}>
      {content}
    </View>
  );
});

export function ExploreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CatalogueSearchType>('all');
  const [items, setItems] = useState<CatalogueSearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const handle = setTimeout(() => {
      setError(null);
      setIsLoading(true);

      searchCatalogue(trimmedQuery, selectedType)
        .then((response) => {
          if (isCurrent) {
            setItems(response.items);
          }
        })
        .catch((caughtError) => {
          if (isCurrent) {
            setItems([]);
            setError(caughtError instanceof Error ? caughtError.message : 'Catalogue search failed.');
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsLoading(false);
          }
        });
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(handle);
    };
  }, [selectedType, trimmedQuery]);

  const renderCatalogueItem = useCallback(
    ({ item }: { item: CatalogueSearchItem }) => (
      <CatalogueResultCard
        item={item}
        onPress={() =>
          navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', {
            title: item.title,
            tmdbId: item.tmdbId,
          })
        }
      />
    ),
    [navigation],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {isLoading ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Searching TMDB</Text>
              </View>
            ) : error ? (
              <EmptyState body={error} title="Catalogue search failed" />
            ) : (
              <EmptyState
                body={
                  trimmedQuery.length < 2
                    ? 'Type at least two characters to search films and series.'
                    : 'Try another title or switch filters.'
                }
                title={trimmedQuery.length < 2 ? 'Search the catalogue' : 'No results found'}
              />
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TMDB catalogue</Text>
            <Text style={styles.title}>Find films and series fast</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              label="Search"
              onChangeText={setQuery}
              placeholder="Search a film or series"
              returnKeyType="search"
              value={query}
            />
            <View style={styles.filters}>
              {catalogueFilters.map((filter) => {
                const isSelected = selectedType === filter.type;

                return (
                  <Pressable
                    accessibilityLabel={`Show ${filter.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={filter.type}
                    onPress={() => setSelectedType(filter.type)}
                    style={({ pressed }) => [
                      styles.filter,
                      isSelected && styles.filterSelected,
                      pressed && styles.filterPressed,
                    ]}
                  >
                    <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.tmdbNotice}>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        data={isLoading ? [] : items}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        renderItem={renderCatalogueItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  catalogueCard: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  catalogueCardPressed: {
    opacity: 0.78,
  },
  catalogueCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  catalogueMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  catalogueOverview: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  cataloguePoster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 132,
    width: 88,
  },
  cataloguePosterPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 132,
    justifyContent: 'center',
    width: 88,
  },
  catalogueTitle: {
    ...typography.title,
    color: colors.text,
  },
  emptyWrap: {
    flexGrow: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  filter: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  filterLabelSelected: {
    color: colors.textOnAccent,
  },
  filterPressed: {
    opacity: 0.76,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  header: {
    marginBottom: spacing.xl,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  tmdbNotice: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.md,
  },
});
