import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, Search, Star, X } from 'lucide-react-native';
import {
  ImageBackground,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CatalogueSearchItem,
  getCatalogueMovieSections,
  searchCatalogue,
} from '../api/catalogue';
import { getPublicCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { ExploreMediaCard } from './ExploreMediaCard';
import {
  buildExploreSections,
  ExploreSection,
  getExploreViewState,
  groupSearchResults,
} from './exploreState';

const SEARCH_INPUT_ACCESSORY_ID = 'explore-search-keyboard-accessory';
const PUBLIC_EXPLORE_KEY = getPublicCacheKey('explore:sections:v1');
const EMPTY_SECTIONS: Record<ExploreSection, CatalogueSearchItem[]> = { announced: [], trending: [] };

type ExploreScreenProps = {
  isActive?: boolean;
};

export function ExploreScreen({ isActive = true }: ExploreScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<ExploreSection>('trending');
  const [searchItems, setSearchItems] = useState<CatalogueSearchItem[]>([]);
  const [searchItemsQuery, setSearchItemsQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;
  const loadSections = useCallback(async () => {
    const response = await getCatalogueMovieSections();
    return buildExploreSections(response);
  }, []);
  const sections = useCachedResource({ key: PUBLIC_EXPLORE_KEY, load: loadSections });
  const sectionItems = sections.data ?? EMPTY_SECTIONS;
  const visibleSearchItems = searchItemsQuery === trimmedQuery ? searchItems : [];
  const visibleItems = isSearching ? visibleSearchItems : sectionItems[activeSection];
  const visibleError = isSearching ? searchError : sections.error;
  const isVisibleLoading = isSearching
    ? isSearchLoading
    : sections.isInitialLoading && !sections.data;
  const viewState = getExploreViewState({
    activeSection,
    error: visibleError,
    isLoading: isVisibleLoading,
    itemCount: visibleItems.length,
    query,
  });
  const groupedSearchItems = useMemo(() => groupSearchResults(visibleSearchItems), [visibleSearchItems]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    setQuery('');
    Keyboard.dismiss();
  }, [isActive]);

  useEffect(() => {
    if (!isSearching) {
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    let isCurrent = true;
    setSearchError(null);
    setIsSearchLoading(true);

    const handle = setTimeout(() => {
      searchCatalogue(trimmedQuery, 'all')
        .then((response) => {
          if (!isCurrent) {
            return;
          }

          const groupedItems = groupSearchResults(response.items);
          setSearchItems(groupedItems.movies.concat(groupedItems.series));
          setSearchItemsQuery(trimmedQuery);
        })
        .catch((error) => {
          if (isCurrent) {
            setSearchError(error instanceof Error ? error.message : 'Catalogue search failed.');
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsSearchLoading(false);
          }
        });
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(handle);
    };
  }, [isSearching, searchRevision, trimmedQuery]);

  const openItem = useCallback((item: CatalogueSearchItem) => {
    navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }, [navigation]);
  const retryVisible = useCallback(() => {
    if (isSearching) {
      setSearchRevision((revision) => revision + 1);
      return;
    }

    sections.retry();
  }, [isSearching, sections.retry]);
  const refreshVisible = useCallback(() => {
    retryVisible();
  }, [retryVisible]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refreshVisible}
            refreshing={isSearching ? isSearchLoading : sections.isRefreshing}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.screenTitle}>Explore</Text>
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
                style={({ pressed }) => [styles.searchClearButton, pressed ? styles.pressed : null]}
              >
                <X color={colors.background} size={14} strokeWidth={3} />
              </Pressable>
            ) : null}
          </View>
          {!isSearching ? (
            <SegmentedControl
              buttonMinHeight={42}
              containerStyle={styles.sectionControl}
              onChange={setActiveSection}
              options={[
                { label: 'Tendances', value: 'trending' },
                { label: 'À venir', value: 'announced' },
              ]}
              value={activeSection}
            />
          ) : null}
        </View>

        <View style={styles.content}>
          {isSearching ? (
            <SearchComposition
              error={visibleError}
              groupedItems={groupedSearchItems}
              isLoading={isSearchLoading}
              onOpen={openItem}
              onRetry={retryVisible}
              viewState={viewState}
            />
          ) : (
            <DiscoveryComposition
              activeSection={activeSection}
              error={sections.error}
              isInitialLoading={isVisibleLoading}
              isRefreshing={sections.isRefreshing}
              items={sectionItems[activeSection]}
              onOpen={openItem}
              onRetry={sections.retry}
              viewState={viewState}
            />
          )}
        </View>
      </ScrollView>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={SEARCH_INPUT_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              accessibilityLabel="Dismiss keyboard"
              accessibilityRole="button"
              hitSlop={8}
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [styles.keyboardDismissButton, pressed ? styles.keyboardDismissButtonPressed : null]}
            >
              <Text style={styles.keyboardDismissText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </SafeAreaView>
  );
}

function DiscoveryComposition({
  activeSection,
  error,
  isInitialLoading,
  isRefreshing,
  items,
  onOpen,
  onRetry,
  viewState,
}: {
  activeSection: ExploreSection;
  error: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  items: CatalogueSearchItem[];
  onOpen: (item: CatalogueSearchItem) => void;
  onRetry: () => void;
  viewState: ReturnType<typeof getExploreViewState>;
}) {
  if (isInitialLoading) {
    return <InlineStatusBanner detail="Fetching current discovery picks." title={viewState.loadingLabel} tone="updating" />;
  }

  if (error && items.length === 0) {
    return (
      <EmptyState body={error} title={viewState.errorTitle}>
        <Button label="Retry" onPress={onRetry} />
      </EmptyState>
    );
  }

  if (items.length === 0) {
    return <EmptyState body={viewState.emptyBody} title={viewState.emptyTitle} />;
  }

  const featured = items[0];
  const railItems = items.slice(1);

  return (
    <View style={styles.composition}>
      {isRefreshing ? (
        <InlineStatusBanner detail="Cached discovery stays visible while Watchly updates it." tone="updating" />
      ) : error ? (
        <InlineStatusBanner detail={error} onRetry={onRetry} title={viewState.errorTitle} tone="error" />
      ) : null}
      <ExploreFeature
        item={featured}
        onPress={() => onOpen(featured)}
        showReleaseAlert={activeSection === 'announced'}
      />
      {railItems.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{viewState.title}</Text>
          <ScrollView
            contentContainerStyle={styles.rail}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
          >
            {railItems.map((item) => (
              <ExploreMediaCard
                item={item}
                key={`${item.mediaType}:${item.tmdbId}`}
                onPress={() => onOpen(item)}
                showReleaseAlert={activeSection === 'announced'}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function SearchComposition({
  error,
  groupedItems,
  isLoading,
  onOpen,
  onRetry,
  viewState,
}: {
  error: string | null;
  groupedItems: ReturnType<typeof groupSearchResults>;
  isLoading: boolean;
  onOpen: (item: CatalogueSearchItem) => void;
  onRetry: () => void;
  viewState: ReturnType<typeof getExploreViewState>;
}) {
  const itemCount = groupedItems.movies.length + groupedItems.series.length;

  if (isLoading && itemCount === 0) {
    return <InlineStatusBanner title={viewState.loadingLabel} tone="updating" />;
  }

  if (error && itemCount === 0) {
    return (
      <EmptyState body={error} title={viewState.errorTitle}>
        <Button label="Retry search" onPress={onRetry} />
      </EmptyState>
    );
  }

  if (itemCount === 0) {
    return <EmptyState body={viewState.emptyBody} title={viewState.emptyTitle} />;
  }

  return (
    <View style={styles.composition}>
      {isLoading ? (
        <InlineStatusBanner detail="Keeping these results visible while search updates." tone="updating" />
      ) : error ? (
        <InlineStatusBanner detail={error} onRetry={onRetry} title={viewState.errorTitle} tone="error" />
      ) : null}
      <SearchGroup items={groupedItems.movies} onOpen={onOpen} title="Films" />
      <SearchGroup items={groupedItems.series} onOpen={onOpen} title="Series" />
    </View>
  );
}

function SearchGroup({
  items,
  onOpen,
  title,
}: {
  items: CatalogueSearchItem[];
  onOpen: (item: CatalogueSearchItem) => void;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <ExploreMediaCard
            item={item}
            key={`${item.mediaType}:${item.tmdbId}`}
            layout="grid"
            onPress={() => onOpen(item)}
          />
        ))}
      </View>
    </View>
  );
}

function ExploreFeature({
  item,
  onPress,
  showReleaseAlert,
}: {
  item: CatalogueSearchItem;
  onPress: () => void;
  showReleaseAlert: boolean;
}) {
  const releaseDate = formatFeatureDate(item.releaseDate);
  const metadata = showReleaseAlert
    ? [item.mediaType === 'movie' ? 'Film' : 'Series', releaseDate]
    : [item.mediaType === 'movie' ? 'Film' : 'Series', item.voteAverage === null ? null : `TMDB ${item.voteAverage.toFixed(1)}/10`];
  const copy = (
    <>
      <View style={styles.featureScrim} />
      <View style={styles.featureCopy}>
        <Text style={styles.featureEyebrow}>{showReleaseAlert ? 'Coming soon' : 'Watchly discovery'}</Text>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.featureTitle}>{item.title}</Text>
        <View style={styles.featureMetaRow}>
          {showReleaseAlert ? (
            <CalendarDays color={colors.textMuted} size={14} strokeWidth={2} />
          ) : (
            <Star color={colors.rating} fill={colors.rating} size={14} strokeWidth={2} />
          )}
          <Text style={styles.featureMeta}>{metadata.filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.featureShell}>
      <Pressable
        accessibilityLabel={`Open ${item.title}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.featureButton, pressed ? styles.pressed : null]}
      >
        {item.posterUrl ? (
          <ImageBackground
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${item.title} artwork`}
            imageStyle={styles.featureImage}
            resizeMode="cover"
            source={{ uri: item.posterUrl }}
            style={styles.featureImageBackground}
          >
            {copy}
          </ImageBackground>
        ) : (
          <View style={[styles.featureImageBackground, styles.featurePlaceholder]}>{copy}</View>
        )}
      </Pressable>
      {showReleaseAlert && item.mediaType === 'movie' ? (
        <View style={styles.featureAlert}>
          <ReleaseAlertControl contentType="movie" tmdbId={item.tmdbId} />
        </View>
      ) : null}
    </View>
  );
}

function formatFeatureDate(value: string | null) {
  if (!value) {
    return 'Date to be announced';
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
  composition: {
    gap: spacing.xxl,
  },
  content: {
    paddingBottom: 110,
    paddingHorizontal: spacing.xl,
  },
  featureAlert: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
  },
  featureButton: {
    minHeight: 184,
  },
  featureCopy: {
    bottom: spacing.md,
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
  },
  featureEyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  featureImage: {
    borderRadius: radii.lg,
  },
  featureImageBackground: {
    minHeight: 184,
  },
  featureMeta: {
    ...typography.meta,
    color: colors.textMuted,
  },
  featureMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  featurePlaceholder: {
    backgroundColor: colors.panelElevated,
  },
  featureScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 13, 0.53)',
  },
  featureShell: {
    ...shadows.raised,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  featureTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  header: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  keyboardAccessory: {
    alignItems: 'flex-end',
    backgroundColor: '#101116',
    borderTopColor: colors.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    overflow: 'hidden',
    paddingBottom: 5,
    paddingHorizontal: 14,
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
  },
  pressed: {
    opacity: 0.76,
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
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
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionControl: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
