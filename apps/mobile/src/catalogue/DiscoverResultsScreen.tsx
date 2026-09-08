import { DiscoverFiltersSheet } from './DiscoverFiltersSheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import type { CatalogueSearchType } from '../api/catalogue';
import { browseGenreLabel, browseResourceKey, collectionFilters, discoverMoods, getDiscoverBrowse, type BrowseFilters, type DiscoverItem } from '../api/discover';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { discoverTypeOptions } from './DiscoverScreen';
import { ExploreMediaCard } from './ExploreMediaCard';

export function DiscoverResultsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DiscoverResults'>>();
  const { currentUser } = useAuthSession();
  return <DiscoverResults key={`${currentUser?.id ?? 'guest'}:${route.params.collectionId ?? 'personal'}:${route.params.mood ?? 'all'}`} params={route.params} />;
}
function DiscoverResults({ params }: { params: RootStackParamList['DiscoverResults'] }) {
  const [filters, setFilters] = useState<BrowseFilters>(() => ({ ...collectionFilters(params.collectionId), ...(params.mood ? { mood: params.mood } : {}) }));
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<CatalogueSearchType>(params.mediaType);
  return <><DiscoverGrid key={browseResourceKey(filters)} type={type} onType={setType} filters={filters} onFilters={() => setShowFilters(true)} />
    <DiscoverFiltersSheet visible={showFilters} value={filters} onClose={() => setShowFilters(false)} onApply={value => { setFilters(value); setShowFilters(false); }} /></>;
}
function DiscoverGrid({ type, onType, filters, onFilters }: { type: CatalogueSearchType; onType: (type: CatalogueSearchType) => void; filters: BrowseFilters; onFilters: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const load = useCallback(() => getDiscoverBrowse(firebaseIdToken, filters), [firebaseIdToken, filters]);
  const key = browseResourceKey(filters);
  const resource = useCachedResource({ key: currentUser ? getPrivateCacheKey(currentUser.id, key) : getPublicCacheKey(key), load, enabled: !currentUser || Boolean(firebaseIdToken) });
  const revision = useUserDataRevision('tracking', 'opinions', 'viewings', 'episodeProgress', 'watchlists');
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current !== revision) { lastRevision.current = revision; resource.revalidate(); }
  }, [resource.revalidate, revision]);
  const [extra, setExtra] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  useEffect(() => { version.current += 1; busy.current = false; setExtra([]); setPage(1); setHasMore(resource.data?.hasMore ?? false); setLoadingMore(false); setMoreError(null); }, [resource.data]);
  useEffect(() => () => { version.current += 1; }, []);
  const loadMore = async () => {
    if (busy.current) return;
    busy.current = true; setLoadingMore(true); setMoreError(null); const request = version.current;
    try {
      const result = await getDiscoverBrowse(firebaseIdToken, filters, page + 1);
      if (request !== version.current) return;
      setExtra(previous => [...previous, ...result.items]); setPage(previous => previous + 1); setHasMore(result.hasMore);
      if (result.partial) setMoreError('Some titles could not be loaded. Pull to refresh to try again.');
    } catch (error) { if (request === version.current) setMoreError(error instanceof Error ? error.message : 'Could not load more titles.'); }
    finally { if (request === version.current) { busy.current = false; setLoadingMore(false); } }
  };
  const items = [...new Map([...(resource.data?.items ?? []), ...extra].map(item => [item.id, item])).values()].filter(item => type === 'all' || item.mediaType === type);
  return <Screen title="" leading={<Pressable accessibilityRole="button" accessibilityLabel="Back to Discover" onPress={() => navigation.goBack()} style={styles.back}><ChevronLeft size={22} color={colors.text} /><Text style={styles.backText}>Discover</Text></Pressable>} background={<SpotlightAtmosphere imageUrl={items[0]?.posterUrl ?? null} />} refreshControl={<RefreshControl refreshing={resource.isRefreshing} onRefresh={resource.retry} tintColor={colors.accent} />}>
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Explore</Text>
      <Button label="Filters" variant="secondary" onPress={onFilters} />
      <Text style={styles.description}>{[discoverMoods.find(mood => mood.id === filters.mood)?.label, filters.genre ? browseGenreLabel(filters.genre) : null, filters.decade ? `${filters.decade}s` : null, filters.awards ? 'Award winners' : null].filter(Boolean).join(' · ') || 'All stories. Choose filters to find your next watch.'}</Text>
      <SegmentedControl options={discoverTypeOptions} value={type} onChange={onType} />
      {resource.isInitialLoading && !resource.data ? <InlineStatusBanner title="Loading titles" detail="Collecting movies and TV shows." tone="updating" /> : null}
      {resource.error ? <EmptyState title="Could not load this selection" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
      {resource.data?.partial ? <InlineStatusBanner title="Some titles are unavailable" detail="Pull to refresh to try again." tone="updating" /> : null}
      {resource.data && !items.length ? <EmptyState title="No titles for this filter" body="Try All, or choose another selection." /> : null}
      <View style={styles.grid}>{items.map(item => <ExploreMediaCard key={item.id} layout="grid" item={item} onPress={() => navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })} />)}</View>
      {moreError ? <Text accessibilityRole="alert" style={styles.description}>{moreError}</Text> : null}
      {hasMore ? <Button disabled={loadingMore || resource.isRefreshing} label={loadingMore ? 'Loading…' : moreError ? 'Retry loading more' : 'Load more'} onPress={() => void loadMore()} /> : null}
    </View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, title: { ...typography.heading, color: colors.text }, back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.interactiveSurface }, backText: { ...typography.body, color: colors.text }, description: { ...typography.body, color: colors.muted }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } });
