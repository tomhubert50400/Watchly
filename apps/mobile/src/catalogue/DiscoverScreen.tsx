import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type CatalogueSearchType } from '../api/catalogue';
import { discoverMoods, getDiscover, getDiscoverCollections, type DiscoverItem, type DiscoverMood } from '../api/discover';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
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
  const load = useCallback(() => getDiscover(firebaseIdToken, mood), [firebaseIdToken, mood]);
  const resourceKey = `discover:${mood ?? 'all'}:v1`;
  const resource = useCachedResource({
    key: currentUser ? getPrivateCacheKey(currentUser.id, resourceKey) : getPublicCacheKey(resourceKey),
    load, enabled: isActive && (!currentUser || Boolean(firebaseIdToken)), staleTimeMs: 5 * 60 * 1000,
  });
  const collections = useCachedResource({ key: getPublicCacheKey('discover:collections:v1'), load: getDiscoverCollections, enabled: isActive, staleTimeMs: 60 * 60 * 1000 });
  const revision = useUserDataRevision('tracking', 'opinions', 'viewings', 'episodeProgress', 'watchlists');
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current !== revision && isActive) { lastRevision.current = revision; resource.revalidate(); }
  }, [isActive, revision, resource.revalidate]);
  const items = (resource.data?.items ?? []).filter(item => mediaType === 'all' || item.mediaType === mediaType);
  const featured = items.slice(0, 6);
  const preloadKey = featured.map(item => item.id).join(',');
  useEffect(() => {
    if (isActive && resource.data) void preloadCatalogueItems(resource.data.items.filter(item => mediaType === 'all' || item.mediaType === mediaType).slice(0, 6).map(item => ({ contentType: item.mediaType, tmdbId: item.tmdbId })));
  }, [isActive, mediaType, preloadKey, preloadCatalogueItems, resource.data]);
  const openItem = (item: DiscoverItem) => navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  const refresh = () => { resource.retry(); collections.retry(); };
  const moodLabel = discoverMoods.find(item => item.id === mood)?.label;
  return <>
    <Screen title="Discover" tabBarPadding background={<SpotlightAtmosphere imageUrl={items[0]?.posterUrl ?? null} />}
      refreshControl={<RefreshControl refreshing={resource.isRefreshing || collections.isRefreshing} onRefresh={refresh} tintColor={colors.accent} />}
      trailing={<Pressable accessibilityLabel={moodLabel ? `Mood: ${moodLabel}. Change mood` : 'Choose a mood'} accessibilityRole="button" onPress={() => setShowMood(true)} style={[styles.moodButton, mood && styles.moodSelected]}><SlidersHorizontal size={17} color={mood ? colors.accentText : colors.textMuted} /><Text style={styles.moodText}>Mood</Text>{mood ? <View style={styles.moodDot} /> : null}</Pressable>}
    >
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search for movies, TV shows or people" onPress={() => navigation.navigate('CatalogueSearch')} style={styles.search}>
          <Search color={colors.muted} size={20} /><Text style={styles.searchText}>Search for Movies, TV Shows or People</Text>
        </Pressable>
        <SegmentedControl options={discoverTypeOptions} value={mediaType} onChange={setMediaType} />
        {moodLabel ? <Text style={styles.reason}>Mood: {moodLabel}</Text> : null}
        {resource.isInitialLoading && !resource.data ? <InlineStatusBanner title="Finding your next watch" detail="Collecting movies and TV shows." tone="updating" /> : null}
        {resource.error ? <EmptyState title={resource.data ? 'Could not refresh your picks' : 'Discovery is unavailable'} body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
        {resource.data?.partial ? <InlineStatusBanner title="Some picks are unavailable" detail="Pull to refresh to try again." tone="updating" /> : null}
        {items.length ? <DiscoverCarousel items={featured} onOpen={openItem} /> : resource.data && !resource.error ? <EmptyState title="No new picks here yet" body={mood ? 'Try another mood or clear it to explore more titles.' : 'Rate or favorite titles you enjoy to help shape your next recommendations.'}>{mood ? <Button label="Change mood" onPress={() => setShowMood(true)} /> : null}</EmptyState> : null}
        <View>
          <SectionHeader title="Explore a collection" />
          {collections.error ? <EmptyState title="Collections are unavailable" body={collections.error}><Button label="Retry collections" onPress={collections.retry} /></EmptyState> : null}
          {collections.isInitialLoading && !collections.data ? <InlineStatusBanner title="Loading collections" detail="Gathering movies and shows." tone="updating" /> : null}
          {collections.data?.partial ? <InlineStatusBanner title="Some collections are unavailable" detail="Pull to refresh to try again." tone="updating" /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
            {collections.data?.items.map(collection => <Pressable key={collection.id} accessibilityRole="button" accessibilityLabel={`Open ${collection.title}`} style={styles.collection} onPress={() => navigation.navigate('DiscoverResults', { collectionId: collection.id, title: collection.title, description: collection.description, mediaType })}>
              <View style={styles.collectionArtwork}><BlendedArtwork blendId={`discover-${collection.id}`} urls={collection.artwork} /></View>
              <Text style={styles.collectionTitle}>{collection.title}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
        {items.length > featured.length ? <View>
          <SectionHeader title="More for you" actionLabel="View more" onActionPress={() => navigation.navigate('DiscoverResults', { title: 'Selected for you', mediaType, mood })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {items.slice(featured.length, featured.length + 10).map(item => <ExploreMediaCard key={item.id} item={item} onPress={() => openItem(item)} />)}
          </ScrollView>
        </View> : null}
      </View>
    </Screen>
    <DiscoverMoodSheet visible={showMood} value={mood} onClose={() => setShowMood(false)} onApply={value => { setMood(value); setShowMood(false); }} />
  </>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.lg }, search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.panel, borderRadius: radii.lg, borderColor: colors.border, borderWidth: 1 },
  searchText: { fontSize: 14, color: colors.muted, flex: 1 }, moodButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.interactiveSurface },
  moodSelected: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft }, moodText: { fontSize: 13, fontWeight: '700', color: colors.text }, moodDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  reason: { fontSize: 12, color: colors.accentText }, collectionRail: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs }, collection: { width: 278 },
  collectionArtwork: { height: 156, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated },
  collectionTitle: { ...typography.title, fontSize: 15, color: colors.text, marginTop: spacing.sm }, rail: { gap: spacing.md, paddingTop: spacing.sm },
});
