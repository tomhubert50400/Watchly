import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronRight, Search, X } from 'lucide-react-native';
import {
  Image,
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
  CatalogueSearchType,
  searchCatalogue,
} from '../api/catalogue';
import { ProfileSearchItem, searchProfiles } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { useCatalogueCache } from './CatalogueCacheContext';
import { CatalogueRating } from './CatalogueRating';
import { loadCatalogueSections, PUBLIC_CATALOGUE_SECTIONS_KEY } from './catalogueSectionsResource';
import { ExploreMediaCard } from './ExploreMediaCard';
import { ActorSearchGroup, useActorSearch } from './ActorSearchGroup';
import {
  buildExploreSections,
  deduplicateMediaItems,
  ExploreMediaType,
  ExploreSection,
  filterSearchResults,
  getExploreViewState,
  interleaveMediaItems,
} from './exploreState';

const SEARCH_INPUT_ACCESSORY_ID = 'explore-search-keyboard-accessory';
const EMPTY_SECTIONS: Record<ExploreSection, Record<ExploreMediaType, CatalogueSearchItem[]>> = {
  announced: { movie: [], series: [] },
  trending: { movie: [], series: [] },
};
const SEARCH_TYPE_OPTIONS: {
  accessibilityLabel: string;
  label: string;
  value: CatalogueSearchType;
}[] = [
  { accessibilityLabel: 'Show all results', label: 'All', value: 'all' },
  { accessibilityLabel: 'Show movies only', label: 'Movies', value: 'movie' },
  { accessibilityLabel: 'Show TV shows only', label: 'TV Shows', value: 'series' },
];

type ExploreScreenProps = {
  isActive?: boolean;
  searchOnly?: boolean;
};

export function ExploreScreen({ isActive = true, searchOnly = false }: ExploreScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const { preloadCatalogueItems } = useCatalogueCache();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<CatalogueSearchType>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSection, setActiveSection] = useState<ExploreSection>('trending');
  const [searchItems, setSearchItems] = useState<CatalogueSearchItem[]>([]);
  const [searchPeople, setSearchPeople] = useState<ProfileSearchItem[]>([]);
  const [searchItemsQuery, setSearchItemsQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchRevision, setSearchRevision] = useState(0);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;
  const showSearchTypeFilters = searchOnly || isSearchFocused || isSearching;
  const sections = useCachedResource({
    key: PUBLIC_CATALOGUE_SECTIONS_KEY,
    load: loadCatalogueSections,
    staleTimeMs: 15 * 60 * 1000,
    enabled: !searchOnly,
  });
  const sectionItems = useMemo(
    () => sections.data ? buildExploreSections(sections.data) : EMPTY_SECTIONS,
    [sections.data],
  );
  const discoveryItems = useMemo(
    () => interleaveMediaItems(
      sectionItems[activeSection].movie,
      sectionItems[activeSection].series,
    ),
    [activeSection, sectionItems],
  );
  const visibleSearchItems = useMemo(
    () => searchItemsQuery === trimmedQuery ? filterSearchResults(searchItems, searchType) : [],
    [searchItems, searchItemsQuery, searchType, trimmedQuery],
  );
  const visibleSearchPeople = useMemo(
    () => searchItemsQuery === trimmedQuery && searchType === 'all' ? searchPeople : [],
    [searchItemsQuery, searchPeople, searchType, trimmedQuery],
  );
  const visibleItems = isSearching
    ? visibleSearchItems
    : discoveryItems;
  const atmosphereUrl = discoveryItems[0]?.posterUrl ?? null;
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
  useEffect(() => {
    if (!isActive) {
      Keyboard.dismiss();
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || isSearching) {
      return;
    }

    preloadCatalogueItems(visibleItems.map((item) => ({
      contentType: item.mediaType,
      tmdbId: item.tmdbId,
    })));
  }, [isActive, isSearching, preloadCatalogueItems, visibleItems]);

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
      Promise.all([
        searchCatalogue(trimmedQuery, searchType),
        firebaseIdToken && searchType === 'all'
          ? searchProfiles(firebaseIdToken, trimmedQuery)
          : Promise.resolve({ items: [] }),
      ])
        .then(([catalogueResponse, profileResponse]) => {
          if (!isCurrent) {
            return;
          }

          setSearchItems(deduplicateMediaItems(catalogueResponse.items));
          setSearchPeople(profileResponse.items);
          setSearchItemsQuery(trimmedQuery);
        })
        .catch((error) => {
          if (isCurrent) {
            setSearchError(error instanceof Error ? error.message : 'Search failed.');
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
  }, [firebaseIdToken, isSearching, searchRevision, searchType, trimmedQuery]);

  const openItem = useCallback((item: CatalogueSearchItem) => {
    navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }, [navigation]);
  const openPerson = useCallback((person: ProfileSearchItem) => {
    navigation.navigate('PublicProfile', {
      profilePreview: {
        avatarUrl: person.avatarUrl,
        displayName: person.displayName,
        handle: person.handle,
      },
      previewOwnProfile: person.id === currentUser?.id,
      userId: person.id,
    });
  }, [currentUser?.id, navigation]);
  const openDiscovery = useCallback((section: ExploreSection, mediaType: ExploreMediaType) => {
    navigation.navigate('ExploreDiscovery', {
      mediaType,
      section,
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
      <SpotlightAtmosphere imageUrl={atmosphereUrl} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refreshVisible}
            refreshing={!isSearching && sections.isRefreshing}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.screenTitle}>{searchOnly ? 'Search' : 'Explore'}</Text>
          <View style={styles.searchBox}>
            <Search color={colors.muted} size={20} strokeWidth={2.2} />
            <NativeTextInput
              autoFocus={searchOnly}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect={false}
              enablesReturnKeyAutomatically
              inputMode="search"
              inputAccessoryViewID={Platform.OS === 'ios' ? SEARCH_INPUT_ACCESSORY_ID : undefined}
              keyboardAppearance="dark"
              onBlur={() => setIsSearchFocused(false)}
              onChangeText={setQuery}
              onFocus={() => setIsSearchFocused(true)}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Search for Movies, TV Shows or People"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              spellCheck={false}
              style={styles.searchInput}
              textAlignVertical="center"
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setQuery('')}
                style={({ pressed }) => [styles.searchClearButton, pressed ? styles.pressed : null]}
              >
                <X color={colors.background} size={14} strokeWidth={3} />
              </Pressable>
            ) : null}
          </View>
          {showSearchTypeFilters ? (
            <View style={styles.searchTypeFilters}>
              {SEARCH_TYPE_OPTIONS.map((option) => {
                const selected = searchType === option.value;

                return (
                  <Pressable
                    accessibilityLabel={option.accessibilityLabel}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => {
                      if (!selected) {
                        hapticSelection();
                        setSearchType(option.value);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.searchTypeButton,
                      pressed ? styles.searchTypeButtonPressed : null,
                    ]}
                  >
                    <Chip
                      label={option.label}
                      style={[styles.searchTypeChip, selected ? null : styles.searchTypeChipIdle]}
                      textStyle={[
                        styles.searchTypeChipText,
                        selected ? null : styles.searchTypeChipTextIdle,
                      ]}
                      tone={selected ? 'accent' : 'neutral'}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <SegmentedControl
              buttonMinHeight={42}
              containerStyle={styles.sectionControl}
              onChange={setActiveSection}
              options={[
                { label: 'Trending', value: 'trending' },
                { label: 'Coming soon', value: 'announced' },
              ]}
              value={activeSection}
            />
          )}
        </View>

        <View style={styles.content}>
          {isSearching ? (
            <SearchComposition
              query={trimmedQuery}
              error={visibleError}
              isLoading={isSearchLoading}
              items={visibleSearchItems}
              onOpen={openItem}
              onOpenPerson={openPerson}
              onRetry={retryVisible}
              people={visibleSearchPeople}
              searchType={searchType}
              viewState={viewState}
            />
          ) : searchOnly ? null : (
            <DiscoveryComposition
              activeSection={activeSection}
              error={sections.error}
              isInitialLoading={isVisibleLoading}
              movies={sectionItems[activeSection].movie}
              onOpen={openItem}
              onRetry={sections.retry}
              onViewMore={openDiscovery}
              series={sectionItems[activeSection].series}
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
  movies,
  onOpen,
  onRetry,
  onViewMore,
  series,
  viewState,
}: {
  activeSection: ExploreSection;
  error: string | null;
  isInitialLoading: boolean;
  movies: readonly CatalogueSearchItem[];
  onOpen: (item: CatalogueSearchItem) => void;
  onRetry: () => void;
  onViewMore: (section: ExploreSection, mediaType: ExploreMediaType) => void;
  series: readonly CatalogueSearchItem[];
  viewState: ReturnType<typeof getExploreViewState>;
}) {
  const { getCachedMovie, getCachedSeries } = useCatalogueCache();
  const featured = interleaveMediaItems(movies, series)[0];
  const featuredDetails = featured
    ? featured.mediaType === 'movie'
      ? getCachedMovie(featured.tmdbId)
      : getCachedSeries(featured.tmdbId)
    : null;
  const itemCount = movies.length + series.length;

  if (isInitialLoading) {
    return <InlineStatusBanner detail="Fetching current discovery picks." title={viewState.loadingLabel} tone="updating" />;
  }

  if (error && itemCount === 0) {
    return (
      <EmptyState body={error} title={viewState.errorTitle}>
        <Button label="Retry" onPress={onRetry} />
      </EmptyState>
    );
  }

  if (!featured) {
    return <EmptyState body={viewState.emptyBody} title={viewState.emptyTitle} />;
  }

  return (
    <View style={styles.composition}>
      <ExploreFeature
        item={featured}
        logoAspectRatio={featuredDetails?.logoAspectRatio ?? null}
        logoUrl={featuredDetails?.logoUrl ?? null}
        onPress={() => onOpen(featured)}
        section={activeSection}
      />
      <DiscoveryRail
        items={movies.filter((item) => item !== featured)}
        mediaType="movie"
        onOpen={onOpen}
        onViewMore={() => onViewMore(activeSection, 'movie')}
        showReleaseAlert={activeSection === 'announced'}
        title="Movies"
      />
      <DiscoveryRail
        items={series.filter((item) => item !== featured)}
        mediaType="series"
        onOpen={onOpen}
        onViewMore={() => onViewMore(activeSection, 'series')}
        showReleaseAlert={activeSection === 'announced'}
        title="TV Shows"
      />
    </View>
  );
}

function DiscoveryRail({
  items,
  mediaType,
  onOpen,
  onViewMore,
  showReleaseAlert,
  title,
}: {
  items: readonly CatalogueSearchItem[];
  mediaType: ExploreMediaType;
  onOpen: (item: CatalogueSearchItem) => void;
  onViewMore: () => void;
  showReleaseAlert: boolean;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        actionAccessibilityLabel={`View more ${title.toLowerCase()}`}
        actionLabel="View more"
        onActionPress={onViewMore}
        title={title}
      />
      {items.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.rail}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
        >
          {items.map((item) => (
            <ExploreMediaCard
              item={item}
              key={`${item.mediaType}:${item.tmdbId}`}
              onPress={() => onOpen(item)}
              showReleaseAlert={showReleaseAlert}
            />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptySection}>No {mediaType === 'movie' ? 'movies' : 'TV shows'} available.</Text>
      )}
    </View>
  );
}

export function SearchComposition({
  query,
  error,
  isLoading,
  items,
  onOpen,
  onOpenPerson,
  onRetry,
  people,
  searchType,
  viewState,
}: {
  query: string;
  error: string | null;
  isLoading: boolean;
  items: readonly CatalogueSearchItem[];
  onOpen: (item: CatalogueSearchItem) => void;
  onOpenPerson: (person: ProfileSearchItem) => void;
  onRetry: () => void;
  people: readonly ProfileSearchItem[];
  searchType: CatalogueSearchType;
  viewState: ReturnType<typeof getExploreViewState>;
}) {
  const title = searchType === 'movie' ? 'Movies' : searchType === 'series' ? 'TV Shows' : 'Results';
  const actors = useActorSearch(query);
  const resultCount = items.length + people.length + actors.items.length;
  const retry = () => { actors.retry(); onRetry(); };

  if ((isLoading || actors.isLoading) && resultCount === 0) {
    return <InlineStatusBanner title={viewState.loadingLabel} tone="updating" />;
  }

  if ((error || actors.error) && resultCount === 0) {
    return (
      <EmptyState body={error ?? actors.error ?? ''} title={viewState.errorTitle}>
        <Button label="Retry search" onPress={retry} />
      </EmptyState>
    );
  }

  if (resultCount === 0) {
    return <EmptyState body={viewState.emptyBody} title={viewState.emptyTitle} />;
  }

  return (
    <View style={styles.composition}>
      <ActorSearchGroup items={actors.items} />
      {actors.error ? <Button label="Retry actor search" onPress={actors.retry} /> : null}
      {error ? <Button label="Retry title and people search" onPress={onRetry} /> : null}
      <SearchGroup items={items} onOpen={onOpen} title={title} />
      <PeopleSearchGroup items={people} onOpen={onOpenPerson} />
    </View>
  );
}

function SearchGroup({
  items,
  onOpen,
  title,
}: {
  items: readonly CatalogueSearchItem[];
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
  logoAspectRatio,
  logoUrl,
  onPress,
  section,
}: {
  item: CatalogueSearchItem;
  logoAspectRatio: number | null;
  logoUrl: string | null;
  onPress: () => void;
  section: ExploreSection;
}) {
  const showReleaseAlert = section === 'announced';
  const releaseDate = formatFeatureDate(item.releaseDate);
  const mediaTypeLabel = item.mediaType === 'movie' ? 'Film' : 'Series';
  const hasSecondaryMetadata = showReleaseAlert ? releaseDate !== null : item.voteAverage !== null;
  const copy = (
    <>
      <View style={styles.featureScrim} />
      <View style={styles.featureCopy}>
        <Text style={styles.featureEyebrow}>{showReleaseAlert ? 'Coming soon' : 'Trending now'}</Text>
        {logoUrl ? (
          <View
            accessibilityLabel={item.title}
            accessibilityRole="header"
            accessible
            style={styles.featureLogoFrame}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              resizeMode="contain"
              source={{ uri: logoUrl }}
              style={[styles.featureLogo, { aspectRatio: logoAspectRatio ?? 3 }]}
            />
          </View>
        ) : (
          <Text accessibilityRole="header" numberOfLines={2} style={styles.featureTitle}>
            {item.title}
          </Text>
        )}
        <View style={styles.featureMetaRow}>
          {showReleaseAlert ? <CalendarDays color={colors.textMuted} size={14} strokeWidth={2} /> : null}
          <Text style={styles.featureMeta}>{mediaTypeLabel}</Text>
          {hasSecondaryMetadata ? <Text style={styles.featureMetaSeparator}>·</Text> : null}
          {showReleaseAlert ? (
            releaseDate ? <Text style={styles.featureMeta}>{releaseDate}</Text> : null
          ) : (
            <CatalogueRating voteAverage={item.voteAverage} />
          )}
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

function PeopleSearchGroup({
  items,
  onOpen,
}: {
  items: readonly ProfileSearchItem[];
  onOpen: (item: ProfileSearchItem) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>People</Text>
      <View>
        {items.map((item, index) => (
          <Pressable
            accessibilityHint="Opens this Watchly profile."
            accessibilityLabel={`Open ${item.displayName}, @${item.handle}`}
            accessibilityRole="button"
            key={item.id}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [
              styles.personRow,
              index < items.length - 1 ? styles.personRowDivider : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} size={48} />
            <View style={styles.personCopy}>
              <Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text>
              <Text numberOfLines={1} style={styles.personMeta}>@{item.handle}</Text>
            </View>
            <ChevronRight color={colors.textSubtle} size={19} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
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
  emptySection: {
    ...typography.body,
    color: colors.textSubtle,
    paddingVertical: spacing.lg,
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
  featureLogo: {
    height: '100%',
    maxWidth: '100%',
  },
  featureLogoFrame: {
    alignItems: 'flex-start',
    height: 48,
    width: '80%',
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
  featureMetaSeparator: {
    ...typography.meta,
    color: colors.textMuted,
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
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  personMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  personName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.sm,
  },
  personRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    minWidth: 0,
    paddingVertical: spacing.sm,
  },
  searchTypeButton: {
    justifyContent: 'center',
    minHeight: 44,
  },
  searchTypeButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  searchTypeChip: {
    borderRadius: radii.xl,
    minHeight: 30,
    paddingHorizontal: 12,
  },
  searchTypeChipIdle: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  searchTypeChipText: {
    fontSize: 13,
    textTransform: 'none',
  },
  searchTypeChipTextIdle: {
    color: colors.textSubtle,
  },
  searchTypeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
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
