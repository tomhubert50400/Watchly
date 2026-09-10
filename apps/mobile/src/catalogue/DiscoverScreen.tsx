import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { Image, Keyboard, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type CatalogueSearchType } from '../api/catalogue';
import { browseResourceKey, collectionFilters, discoverMoods, getDiscover, getDiscoverBrowse, getDiscoverCollections, type DiscoverItem, type DiscoverMood } from '../api/discover';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { preloadCachedResource, useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, radii, spacing, typography } from '../design/tokens';
import { BlendedArtwork } from '../library/WatchlistRail';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { useCatalogueCache } from './CatalogueCacheContext';
import { DiscoverCarousel } from './DiscoverCarousel';
import { DiscoverMoodSheet } from './DiscoverMoodSheet';
import { DiscoverSearchResults } from './DiscoverSearchResults';
import { ExploreMediaCard } from './ExploreMediaCard';

export const discoverTypeOptions: { label: string; value: CatalogueSearchType }[] = [
  { label: 'All', value: 'all' }, { label: 'Movies', value: 'movie' }, { label: 'TV Shows', value: 'series' },
];

export function DiscoverScreen({ isActive = true }: { isActive?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const { preloadCatalogueItems } = useCatalogueCache();
  const [mediaType, setMediaType] = useState<CatalogueSearchType>('all');
  const [mood, setMood] = useState<DiscoverMood | null>(null);
  const [showMood, setShowMood] = useState(false);
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;
  useEffect(() => { if (!isActive) Keyboard.dismiss(); }, [isActive]);
  const load = useCallback(() => getDiscover(firebaseIdToken, mood), [firebaseIdToken, mood]);
  const resourceKey = `discover:${mood ?? 'all'}:v1`;
  const resource = useCachedResource({
    key: currentUser ? getPrivateCacheKey(currentUser.id, resourceKey) : getPublicCacheKey(resourceKey),
    load, enabled: !currentUser || Boolean(firebaseIdToken), staleTimeMs: 5 * 60 * 1000,
  });
  const collections = useCachedResource({ key: getPublicCacheKey('discover:collections:v1'), load: getDiscoverCollections, staleTimeMs: 60 * 60 * 1000 });
  useEffect(() => {
    let cancelled = false;
    if (currentUser && !firebaseIdToken) return;
    const selections = [{}, ...(collections.data?.items ?? []).map(collection => collectionFilters(collection.id)), ...(mood ? [{ mood }] : [])];
    void Promise.allSettled(selections.map(async filters => {
      const result = await preloadCachedResource({
        key: currentUser ? getPrivateCacheKey(currentUser.id, browseResourceKey(filters)) : getPublicCacheKey(browseResourceKey(filters)),
        load: () => getDiscoverBrowse(firebaseIdToken, filters),
      });
      if (cancelled) return;
      const urls = result.items.slice(0, 8).map(item => item.posterUrl).filter((url): url is string => Boolean(url));
      await Promise.allSettled(urls.map(url => Image.prefetch(url)));
    }));
    return () => { cancelled = true; };
  }, [collections.data, currentUser?.id, firebaseIdToken, mood]);
  const revision = useUserDataRevision('tracking', 'opinions', 'viewings', 'episodeProgress', 'watchlists');
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current !== revision && isActive) { lastRevision.current = revision; resource.revalidate(); }
  }, [isActive, revision, resource.revalidate]);
  const items = (resource.data?.items ?? []).filter(item => mediaType === 'all' || item.mediaType === mediaType);
  const featured = items.slice(0, 6);
  const preloadKey = items.slice(0, 12).map(item => item.id).join(',');
  useEffect(() => {
    if (!isActive || !resource.data) return;
    let cancelled = false;
    const nextItems = resource.data.items.filter(item => mediaType === 'all' || item.mediaType === mediaType).slice(0, 12);
    void Promise.allSettled(nextItems.flatMap(item => [item.posterUrl, item.backdropUrl]).filter((url): url is string => Boolean(url)).map(url => Image.prefetch(url)));
    void (async () => {
      for (let index = 0; index < nextItems.length && !cancelled; index += 3) {
        await preloadCatalogueItems(nextItems.slice(index, index + 3).map(item => ({ contentType: item.mediaType, tmdbId: item.tmdbId })));
      }
    })();
    return () => { cancelled = true; };
  }, [isActive, mediaType, preloadKey, preloadCatalogueItems, resource.data]);
  const openItem = (item: DiscoverItem) => navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  const refresh = () => { resource.retry(); collections.retry(); };
  const moodLabel = discoverMoods.find(item => item.id === mood)?.label;
  return <>
    <Screen title="Discover" tabBarPadding nativeKeyboardInsetsOnly background={<SpotlightAtmosphere imageUrl={items[0]?.posterUrl ?? null} />}
      refreshControl={<RefreshControl refreshing={!isSearching && (resource.isRefreshing || collections.isRefreshing)} onRefresh={isSearching ? undefined : refresh} tintColor={colors.accent} />}
      trailing={<Pressable accessibilityLabel={moodLabel ? `Mood: ${moodLabel}. Change mood` : 'Choose a mood'} accessibilityRole="button" onPress={() => setShowMood(true)} style={[styles.moodButton, mood && styles.moodSelected]}><SlidersHorizontal size={17} color={mood ? colors.accentText : colors.textMuted} /><Text style={styles.moodText}>Mood</Text>{mood ? <View style={styles.moodDot} /> : null}</Pressable>}
    >
      <View style={styles.content}>
        <ScreenReveal delay={50} style={styles.search}>
          <Search color={colors.muted} size={20} />
          <TextInput
            accessibilityLabel="Search for movies, TV shows or people"
            autoComplete="off" autoCapitalize="none" autoCorrect={false} spellCheck={false}
            inputMode="search" keyboardAppearance="dark" returnKeyType="search"
            placeholder="Search for Movies, TV Shows or People" placeholderTextColor={colors.muted}
            onChangeText={setQuery} onSubmitEditing={Keyboard.dismiss} value={query} style={styles.searchText}
          />
          {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12} onPress={() => setQuery('')}><X color={colors.muted} size={18} /></Pressable> : null}
        </ScreenReveal>
        <SegmentedControl options={discoverTypeOptions} value={mediaType} onChange={setMediaType} />
        {isSearching ? <DiscoverSearchResults query={trimmedQuery} searchType={mediaType} /> : <>
        {moodLabel ? <Text style={styles.reason}>Mood: {moodLabel}</Text> : null}
        {resource.isInitialLoading && !resource.data ? <LoadingState variant="grid" label="Finding your next watch" /> : null}
        {resource.error ? <EmptyState title={resource.data ? 'Could not refresh your picks' : 'Discovery is unavailable'} body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
        {resource.data?.partial ? <InlineStatusBanner title="Some picks are unavailable" detail="Pull to refresh to try again." tone="error" /> : null}
        {items.length ? <ScreenReveal delay={100}><DiscoverCarousel items={featured} onOpen={openItem} /></ScreenReveal> : resource.data && !resource.error ? <EmptyState title="No new picks here yet" body={mood ? 'Try another mood or clear it to explore more titles.' : 'Rate or favorite titles you enjoy to help shape your next recommendations.'}>{mood ? <Button label="Change mood" onPress={() => setShowMood(true)} /> : null}</EmptyState> : null}
        <ScreenReveal delay={150} ready={!collections.isInitialLoading || Boolean(collections.data)}>
          <SectionHeader title="Explore your way" actionLabel="Explore all" onActionPress={() => navigation.navigate('DiscoverResults', { title: 'Explore', mediaType, mood })} />
          {collections.error ? <EmptyState title="Collections are unavailable" body={collections.error}><Button label="Retry collections" onPress={collections.retry} /></EmptyState> : null}
          {collections.isInitialLoading && !collections.data ? <LoadingState variant="grid" label="Loading collections" /> : null}
          {collections.data?.partial ? <InlineStatusBanner title="Some collections are unavailable" detail="Pull to refresh to try again." tone="error" /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
            {collections.data?.items.map(collection => <Pressable key={collection.id} accessibilityRole="button" accessibilityLabel={`Open ${collection.title}`} style={styles.collection} onPress={() => navigation.navigate('DiscoverResults', { collectionId: collection.id, title: collection.title, description: collection.description, mediaType })}>
              <View style={styles.collectionArtwork}><BlendedArtwork blendId={`discover-${collection.id}`} urls={collection.artwork} /></View>
              <Text style={styles.collectionTitle}>{collection.title}</Text>
            </Pressable>)}
          </ScrollView>
        </ScreenReveal>
        {items.length > featured.length ? <ScreenReveal delay={200}>
          <SectionHeader title="More for you" actionLabel="View more" onActionPress={() => navigation.navigate('DiscoverResults', { title: 'Selected for you', mediaType, mood })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {items.slice(featured.length, featured.length + 10).map(item => <ExploreMediaCard key={item.id} item={item} onPress={() => openItem(item)} />)}
          </ScrollView>
        </ScreenReveal> : null}
        </>}
      </View>
    </Screen>
    <DiscoverMoodSheet visible={showMood} value={mood} onClose={() => setShowMood(false)} onApply={value => { setMood(value); setShowMood(false); }} />
  </>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.lg }, search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.panel, borderRadius: radii.lg, borderColor: colors.border, borderWidth: 1 },
  searchText: { fontSize: 14, color: colors.text, flex: 1, minWidth: 0, padding: 0 }, moodButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.interactiveSurface },
  moodSelected: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft }, moodText: { fontSize: 13, fontWeight: '700', color: colors.text }, moodDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  reason: { fontSize: 12, color: colors.accentText }, collectionRail: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs }, collection: { width: 278 },
  collectionArtwork: { height: 156, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated },
  collectionTitle: { ...typography.title, fontSize: 15, color: colors.text, marginTop: spacing.sm }, rail: { gap: spacing.md, paddingTop: spacing.sm },
});
