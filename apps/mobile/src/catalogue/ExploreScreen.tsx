import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FlatList,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Star, X } from 'lucide-react-native';
import { CatalogueSearchItem, getCatalogueMovieSections, searchCatalogue } from '../api/catalogue';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';

type ExploreSection = 'trending' | 'announced';
const SEARCH_INPUT_ACCESSORY_ID = 'explore-search-keyboard-accessory';

type ExploreScreenProps = {
  isActive?: boolean;
};

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
      <MediaPoster
        accessibilityLabel={`${item.title} poster`}
        posterUrl={item.posterUrl}
        style={styles.cataloguePoster}
      />
      <View style={styles.catalogueCopy}>
        <Text numberOfLines={2} style={styles.catalogueTitle}>
          {item.title}
        </Text>
        <View style={styles.catalogueMetaRow}>
          <Chip label={mediaLabel} />
          {releaseLabel ? <Chip label={releaseLabel} tone={dateDisplay === 'full' ? 'accent' : 'neutral'} /> : null}
          {showRating && item.voteAverage ? (
            <Chip
              icon={<Star color={colors.rating} fill={colors.rating} size={11} strokeWidth={2} />}
              label={item.voteAverage.toFixed(1)}
              tone="rating"
            />
          ) : null}
        </View>
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
            <Text style={styles.releaseAlertLabel}>Notify</Text>
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

export function ExploreScreen({ isActive = true }: ExploreScreenProps) {
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
    if (isActive) {
      return;
    }

    setQuery('');
    Keyboard.dismiss();
  }, [isActive]);

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
              <LoadingState
                label={
                  isSearching
                    ? 'Searching catalogue'
                    : activeSection === 'trending'
                      ? 'Loading trending'
                      : 'Loading announced'
                }
              />
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
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect={false}
                enablesReturnKeyAutomatically
                inputMode="search"
                inputAccessoryViewID={Platform.OS === 'ios' ? SEARCH_INPUT_ACCESSORY_ID : undefined}
                keyboardAppearance="dark"
                onChangeText={setQuery}
                onSubmitEditing={Keyboard.dismiss}
                placeholder="Search a film or series"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                spellCheck={false}
                style={styles.searchInput}
                value={query}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setQuery('')}
                  style={({ pressed }) => [styles.searchClearButton, pressed && styles.searchClearButtonPressed]}
                >
                  <X color={colors.background} size={14} strokeWidth={3} />
                </Pressable>
              ) : null}
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
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={SEARCH_INPUT_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              accessibilityLabel="Dismiss keyboard"
              accessibilityRole="button"
              hitSlop={8}
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [
                styles.keyboardDismissButton,
                pressed && styles.keyboardDismissButtonPressed,
              ]}
            >
              <Text style={styles.keyboardDismissText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
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
    paddingRight: 78,
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
  catalogueMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  catalogueOverview: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  cataloguePoster: {
    height: 132,
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
  keyboardAccessory: {
    alignItems: 'flex-end',
    backgroundColor: '#101116',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingBottom: 5,
    paddingTop: 7,
  },
  keyboardDismissButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  keyboardDismissButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyboardDismissText: {
    color: '#0A84FF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  releaseAlertLabel: {
    ...typography.meta,
    color: colors.textSubtle,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  releaseAlertSlot: {
    alignItems: 'center',
    elevation: 12,
    gap: 4,
    position: 'absolute',
    right: spacing.sm,
    top: spacing.md,
    width: 58,
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
  searchClearButton: {
    alignItems: 'center',
    backgroundColor: colors.textMuted,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  searchClearButtonPressed: {
    backgroundColor: colors.text,
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
