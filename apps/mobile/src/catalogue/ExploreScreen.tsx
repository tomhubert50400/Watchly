import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { CatalogueSearchItem, getCatalogueMovieSections, searchCatalogue } from '../api/catalogue';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';

type ExploreSection = 'trending' | 'announced';

const CatalogueResultCard = memo(function CatalogueResultCard({
  dateDisplay = 'year',
  item,
  onPress,
  showReleaseAlert = false,
  showRating = true,
}: {
  dateDisplay?: 'full' | 'year';
  item: CatalogueSearchItem;
  onPress?: () => void;
  showReleaseAlert?: boolean;
  showRating?: boolean;
}) {
  const releaseLabel =
    dateDisplay === 'full' ? formatFullDate(item.releaseDate) : getReleaseYear(item.releaseDate);
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
          {releaseLabel ? ` / ${releaseLabel}` : ''}
          {showRating && item.voteAverage ? ` / ${item.voteAverage.toFixed(1)}` : ''}
        </Text>
        <Text numberOfLines={3} style={styles.catalogueOverview}>
          {item.overview || 'No synopsis available yet.'}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    if (showReleaseAlert) {
      return (
        <View style={[styles.catalogueCard, styles.catalogueCardWithOverlay]}>
          {content}
          <Pressable
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.catalogueHitArea, pressed && styles.catalogueHitAreaPressed]}
          />
          <View style={styles.releaseAlertSlot}>
            <ReleaseAlertControl contentType="movie" tmdbId={item.tmdbId} />
          </View>
        </View>
      );
    }

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
  const [items, setItems] = useState<CatalogueSearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<ExploreSection>('trending');
  const [isSectionLoading, setIsSectionLoading] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionItems, setSectionItems] = useState<Record<ExploreSection, CatalogueSearchItem[]>>({
    announced: [],
    trending: [],
  });
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;

  useEffect(() => {
    let isCurrent = true;

    setIsSectionLoading(true);
    setSectionError(null);

    getCatalogueMovieSections()
      .then((response) => {
        if (isCurrent) {
          setSectionItems({
            announced: response.announced,
            trending: response.trending,
          });
        }
      })
      .catch((caughtError) => {
        if (isCurrent) {
          setSectionItems({ announced: [], trending: [] });
          setSectionError(caughtError instanceof Error ? caughtError.message : 'Explore sections failed.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsSectionLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

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

      searchCatalogue(trimmedQuery, 'all')
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
  }, [trimmedQuery]);

  const renderCatalogueItem = useCallback(
    ({ item }: { item: CatalogueSearchItem }) => (
      <CatalogueResultCard
        dateDisplay={!isSearching && activeSection === 'announced' ? 'full' : 'year'}
        item={item}
        showReleaseAlert={!isSearching && activeSection === 'announced'}
        showRating={isSearching || activeSection !== 'announced'}
        onPress={() =>
          navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', {
            title: item.title,
            tmdbId: item.tmdbId,
          })
        }
      />
    ),
    [activeSection, isSearching, navigation],
  );
  const data = isSearching ? items : sectionItems[activeSection];
  const showLoading = isSearching ? isLoading : isSectionLoading;
  const visibleError = isSearching ? error : sectionError;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {showLoading ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>
                  {isSearching
                    ? 'Searching catalogue'
                    : activeSection === 'trending'
                      ? 'Loading trending'
                      : 'Loading announced'}
                </Text>
              </View>
            ) : visibleError ? (
              <EmptyState
                body={visibleError}
                title={isSearching ? 'Catalogue search failed' : 'Explore failed'}
              />
            ) : (
              <EmptyState
                body={
                  isSearching
                    ? 'Try another title.'
                    : activeSection === 'trending'
                      ? 'No released trending films are available yet.'
                      : 'No announced films are available yet.'
                }
                title={isSearching ? 'No results found' : 'No titles yet'}
              />
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchBox}>
              <Search color={colors.muted} size={20} strokeWidth={2.2} />
              <NativeTextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search a film or series"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
            </View>
            {!isSearching ? (
              <SegmentedControl
                containerStyle={styles.sectionControl}
                onChange={setActiveSection}
                options={[
                  { label: 'Trending', value: 'trending' },
                  { label: 'Announced', value: 'announced' },
                ]}
                value={activeSection}
              />
            ) : null}
          </View>
        }
        contentContainerStyle={styles.list}
        data={showLoading ? [] : data}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        renderItem={renderCatalogueItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function getReleaseYear(value: string | null) {
  return value ? value.slice(0, 4) : null;
}

function formatFullDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
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
  catalogueCardWithOverlay: {
    paddingRight: 64,
    position: 'relative',
  },
  catalogueHitArea: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    zIndex: 1,
  },
  catalogueHitAreaPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
  header: {
    marginBottom: spacing.lg,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
  releaseAlertSlot: {
    elevation: 12,
    height: 42,
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 42,
    zIndex: 20,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
  },
  sectionControl: {
    marginTop: spacing.md,
  },
});
